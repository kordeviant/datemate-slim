import { Injectable, Inject, Logger } from "@nestjs/common";
import {
  IUserPresenceRepository,
  UserPresenceRecord,
} from "../../domain/repositories/user-presence.repository.interface";
import { UserActivityDto } from "../dtos/user-activity.dto";

@Injectable()
export class UserPresenceService {
  private readonly logger = new Logger(UserPresenceService.name);

  // In-memory socket tracking: userId -> Set of active socket IDs
  private readonly activeSocketsByUser = new Map<number, Set<string>>();

  // Reverse mapping: socketId -> userId
  private readonly socketToUser = new Map<string, number>();

  // Sockets to rooms joined: socketId -> Set of roomNames (e.g. "conversation:uuid")
  private readonly socketRooms = new Map<string, Set<string>>();

  // In-memory presence cache: userId -> { isOnline: boolean, lastSeenAt: Date | null }
  private readonly presenceCache = new Map<number, { isOnline: boolean; lastSeenAt: Date | null }>();

  // Offline debouncing: userId -> Timeout
  private readonly offlineDebounceTimers = new Map<number, NodeJS.Timeout>();

  private readonly DEBOUNCE_MS = 3000;

  constructor(
    @Inject("IUserPresenceRepository")
    private readonly presenceRepo: IUserPresenceRepository,
  ) {}

  /**
   * Called when a client authenticates via WebSocket.
   * Returns whether the user's online state changed (offline -> online).
   */
  public async handleUserConnected(userId: number, socketId: string): Promise<{ changed: boolean; isOnline: boolean }> {
    // 1. Cancel pending offline debounce timer if user quickly reconnected
    const existingTimer = this.offlineDebounceTimers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.offlineDebounceTimers.delete(userId);
    }

    // 2. Register socket in memory
    let socketSet = this.activeSocketsByUser.get(userId);
    if (!socketSet) {
      socketSet = new Set<string>();
      this.activeSocketsByUser.set(userId, socketSet);
    }
    const wasOnline = socketSet.size > 0;
    socketSet.add(socketId);
    this.socketToUser.set(socketId, userId);

    const isNewlyOnline = !wasOnline;
    if (isNewlyOnline) {
      const now = new Date();
      this.presenceCache.set(userId, { isOnline: true, lastSeenAt: now });

      // Async write to Cassandra (non-blocking for performance)
      this.presenceRepo.upsertPresence(userId, true, now).catch((err) => {
        this.logger.warn(`Failed writing presence to Cassandra for user ${userId}: ${err.message}`);
      });

      return { changed: true, isOnline: true };
    }

