import { Injectable, BadRequestException } from "@nestjs/common";
import { StorageService } from "../../infrastructure/storage/storage.service";
import { ChatAuthorizationService } from "../services/chat-authorization.service";
import {
  UploadMediaDto,
  UploadMediaResponseData,
} from "../dtos/upload-media.dto";
import {
  MessageType,
  normalizeMessageType,
} from "../../domain/enums/message-type.enum";

@Injectable()
export class UploadMediaUseCase {
  constructor(
    private readonly storageService: StorageService,
    private readonly authService: ChatAuthorizationService,
  ) {}

  public async execute(
    userId: number,
    file: Express.Multer.File,
    dto: UploadMediaDto = {},
  ): Promise<UploadMediaResponseData> {
    if (!file) {
      throw new BadRequestException("No file provided for upload");
    }

    // If conversationId was specified, enforce membership authorization
    if (dto.conversationId) {
      await this.authService.assertMembership(dto.conversationId, userId);
    }

    const storedInfo = await this.storageService.saveFile(file);

    const resolvedType: MessageType = dto.type
      ? normalizeMessageType(dto.type)
      : storedInfo.detectedType;

    let resolvedDuration: number | null = null;
    if (dto.duration !== undefined && dto.duration !== null) {
      const parsed = Number(dto.duration);
      if (!isNaN(parsed) && parsed >= 0) {
        resolvedDuration = parsed;
      }
    }

    return {
      url: storedInfo.url,
      type: resolvedType,
      duration: resolvedDuration,
      fileName: storedInfo.originalName,
      storedFileName: storedInfo.storedFileName,
      mimeType: storedInfo.mimeType,
      size: storedInfo.size,
    };
  }
}
