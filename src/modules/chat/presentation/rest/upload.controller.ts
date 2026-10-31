import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
  HttpStatus,
  HttpCode,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from "@nestjs/swagger";
import { Response } from "express";
import { JwtAuthGuard } from "../../../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../../../common/decorators/current-user.decorator";
import { AuthUser } from "../../../auth/domain/auth-user.interface";
import {
  UploadMediaDto,
  UploadMediaResponseData,
} from "../../application/dtos/upload-media.dto";
import { UploadMediaUseCase } from "../../application/use-cases/upload-media.use-case";
import { StorageService } from "../../infrastructure/storage/storage.service";

@ApiTags("Chat Upload")
@Controller()
export class ChatUploadController {
  constructor(
    private readonly uploadMediaUseCase: UploadMediaUseCase,
    private readonly storageService: StorageService,
  ) {}

  @Post(["chat/upload", "upload"])
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({
    summary: "Upload photo, video, file, or voice message",
    description:
      "Uploads a media or voice file via multipart/form-data. Returns the public accessible URL, media type, voice duration, and file metadata. The returned URL and type can then be sent via WebSocket `message.send`.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "Photo, video, audio/voice, or document file",
        },
        type: {
          type: "string",
          enum: ["image", "video", "voice", "file"],
          description:
            "Optional type hint. If omitted, will be auto-detected from file mime-type.",
        },
        duration: {
          type: "number",
          example: 12.5,
          description: "Duration in seconds (for voice messages)",
        },
        conversationId: {
          type: "string",
          format: "uuid",
          description:
            "Optional conversation UUID to verify membership permissions",
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "File uploaded successfully",
    type: UploadMediaResponseData,
  })
  public async upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadMediaDto,
  ): Promise<UploadMediaResponseData> {
    return this.uploadMediaUseCase.execute(user.id, file, dto);
  }

  @Get(["uploads/:fileName", "v1/chat/files/:fileName", "v1/uploads/:fileName"])
  @ApiOperation({
    summary: "Download or stream uploaded chat media/file",
    description:
      "Serves uploaded media and voice files with byte-range streaming support (HTTP 206 Partial Content) for audio/video scrub and playback.",
  })
  @ApiParam({ name: "fileName", description: "Stored unique filename" })
  @ApiResponse({
    status: 200,
    description: "Binary file stream",
  })
  @ApiResponse({
    status: 206,
    description: "Partial content for streaming audio/video seeking",
  })
  public serveFile(@Param("fileName") fileName: string, @Res() res: Response) {
    const filePath = this.storageService.getFilePath(fileName);

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");

    return res.sendFile(filePath);
  }
}
