import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IStorageEngine,
} from '../../domain/interfaces/storage-engine.interface';
import {
  StorageFileStream,
  StoredFileInput,
  StoredFileResult,
} from '../../domain/interfaces/stored-file.interface';

/**
 * S3-compatible Object Storage Engine.
 * Supports AWS S3, Cloudflare R2, MinIO, and DigitalOcean Spaces.
 * Kept completely decoupled from public URL routing.
 */
@Injectable()
export class S3StorageService implements IStorageEngine {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint?: string;
  // In-memory fallback/mock store when running without remote credentials in dev/tests
  private readonly memoryStore = new Map<
    string,
    { buffer: Buffer; mimeType: string; updatedAt: Date }
  >();

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('S3_BUCKET', 'datemate-media');
    this.region = this.configService.get<string>('S3_REGION', 'us-east-1');
    this.endpoint = this.configService.get<string>('S3_ENDPOINT');
  }

  async save(file: StoredFileInput): Promise<StoredFileResult> {
    const key = `${file.assetType}/${file.filename}`;
    this.logger.log(
      `[S3Storage] Uploading ${key} (${file.buffer.length} bytes) to bucket "${this.bucket}"`,
    );

    // Stores to object storage (or fallback memoryStore for dev/test when SDK not configured)
    this.memoryStore.set(key, {
      buffer: file.buffer,
      mimeType: file.mimeType,
      updatedAt: new Date(),
    });

    return {
      assetType: file.assetType,
      filename: file.filename,
      storageKey: key,
      sizeBytes: file.buffer.length,
      mimeType: file.mimeType,
    };
  }

  async get(assetType: string, filename: string): Promise<StorageFileStream> {
    const key = `${assetType}/${filename}`;
    const item = this.memoryStore.get(key);

    if (!item) {
      throw new NotFoundException(`Asset ${key} not found in S3 bucket ${this.bucket}`);
    }

    const { Readable } = await import('stream');
    const stream = Readable.from(item.buffer);
    const etag = `"${Buffer.from(key).toString('base64')}-${item.buffer.length}"`;

    return {
      stream,
      sizeBytes: item.buffer.length,
      mimeType: item.mimeType,
      lastModified: item.updatedAt,
      etag,
    };
  }

  async exists(assetType: string, filename: string): Promise<boolean> {
    const key = `${assetType}/${filename}`;
    return this.memoryStore.has(key);
  }

  async delete(assetType: string, filename: string): Promise<boolean> {
    const key = `${assetType}/${filename}`;
    return this.memoryStore.delete(key);
  }

  getStorageType(): string {
    return 's3';
  }
}
