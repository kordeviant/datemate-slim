import { ChatUsersController as UsersController } from "../presentation/rest/users.controller";
import { UserPresenceService } from "../application/services/user-presence.service";
import { MockUserPresenceRepository } from "./mocks/mock-repositories";

describe("UsersController", () => {
  let controller: UsersController;
  let presenceService: UserPresenceService;
  let mockRepo: MockUserPresenceRepository;

  beforeEach(() => {
    mockRepo = new MockUserPresenceRepository();
    presenceService = new UserPresenceService(mockRepo as any);
    controller = new UsersController(presenceService);
  });

  it("should return single user activity", async () => {
    await presenceService.handleUserConnected(99, "s-99");

    const result = await controller.getUserActivity(99);
    expect(result.userId).toBe(99);
    expect(result.isOnline).toBe(true);
  });

  it("should return batch user activities", async () => {
    await presenceService.handleUserConnected(10, "s-10");
    await mockRepo.upsertPresence(20, false, new Date("2026-10-27T12:00:00Z"));

    const response = await controller.getBatchUserActivity({ userIds: [10, 20] });
    expect(response.activities).toHaveLength(2);

    const user10 = response.activities.find((a) => a.userId === 10);
    const user20 = response.activities.find((a) => a.userId === 20);

    expect(user10?.isOnline).toBe(true);
    expect(user20?.isOnline).toBe(false);
    expect(user20?.lastSeenAt).toBe(new Date("2026-10-27T12:00:00Z").toISOString());
  });
});
