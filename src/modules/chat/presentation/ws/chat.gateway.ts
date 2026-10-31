import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from "@nestjs/websockets";
import { Logger, UseFilters, UsePipes, ValidationPipe } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { TokenService } from "../../../auth/application/services/token.service";
import { ChatAuthorizationService } from "../../application/services/chat-authorization.service";
import { SendMessageUseCase } from "../../application/use-cases/send-message.use-case";
import { SendMessageWsDto } from "../../application/dtos/send-message.dto";
import {
  JoinConversationWsDto,
  LeaveConversationWsDto,
} from "../../application/dtos/ws-events.dto";
import { WsExceptionsFilter } from "../../../../common/filters/ws-exceptions.filter";
import { ResponseResult } from "../../../../common/dtos/response-result.dto";
import { UserPresenceService } from "../../application/services/user-presence.service";

@UseFilters(WsExceptionsFilter)
@WebSocketGateway({
  namespace: "/chat",
  cors: { origin: "*" },
  pingInterval: 30000,
  pingTimeout: 25000,
  transports: ["websocket", "polling"],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly chatAuthService: ChatAuthorizationService,
    private readonly sendMessageUseCase: SendMessageUseCase,
    private readonly presenceService: UserPresenceService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake?.auth?.accessToken ||
        client.handshake?.auth?.token ||
        this.extractTokenFromHeader(client.handshake?.headers?.authorization);

      if (!token) {
        this.logger.warn(
          `WebSocket handshake rejected: missing token (socket ${client.id})`,
        );
        client.disconnect(true);
        return;
      }

      const decoded = await this.tokenService.verifyAccessToken(token);
      const user = {
        id: Number(decoded.sub),
        sub: Number(decoded.sub),
        email: decoded.email,
        role: decoded.role,
      };
      client.data.user = user;
      this.logger.log(
        `User ${user.id} authenticated on WebSocket ${client.id}`,
      );

      // Track connection presence
      await this.presenceService.handleUserConnected(user.id, client.id);
    } catch (err: any) {
      this.logger.warn(
        `WebSocket auth failed for ${client.id}: ${err.message}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const reason = (client as any).disconnectReason || "unknown";
    this.logger.log(`Client disconnected: ${client.id} (reason: ${reason})`);

    // Handle offline presence with debounce to prevent flapping
    this.presenceService.handleUserDisconnected(
      client.id,
      (userId, lastSeenAt, rooms) => {
        for (const room of rooms) {
          this.server.to(room).emit("user.activity", {
            userId,
            isOnline: false,
            lastSeenAt: lastSeenAt.toISOString(),
          });
        }
      },
    );
  }

  @SubscribeMessage("conversation.join")
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinConversationWsDto,
  ): Promise<ResponseResult<any>> {
    const user = client.data?.user;
    if (!user) {
      throw new WsException({
        type: "UNAUTHORIZED",
        message: "Socket not authenticated",
      });
    }

    const { conversationId } = payload;
    const isMember = await this.chatAuthService.isMember(
      conversationId,
      user.id,
    );
    if (!isMember) {
      throw new WsException({
        type: "FORBIDDEN",
        message: "You are not an authorized member of this conversation",
      });
    }

    const roomName = `conversation:${conversationId}`;
    client.join(roomName);
    this.presenceService.trackSocketRoom(user.id, client.id, roomName);
    this.logger.log(`User ${user.id} joined room ${roomName}`);

    // Broadcast user active in this room to peers
    this.server.to(roomName).emit("user.activity", {
      userId: user.id,
      conversationId,
      isOnline: true,
      lastSeenAt: null,
    });

    return {
      success: true,
      status: "success",
      message: "Joined conversation successfully",
      data: { conversationId },
      error: null,
    };
  }

  @SubscribeMessage("conversation.leave")
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LeaveConversationWsDto,
  ): Promise<ResponseResult<any>> {
    const user = client.data?.user;
    const { conversationId } = payload;
    const roomName = `conversation:${conversationId}`;
    client.leave(roomName);
    if (user) {
      this.presenceService.untrackSocketRoom(user.id, client.id, roomName);
    }

    return {
      success: true,
      status: "success",
      message: "Left conversation successfully",
      data: { conversationId },
      error: null,
    };
  }

  @SubscribeMessage("user.activity.get")
  async handleGetUserActivity(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { userId?: number; userIds?: number[] },
  ): Promise<ResponseResult<any>> {
    const user = client.data?.user;
    if (!user) {
      throw new WsException({
        type: "UNAUTHORIZED",
        message: "Socket not authenticated",
      });
    }

    if (Array.isArray(payload?.userIds) && payload.userIds.length > 0) {
      const activitiesMap = await this.presenceService.getUserActivityBatch(
        payload.userIds,
      );
      return {
        success: true,
        status: "success",
        message: "User activities retrieved",
        data: {
          activities: Array.from(activitiesMap.values()),
        },
        error: null,
      };
    } else if (payload?.userId) {
      const activity = await this.presenceService.getUserActivity(
        payload.userId,
      );
      return {
        success: true,
        status: "success",
        message: "User activity retrieved",
        data: activity,
        error: null,
      };
    } else {
      throw new WsException({
        type: "BAD_REQUEST",
        message: "Either userId or userIds must be provided",
      });
    }
  }

  @SubscribeMessage("message.send")
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessageWsDto,
  ): Promise<ResponseResult<any>> {
    const user = client.data?.user;
    if (!user) {
      throw new WsException({
        type: "UNAUTHORIZED",
        message: "Socket not authenticated",
      });
    }

    try {
      const senderName = payload.senderName || user.name;
      // 1. Persist message durable in Cassandra & enforce idempotency
      const result = await this.sendMessageUseCase.execute(
        user.id,
        payload,
        senderName,
      );

      // 2. Only after durable persistence succeeds, broadcast to room members
      if (!result.isDuplicate) {
        const roomName = `conversation:${payload.conversationId}`;
        this.server.to(roomName).emit("message.created", {
          messageId: result.message.messageId,
          conversationId: result.message.conversationId,
          senderId: result.message.senderId,
          content: result.message.content,
          createdAt: result.message.createdAt,
          clientMessageId: result.message.clientMessageId || null,
          type: result.message.type,
          url: result.message.url || null,
          duration:
            result.message.duration !== undefined
              ? result.message.duration
              : null,
          attachment: result.message.attachment || null,
        });
      }

      // 3. Acknowledge the sender
      return {
        success: true,
        status: "success",
        message: "Message persisted successfully",
        data: {
          message: result.message,
        },
        error: null,
      };
    } catch (err: any) {
      if (err.statusCode === 403 || err.errorCode === "FORBIDDEN") {
        throw new WsException({
          type: "FORBIDDEN",
          message: "You are not an authorized member of this conversation",
        });
      }
      if (
        err.statusCode === 404 ||
        err.errorCode === "CONVERSATION_NOT_FOUND"
      ) {
        throw new WsException({
          type: "NOT_FOUND",
          message: "Conversation not found",
        });
      }
      throw new WsException({
        type: err.errorCode || "BAD_REQUEST",
        message: err.message || "Could not send message",
      });
    }
  }

  private extractTokenFromHeader(header?: string): string | undefined {
    if (!header) return undefined;
    const [bearer, token] = header.split(" ");
    return bearer === "Bearer" ? token : undefined;
  }
}
