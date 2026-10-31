import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { MessageType } from "../../domain/enums/message-type.enum";

export interface StoredFileInfo {
  storedFileName: string;
  filePath: string;
  url: string;
  size: number;
  mimeType: string;
  originalName: string;
  detectedType: MessageType;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;
  private readonly publicBaseUrl?: string;

  private readonly dangerousExtensions = new Set([
    ".exe",
    ".bat",
    ".cmd",
    ".sh",
    ".php",
    ".phtml",
    ".pl",
    ".cgi",
    ".js",
    ".mjs",
    ".vbs",
    ".msi",
    ".dll",
    ".so",
    ".bin",
    ".com",
    ".scr",
    ".vbe",
    ".wsf",
    ".wsh",
    ".apk",
    ".jar",
  ]);

  constructor(private readonly configService: ConfigService) {
    this.uploadDir =
      this.configService.get<string>("storage.uploadDir") ||
      path.join(process.cwd(), "uploads");
    this.baseUrl =
      this.configService.get<string>("baseUrl") || "http://localhost:3001";
    this.publicBaseUrl = this.configService.get<string>(
      "storage.publicBaseUrl",
    );
  }

  onModuleInit() {
    this.ensureUploadDir();
  }

  public ensureUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Created storage directory at ${this.uploadDir}`);
    }
  }

  public getUploadDir(): string {
    return this.uploadDir;
  }

  public detectMessageType(mimeType: string, filename?: string): MessageType {
    const mime = (mimeType || "").toLowerCase();
    const ext = filename ? path.extname(filename).toLowerCase() : "";

    if (
      mime.startsWith("audio/") ||
      [
        ".ogg",
        ".mp3",
        ".wav",
        ".m4a",
        ".aac",
        ".amr",
        ".flac",
        ".opus",
        ".weba",
      ].includes(ext)
    ) {
      return MessageType.VOICE;
    }

    if (
      mime.startsWith("image/") ||
      [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".svg",
        ".bmp",
        ".heic",
        ".heif",
      ].includes(ext)
    ) {
      return MessageType.IMAGE;
    }

    if (
      mime.startsWith("video/") ||
      [".mp4", ".mov", ".webm", ".mkv", ".avi", ".3gp", ".m4v"].includes(ext)
    ) {
      return MessageType.VIDEO;
    }

    return MessageType.FILE;
  }

  public validateFile(file: Express.Multer.File): MessageType {
    if (!file) {
      throw new BadRequestException("No file provided for upload.");
    }

    if (!file.buffer && !file.path) {
      throw new BadRequestException("File buffer is empty.");
    }

    const originalName = file.originalname || "attachment";
    const ext = path.extname(originalName).toLowerCase();

    if (this.dangerousExtensions.has(ext)) {
      throw new BadRequestException(
        `File extension "${ext}" is not permitted for security reasons.`,
      );
    }

    const detectedType = this.detectMessageType(file.mimetype, originalName);
    const size = file.size || (file.buffer ? file.buffer.length : 0);

    // Specific size limits
    const maxAudioSize = 25 * 1024 * 1024; // 25 MB
    const maxImageSize = 20 * 1024 * 1024; // 20 MB
    const maxVideoSize = 100 * 1024 * 1024; // 100 MB
    const maxFileSize = 50 * 1024 * 1024; // 50 MB

    if (detectedType === MessageType.VOICE && size > maxAudioSize) {
      throw new BadRequestException(
        "Voice/audio file size exceeds 25 MB limit.",
      );
    }
    if (detectedType === MessageType.IMAGE && size > maxImageSize) {
      throw new BadRequestException("Image file size exceeds 20 MB limit.");
    }
    if (detectedType === MessageType.VIDEO && size > maxVideoSize) {
      throw new BadRequestException("Video file size exceeds 100 MB limit.");
    }
    if (detectedType === MessageType.FILE && size > maxFileSize) {
      throw new BadRequestException("Document file size exceeds 50 MB limit.");
    }

    return detectedType;
  }

  public async saveFile(file: Express.Multer.File): Promise<StoredFileInfo> {
    const detectedType = this.validateFile(file);
    this.ensureUploadDir();

    const originalName = file.originalname || "attachment";
    const ext =
      path.extname(originalName).toLowerCase() ||
      this.guessExtension(file.mimetype);
    const storedFileName = `${uuidv4()}${ext}`;
    const destinationPath = path.join(this.uploadDir, storedFileName);

    if (file.buffer) {
      await fs.promises.writeFile(destinationPath, file.buffer);
    } else if (file.path) {
      await fs.promises.copyFile(file.path, destinationPath);
    }

    const size = file.size || (file.buffer ? file.buffer.length : 0);
    const mimeType = file.mimetype || "application/octet-stream";

    const hostBase = (this.publicBaseUrl || this.baseUrl).replace(/\/+$/, "");
    const url = `${hostBase}/uploads/${storedFileName}`;

    return {
      storedFileName,
      filePath: destinationPath,
      url,
      size,
      mimeType,
      originalName,
      detectedType,
    };
  }

  public getFilePath(storedFileName: string): string {
    const safeName = path.basename(storedFileName);
    const fullPath = path.join(this.uploadDir, safeName);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException(`File "${safeName}" not found.`);
    }
    return fullPath;
  }

  private guessExtension(mimeType?: string): string {
    if (!mimeType) return "";
    const lower = mimeType.toLowerCase();
    if (lower.includes("jpeg") || lower.includes("jpg")) return ".jpg";
    if (lower.includes("png")) return ".png";
    if (lower.includes("webp")) return ".webp";
    if (lower.includes("gif")) return ".gif";
    if (lower.includes("ogg")) return ".ogg";
    if (lower.includes("mpeg") || lower.includes("mp3")) return ".mp3";
    if (lower.includes("mp4")) return ".mp4";
    if (lower.includes("webm")) return ".webm";
    if (lower.includes("wav")) return ".wav";
    if (lower.includes("pdf")) return ".pdf";
    return "";
  }
}
