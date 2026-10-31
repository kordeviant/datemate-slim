import { UserPresenceService } from "../application/services/user-presence.service";
import { MockUserPresenceRepository } from "./mocks/mock-repositories";

describe("UserPresenceService", () => {
  let service: UserPresenceService;
  let mockRepo: MockUserPresenceRepository;

  beforeEach(() => {
    mockRepo = new MockUserPresenceRepository();
    service = new UserPresenceService(mockRepo as any);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should mark user online on connection and write to repo", async () => {
    const res = await service.handleUserConnected(42, "socket-1");
    expect(res.changed).toBe(true);
    expect(res.isOnline).toBe(true);
    expect(service.isUserOnline(42)).toBe(true);

    const activity = await service.getUserActivity(42);
    expect(activity.isOnline).toBe(true);
    expect(activity.lastSeenAt).toBeNull();

    // Verify repo was called
    const repoRecord = await mockRepo.findById(42);
    expect(repoRecord).toBeDefined();
    expect(repoRecord?.isOnline).toBe(true);
  });

  it("should not trigger changed flag if user connects a second socket while already online", async () => {
    await service.handleUserConnected(42, "socket-1");
    const res2 = await service.handleUserConnected(42, "socket-2");
    expect(res2.changed).toBe(false);
    expect(res2.isOnline).toBe(true);
  });

  it("should debounce offline state by 3 seconds on disconnect", async () => {
    await service.handleUserConnected(42, "socket-1");
    service.trackSocketRoom(42, "socket-1", "conversation:room-123");

    const offlineCallback = jest.fn();
    service.handleUserDisconnected("socket-1", offlineCallback);

    // Immediately after disconnect, still considered online or pending
    expect(offlineCallback).not.toHaveBeenCalled();

    // Fast reconnect within 2 seconds cancels debounce
    jest.advanceTimersByTime(2000);
    expect(offlineCallback).not.toHaveBeenCalled();

    // Reconnect socket-2
    await service.handleUserConnected(42, "socket-2");

    // Advance remaining time
    jest.advanceTimersByTime(2000);
    expect(offlineCallback).not.toHaveBeenCalled();
    expect(service.isUserOnline(42)).toBe(true);

    // Now disconnect socket-2 and let debounce expire
    service.handleUserDisconnected("socket-2", offlineCallback);
    jest.advanceTimersByTime(3500);

    expect(offlineCallback).toHaveBeenCalledTimes(1);
    expect(offlineCallback).toHaveBeenCalledWith(42, expect.any(Date), ["conversation:room-123"]);
    expect(service.isUserOnline(42)).toBe(false);

    const activity = await service.getUserActivity(42);
    expect(activity.isOnline).toBe(false);
    expect(activity.lastSeenAt).not.toBeNull();
  });

  it("should batch fetch user presence using in-memory cache and repository fallback", async () => {
    // User 1 is currently online
    await service.handleUserConnected(1, "s-1");

    // User 2 was previously persisted in repo as offline
    await mockRepo.upsertPresence(2, false, new Date("2026-10-27T10:00:00Z"));

    // User 3 never seen
    const result = await service.getUserActivityBatch([1, 2, 3]);

    expect(result.size).toBe(3);
    expect(result.get(1)?.isOnline).toBe(true);
    expect(result.get(1)?.lastSeenAt).toBeNull();

    expect(result.get(2)?.isOnline).toBe(false);
    expect(result.get(2)?.lastSeenAt).toBe(new Date("2026-10-27T10:00:00Z").toISOString());

    expect(result.get(3)?.isOnline).toBe(false);
    expect(result.get(3)?.lastSeenAt).toBeNull();
  });
});