    return { changed: false, isOnline: true };
  }

  // User to rooms joined: userId -> Set of roomNames
  private readonly userRooms = new Map<number, Set<string>>();

  /**
   * Tracks a room joined by a socket.
   */
  public trackSocketRoom(userId: number, socketId: string, roomName: string): void {
    let rooms = this.socketRooms.get(socketId);
    if (!rooms) {
      rooms = new Set<string>();
      this.socketRooms.set(socketId, rooms);
    }
    rooms.add(roomName);

    let uRooms = this.userRooms.get(userId);
    if (!uRooms) {
      uRooms = new Set<string>();
      this.userRooms.set(userId, uRooms);
    }
    uRooms.add(roomName);
  }

  /**
   * Tracks leaving a room.
   */
  public untrackSocketRoom(userId: number, socketId: string, roomName: string): void {
    const rooms = this.socketRooms.get(socketId);
    if (rooms) {
      rooms.delete(roomName);
    }

    let stillInRoom = false;
    const userSockets = this.activeSocketsByUser.get(userId);
    if (userSockets) {
      for (const sId of userSockets) {
        if (sId !== socketId && this.socketRooms.get(sId)?.has(roomName)) {
          stillInRoom = true;
          break;
        }
      }
    }
    if (!stillInRoom) {
      this.userRooms.get(userId)?.delete(roomName);
    }
  }

  /**
   * Returns all conversation rooms a socket was in.
   */
  public getSocketRooms(socketId: string): string[] {
    const rooms = this.socketRooms.get(socketId);
    return rooms ? Array.from(rooms) : [];
  }

  /**
   * Called when a client disconnects.
   * Debounces offline transition by 3s to prevent flickering on fast reconnects.
   */
  public handleUserDisconnected(
    socketId: string,
    onOfflineTransition?: (userId: number, lastSeenAt: Date, rooms: string[]) => void,
  ): void {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return;

    this.socketToUser.delete(socketId);
    this.socketRooms.delete(socketId);

    const socketSet = this.activeSocketsByUser.get(userId);
    if (socketSet) {
      socketSet.delete(socketId);
      if (socketSet.size === 0) {
        this.activeSocketsByUser.delete(userId);

        // Start debounce timer
        const timer = setTimeout(() => {
          this.offlineDebounceTimers.delete(userId);

          // Check if still offline
          const currentSockets = this.activeSocketsByUser.get(userId);
          if (!currentSockets || currentSockets.size === 0) {
            const now = new Date();
            this.presenceCache.set(userId, { isOnline: false, lastSeenAt: now });

            const roomsJoined = Array.from(this.userRooms.get(userId) || []);
            this.userRooms.delete(userId);

            this.presenceRepo.upsertPresence(userId, false, now).catch((err) => {
              this.logger.warn(`Failed writing offline presence to Cassandra for user ${userId}: ${err.message}`);
            });

            if (onOfflineTransition) {
              onOfflineTransition(userId, now, roomsJoined);
            }
          }
        }, this.DEBOUNCE_MS);

        this.offlineDebounceTimers.set(userId, timer);
      }
    }
  }

  /**
   * Check if user is currently online in memory (O(1)).
   */
  public isUserOnline(userId: number): boolean {
    const socketSet = this.activeSocketsByUser.get(userId);
    return Boolean(socketSet && socketSet.size > 0);
  }

  /**
   * Get single user activity with in-memory fast-path.
   */
  public async getUserActivity(userId: number): Promise<UserActivityDto> {
    if (this.isUserOnline(userId)) {
      return {
        userId,
        isOnline: true,
        lastSeenAt: null,
      };
    }

    const cached = this.presenceCache.get(userId);
    if (cached) {
      return {
        userId,
        isOnline: cached.isOnline,
        lastSeenAt: cached.lastSeenAt ? cached.lastSeenAt.toISOString() : null,
      };
    }

    // Fallback to Cassandra
    try {
      const record = await this.presenceRepo.findById(userId);
      if (record) {
        this.presenceCache.set(userId, {
          isOnline: record.isOnline,
          lastSeenAt: record.lastSeenAt,
        });
        return {
          userId,
          isOnline: record.isOnline,
          lastSeenAt: record.lastSeenAt ? record.lastSeenAt.toISOString() : null,
        };
      }
    } catch (err: any) {
      this.logger.error(`Error querying user presence from Cassandra for user ${userId}: ${err.message}`);
    }

    // Default never seen
    const defaultVal = { isOnline: false, lastSeenAt: null };
    this.presenceCache.set(userId, defaultVal);
    return {
      userId,
      isOnline: false,
      lastSeenAt: null,
    };
  }

  /**
   * High performance batch presence retrieval.
   * Resolves in-memory first; missing entries are queried in ONE Cassandra IN query.
   */
  public async getUserActivityBatch(userIds: number[]): Promise<Map<number, UserActivityDto>> {
    const result = new Map<number, UserActivityDto>();
    if (!userIds || userIds.length === 0) {
      return result;
    }

    const uniqueIds = Array.from(new Set(userIds));
    const missingIds: number[] = [];

    for (const id of uniqueIds) {
      if (this.isUserOnline(id)) {
        result.set(id, { userId: id, isOnline: true, lastSeenAt: null });
        continue;
      }

      const cached = this.presenceCache.get(id);
      if (cached) {
        result.set(id, {
          userId: id,
          isOnline: cached.isOnline,
          lastSeenAt: cached.lastSeenAt ? cached.lastSeenAt.toISOString() : null,
        });
        continue;
      }

      missingIds.push(id);
    }

    if (missingIds.length > 0) {
      let records = new Map<number, UserPresenceRecord>();
      try {
        records = await this.presenceRepo.findBatch(missingIds);
      } catch (err: any) {
        this.logger.error(`Error querying user presence batch from Cassandra: ${err.message}`);
      }

      for (const id of missingIds) {
        const rec = records.get(id);
        if (rec) {
          this.presenceCache.set(id, {
            isOnline: rec.isOnline,
            lastSeenAt: rec.lastSeenAt,
          });
          result.set(id, {
            userId: id,
            isOnline: rec.isOnline,
            lastSeenAt: rec.lastSeenAt ? rec.lastSeenAt.toISOString() : null,
          });
        } else {
          this.presenceCache.set(id, { isOnline: false, lastSeenAt: null });
          result.set(id, {
            userId: id,
            isOnline: false,
            lastSeenAt: null,
          });
        }
      }
    }

    return result;
  }
}
