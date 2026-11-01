import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssetTypeRegistry } from './domain/asset-type-registry';
import { STORAGE_ENGINE } from './domain/interfaces/storage-engine.interface';
import { LocalStorageService } from './infrastructure/storage/local-storage.service';
import { S3StorageService } from './infrastructure/storage/s3-storage.service';
import { FilenameGeneratorService } from './application/services/filename-generator.service';
import { FileValidatorService } from './application/services/file-validator.service';
import { MediaUrlResolverService } from './application/services/media-url-resolver.service';
import { UploadMediaUseCase } from './application/use-cases/upload-media.use-case';
import { GetMediaStreamUseCase } from './application/use-cases/get-media-stream.use-case';
import { AssetsController } from './presentation/assets.controller';
import { MediaUploadController } from './presentation/media-upload.controller';

@Module({
  controllers: [AssetsController, MediaUploadController],
  providers: [
    AssetTypeRegistry,
    FilenameGeneratorService,
    FileValidatorService,
    MediaUrlResolverService,
    LocalStorageService,
    S3StorageService,
    {
      provide: STORAGE_ENGINE,
      useFactory: (
        configService: ConfigService,
        local: LocalStorageService,
        s3: S3StorageService,
      ) => {
        const driver = (
          configService.get<string>('STORAGE_DRIVER') || 'local'
        ).toLowerCase();
        return driver === 's3' ? s3 : local;
      },
      inject: [ConfigService, LocalStorageService, S3StorageService],
    },
    UploadMediaUseCase,
    GetMediaStreamUseCase,
  ],
  exports: [
    STORAGE_ENGINE,
    AssetTypeRegistry,
    FilenameGeneratorService,
    FileValidatorService,
    MediaUrlResolverService,
    UploadMediaUseCase,
    GetMediaStreamUseCase,
  ],
})
export class MediaModule {}
