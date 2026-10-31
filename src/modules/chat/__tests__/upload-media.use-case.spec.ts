import { ConfigService } from "@nestjs/config";
import { BadRequestException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { UploadMediaUseCase } from "../application/use-cases/upload-media.use-case";
import { StorageService } from "../infrastructure/storage/storage.service";
import { ChatAuthorizationService } from "../application/services/chat-authorization.service";
import { ConversationForbiddenException } from "../domain/exceptions/conversation-forbidden.exception";
import {
  MockConversationRepository,
  MockConversationMemberRepository,
} from "./mocks/mock-repositories";
import { Conversation } from "../domain/entities/conversation.entity";
import { ConversationMember } from "../domain/entities/conversation-member.entity";
import { ConversationType } from "../domain/enums/conversation-type.enum";
import { MemberRole } from "../domain/enums/member-role.enum";
import { MessageType } from "../domain/enums/message-type.enum";

describe("UploadMediaUseCase & StorageService", () => {
  let useCase: UploadMediaUseCase;
  let storageService: StorageService;
  let convRepo: MockConversationRepository;
  let memberRepo: MockConversationMemberRepository;
  let authService: ChatAuthorizationService;

  const testUploadDir = path.join(__dirname, "../temp-uploads");

  beforeEach(() => {
    convRepo = new MockConversationRepository();
    memberRepo = new MockConversationMemberRepository();
    authService = new ChatAuthorizationService(convRepo, memberRepo);

    const configService = {
      get: jest.fn((key: string) => {
        if (key === "storage.uploadDir") return testUploadDir;
        if (key === "baseUrl") return "http://localhost:3001";
        return null;
      }),
    } as unknown as ConfigService;

    storageService = new StorageService(configService);
    useCase = new UploadMediaUseCase(storageService, authService);
  });

  afterEach(() => {
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  it("should upload image successfully and detect type", async () => {
    const file = {
      originalname: "avatar.png",
      mimetype: "image/png",
      buffer: Buffer.from("fake-png-data"),
      size: 13,
    } as Express.Multer.File;

    const result = await useCase.execute(1, file);

    expect(result.type).toBe(MessageType.IMAGE);
    expect(result.fileName).toBe("avatar.png");
    expect(result.mimeType).toBe("image/png");
    expect(result.url).toContain("http://localhost:3001/uploads/");
    expect(result.url).toMatch(/\.png$/);
    expect(fs.existsSync(path.join(testUploadDir, result.storedFileName))).toBe(
      true,
    );
  });

  it("should upload voice message with duration and detect type", async () => {
    const file = {
      originalname: "voice_note.ogg",
      mimetype: "audio/ogg",
      buffer: Buffer.from("fake-ogg-audio"),
      size: 14,
    } as Express.Multer.File;

    const result = await useCase.execute(1, file, { duration: 18.5 });

    expect(result.type).toBe(MessageType.VOICE);
    expect(result.duration).toBe(18.5);
    expect(result.fileName).toBe("voice_note.ogg");
    expect(result.mimeType).toBe("audio/ogg");
    expect(result.url).toMatch(/\.ogg$/);
  });

  it("should upload video and document files properly", async () => {
    const videoFile = {
      originalname: "clip.mp4",
      mimetype: "video/mp4",
      buffer: Buffer.from("fake-mp4-data"),
      size: 13,
    } as Express.Multer.File;

    const videoResult = await useCase.execute(1, videoFile);
    expect(videoResult.type).toBe(MessageType.VIDEO);

    const docFile = {
      originalname: "contract.pdf",
      mimetype: "application/pdf",
      buffer: Buffer.from("fake-pdf-data"),
      size: 13,
    } as Express.Multer.File;

    const docResult = await useCase.execute(1, docFile);
    expect(docResult.type).toBe(MessageType.FILE);
  });

  it("should reject dangerous executable files", async () => {
    const evilFile = {
      originalname: "malware.exe",
      mimetype: "application/x-msdownload",
      buffer: Buffer.from("evil-data"),
      size: 9,
    } as Express.Multer.File;

    await expect(useCase.execute(1, evilFile)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("should reject oversized files per type", async () => {
    const hugeAudio = {
      originalname: "big.ogg",
      mimetype: "audio/ogg",
      buffer: Buffer.alloc(10),
      size: 30 * 1024 * 1024, // 30 MB > 25 MB limit
    } as Express.Multer.File;

    await expect(useCase.execute(1, hugeAudio)).rejects.toThrow("25 MB limit");
  });

  it("should enforce conversation membership when conversationId is provided", async () => {
    const convId = "a1a8ecf4-4a25-4c07-b30a-2fb6f6cf557a";
    await convRepo.create(
      new Conversation({
        conversationId: convId,
        conversationType: ConversationType.DIRECT,
        createdBy: 1,
        createdAt: new Date(),
      }),
    );
    await memberRepo.addMember(
      new ConversationMember({
        conversationId: convId,
        userId: 1,
        joinedAt: new Date(),
        role: MemberRole.OWNER,
      }),
    );

    const file = {
      originalname: "photo.jpg",
      mimetype: "image/jpeg",
      buffer: Buffer.from("data"),
      size: 4,
    } as Express.Multer.File;

    // Authorized user (userId 1)
    const success = await useCase.execute(1, file, { conversationId: convId });
    expect(success.type).toBe(MessageType.IMAGE);

    // Unauthorized user (userId 99)
    await expect(
      useCase.execute(99, file, { conversationId: convId }),
    ).rejects.toThrow(ConversationForbiddenException);
  });
});
