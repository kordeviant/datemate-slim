import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IStorageEngine,
  STORAGE_ENGINE,
} from '../../domain/interfaces/storage-engine.interface';
import { StorageFileStream } from '../../domain/interfaces/stored-file.interface';
import { AssetTypeRegistry } from '../../domain/asset-type-registry';
import { FilenameGeneratorService } from '../services/filename-generator.service';

@Injectable()
export class GetMediaStreamUseCase {
  constructor(
    @Inject(STORAGE_ENGINE)
    private readonly storage: IStorageEngine,
    private readonly registry: AssetTypeRegistry,
    private readonly filenameGenerator: FilenameGeneratorService,
  ) {}

  async execute(assetType: string, filename: string): Promise<StorageFileStream> {
    const cleanType = assetType.toLowerCase().trim();

    if (!this.registry.isSupported(cleanType)) {
      throw new NotFoundException(`Asset category "${cleanType}" not found`);
    }

    let decodedFilename = filename;
    try {
      decodedFilename = decodeURIComponent(filename);
    } catch {
      decodedFilename = filename;
    }

    if (!this.filenameGenerator.isSafeFilename(decodedFilename)) {
      throw new BadRequestException('Invalid filename or path traversal detected');
    }

    return this.storage.get(cleanType, decodedFilename);
  }
}

