import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CassandraModule } from "./infrastructure/cassandra/cassandra.module";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ChatAuthorizationService } from "./application/services/chat-authorization.service";
import { CreateConversationUseCase } from "./application/use-cases/create-conversation.use-case";
import { ListUserConversationsUseCase } from "./application/use-cases/list-user-conversations.use-case";
import { GetConversationDetailsUseCase } from "./application/use-cases/get-conversation-details.use-case";
import { GetMessageHistoryUseCase } from "./application/use-cases/get-message-history.use-case";
import { SendMessageUseCase } from "./application/use-cases/send-message.use-case";
import { UploadMediaUseCase } from "./application/use-cases/upload-media.use-case";
import { ConversationsController } from "./presentation/rest/conversations.controller";
import { ChatUploadController } from "./presentation/rest/upload.controller";
import { ChatGateway } from "./presentation/ws/chat.gateway";
import { PushNotificationService } from "./infrastructure/push-notification/push-notification.service";
import { StorageService } from "./infrastructure/storage/storage.service";
import { GroupsController } from "./presentation/rest/groups.controller";
import { ChatUsersController } from "./presentation/rest/users.controller";
import { GroupUseCases } from "./application/use-cases/group.use-cases";
import { UserPresenceService } from "./application/services/user-presence.service";

@Module({
  imports: [ConfigModule, CassandraModule, AuthModule, NotificationsModule],
  controllers: [
    ConversationsController,
    GroupsController,
    ChatUsersController,
    ChatUploadController,
  ],
  providers: [
    ChatAuthorizationService,
    CreateConversationUseCase,
    ListUserConversationsUseCase,
    GetConversationDetailsUseCase,
    GetMessageHistoryUseCase,
    SendMessageUseCase,
    UploadMediaUseCase,
    StorageService,
    ChatGateway,
    PushNotificationService,
    GroupUseCases,
    UserPresenceService,
  ],
  exports: [
    ChatAuthorizationService,
    CreateConversationUseCase,
    ListUserConversationsUseCase,
    GetConversationDetailsUseCase,
    GetMessageHistoryUseCase,
    SendMessageUseCase,
    UploadMediaUseCase,
    StorageService,
    ChatGateway,
    PushNotificationService,
    GroupUseCases,
    UserPresenceService,
  ],
})
export class ChatModule {}
