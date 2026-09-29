import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  IStorageEngine,
  STORAGE_ENGINE,
} from '../../domain/interfaces/storage-engine.interface';
import { AssetTypeRegistry } from '../../domain/asset-type-registry';
import { FileValidatorService } from '../services/file-validator.service';
import { FilenameGeneratorService } from '../services/filename-generator.service';
import { MediaUrlResolverService } from '../services/media-url-resolver.service';
import { MediaUploadResponseDto } from '../dtos/media-response.dto';

@Injectable()
export class UploadMediaUseCase {
  private readonly logger = new Logger(UploadMediaUseCase.name);

  constructor(
    @Inject(STORAGE_ENGINE)
    private readonly storage: IStorageEngine,
    private readonly registry: AssetTypeRegistry,
    private readonly fileValidator: FileValidatorService,
    private readonly filenameGenerator: FilenameGeneratorService,
    private readonly urlResolver: MediaUrlResolverService,
  ) {}

  async execute(
    assetType: string,
    file?: Express.Multer.File,
    originalName?: string,
  ): Promise<MediaUploadResponseDto> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided for upload');
    }

    const cleanType = assetType.toLowerCase().trim();
    if (!this.registry.isSupported(cleanType)) {
      throw new BadRequestException(
        `Asset type "${cleanType}" is not supported. Supported types: ${this.registry.getAllSupportedTypes().join(', ')}`,
      );
    }

    // 1. Binary validation, magic bytes, and size checking
    const { validatedMimeType } = this.fileValidator.validate(
      file.buffer,
      cleanType,
      file.mimetype,
    );

    // 2. Generate safe, unique, collision-proof filename
    const filename = this.filenameGenerator.generateUniqueFilename(
      cleanType,
      originalName || file.originalname,
      validatedMimeType,
    );

    // 3. Save via abstract storage engine (decoupled from public URL)
    const stored = await this.storage.save({
      assetType: cleanType,
      filename,
      buffer: file.buffer,
      mimeType: validatedMimeType,
    });

    // 4. Resolve the full public URL using the configured baseUrl
    const publicUrl = this.urlResolver.getPublicUrl(cleanType, filename);
    const relativePath = `${cleanType}/${filename}`;

    this.logger.log(
      `[MediaUpload] Successfully uploaded ${cleanType}/${filename} (${stored.sizeBytes} bytes) -> ${publicUrl}`,
    );

    return {
      filename,
      assetType: cleanType,
      publicUrl,
      relativePath,
      mimeType: validatedMimeType,
      sizeBytes: stored.sizeBytes,
      createdAt: new Date().toISOString(),
    };
  }
}
