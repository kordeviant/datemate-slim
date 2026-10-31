import { ConfigService } from "@nestjs/config";
import { GetMessageHistoryUseCase } from "../application/use-cases/get-message-history.use-case";
import { ChatAuthorizationService } from "../application/services/chat-authorization.service";
import {
  MockMessageRepository,
  MockConversationRepository,
  MockConversationMemberRepository,
} from "./mocks/mock-repositories";
import { Conversation } from "../domain/entities/conversation.entity";
import { ConversationMember } from "../domain/entities/conversation-member.entity";
import { Message } from "../domain/entities/message.entity";
import { ConversationType } from "../domain/enums/conversation-type.enum";
import { MemberRole } from "../domain/enums/member-role.enum";
import { TimeBucketUtil } from "@common/utils/time-bucket.util";

describe("GetMessageHistoryUseCase", () => {
  let useCase: GetMessageHistoryUseCase;
  let msgRepo: MockMessageRepository;
  let convRepo: MockConversationRepository;
  let memberRepo: MockConversationMemberRepository;
  let authService: ChatAuthorizationService;

  beforeEach(() => {
    msgRepo = new MockMessageRepository();
    convRepo = new MockConversationRepository();
    memberRepo = new MockConversationMemberRepository();
    authService = new ChatAuthorizationService(convRepo, memberRepo);

    const configService = {
      get: jest.fn((key: string) => {
        if (key === "chat.defaultPageSize") return 50;
        if (key === "chat.maxPageSize") return 100;
        return null;
      }),
    } as unknown as ConfigService;

    useCase = new GetMessageHistoryUseCase(msgRepo, convRepo, authService, configService);
  });

  it("should return messages newest first", async () => {
    const convId = "c1";
    const bucket = TimeBucketUtil.getBucket();

    await convRepo.create(
      new Conversation({
        conversationId: convId,
        conversationType: ConversationType.DIRECT,
        createdBy: 1,
        createdAt: new Date(),
      }),
    );
    await memberRepo.addMember(new ConversationMember({ conversationId: convId, userId: 1, joinedAt: new Date(), role: MemberRole.OWNER }));

    await msgRepo.save(new Message({ conversationId: convId, bucket, createdAt: "1000", messageId: "m1", senderId: 1, content: "First" }));
    await msgRepo.save(new Message({ conversationId: convId, bucket, createdAt: "2000", messageId: "m2", senderId: 1, content: "Second" }));

    const res = await useCase.execute(convId, 1, {});
    expect(res.items.length).toBe(2);
    expect(res.items[0].messageId).toBe("m2");
    expect(res.items[1].messageId).toBe("m1");
  });
});
