import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import {
  IStorageEngine,
} from '../../domain/interfaces/storage-engine.interface';
import {
  StorageFileStream,
  StoredFileInput,
  StoredFileResult,
} from '../../domain/interfaces/stored-file.interface';

@Injectable()
export class LocalStorageService implements IStorageEngine {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly baseUploadDir: string;

  constructor(private readonly configService: ConfigService) {
    const configuredDir =
      this.configService.get<string>('UPLOADS_DIR') || 'uploads';
    this.baseUploadDir = path.isAbsolute(configuredDir)
      ? configuredDir
      : path.join(process.cwd(), configuredDir);

    this.ensureDirectory(this.baseUploadDir);
  }

  private ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Resolves and verifies that the destination path is strictly within the allowed root.
   */
  private getSafePath(assetType: string, filename: string): string {
    if (!assetType || !filename) {
      throw new BadRequestException('Invalid asset type or filename');
    }

    const rawType = assetType.trim();
    const rawFilename = filename.trim();

    // Guard against directory traversal and null bytes
    if (
      rawType.includes('..') ||
      rawType.includes('/') ||
      rawType.includes('\\') ||
      rawFilename.includes('..') ||
      rawFilename.includes('/') ||
      rawFilename.includes('\\') ||
      rawFilename.includes('\0')
    ) {
      throw new BadRequestException('Illegal path traversal detected');
    }

    const cleanType = path.basename(rawType.toLowerCase());
    const cleanFilename = path.basename(rawFilename);

    const typeDir = path.join(this.baseUploadDir, cleanType);
    const resolvedPath = path.resolve(typeDir, cleanFilename);

    // Guard against path traversal
    if (!resolvedPath.startsWith(path.resolve(this.baseUploadDir))) {
      throw new BadRequestException('Illegal path traversal detected');
    }

    return resolvedPath;
  }

  async save(file: StoredFileInput): Promise<StoredFileResult> {
    const cleanType = path.basename(file.assetType.toLowerCase().trim());
    const targetDir = path.join(this.baseUploadDir, cleanType);
    this.ensureDirectory(targetDir);

    const safeFilePath = this.getSafePath(file.assetType, file.filename);

    await fs.promises.writeFile(safeFilePath, file.buffer);

    this.logger.log(
      `[LocalStorage] Saved ${file.assetType}/${file.filename} (${file.buffer.length} bytes) to ${safeFilePath}`,
    );

    return {
      assetType: cleanType,
      filename: file.filename,
      storageKey: `${cleanType}/${file.filename}`,
      sizeBytes: file.buffer.length,
      mimeType: file.mimeType,
      storagePath: safeFilePath,
    };
  }

  async get(assetType: string, filename: string): Promise<StorageFileStream> {
    const filePath = this.getSafePath(assetType, filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(
        `Asset ${assetType}/${filename} not found in storage`,
      );
    }

    const stat = await fs.promises.stat(filePath);
    const readStream = fs.createReadStream(filePath);
    const etag = `W/"${stat.size}-${stat.mtime.getTime()}"`;

    return {
      stream: readStream,
      sizeBytes: stat.size,
      mimeType: this.detectMimeType(filename),
      lastModified: stat.mtime,
      etag,
    };
  }

  async exists(assetType: string, filename: string): Promise<boolean> {
    try {
      const filePath = this.getSafePath(assetType, filename);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  async delete(assetType: string, filename: string): Promise<boolean> {
    try {
      const filePath = this.getSafePath(assetType, filename);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch (err: any) {
      this.logger.error(
        `[LocalStorage] Failed to delete ${assetType}/${filename}: ${err.message}`,
      );
      return false;
    }
  }

  getStorageType(): string {
    return 'local';
  }

  private detectMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case '.svg':
        return 'image/svg+xml';
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      case '.gif':
        return 'image/gif';
      case '.pdf':
        return 'application/pdf';
      case '.mp3':
        return 'audio/mpeg';
      case '.ogg':
        return 'audio/ogg';
      case '.wav':
        return 'audio/wav';
      case '.webm':
        return 'audio/webm';
      default:
        return 'application/octet-stream';
    }
  }
}
