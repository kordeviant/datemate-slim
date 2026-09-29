import { Test, TestingModule } from '@nestjs/testing';
import { UploadMediaUseCase } from './upload-media.use-case';
import { STORAGE_ENGINE } from '../../domain/interfaces/storage-engine.interface';
import { AssetTypeRegistry } from '../../domain/asset-type-registry';
import { FileValidatorService } from '../services/file-validator.service';
import { FilenameGeneratorService } from '../services/filename-generator.service';
import { MediaUrlResolverService } from '../services/media-url-resolver.service';
import { BadRequestException } from '@nestjs/common';

describe('UploadMediaUseCase', () => {
  let useCase: UploadMediaUseCase;
  let mockStorage: any;
  let mockUrlResolver: any;

  beforeEach(async () => {
    mockStorage = {
      save: jest.fn().mockImplementation((input: any) =>
        Promise.resolve({
          assetType: input.assetType,
          filename: input.filename,
          storageKey: `${input.assetType}/${input.filename}`,
          sizeBytes: input.buffer.length,
          mimeType: input.mimeType,
        }),
      ),
    };

    mockUrlResolver = {
      getPublicUrl: jest.fn(
        (type: string, filename: string) =>
          `http://localhost:3000/assets/${type}/${filename}`,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadMediaUseCase,
        AssetTypeRegistry,
        FilenameGeneratorService,
        FileValidatorService,
        { provide: STORAGE_ENGINE, useValue: mockStorage },
        { provide: MediaUrlResolverService, useValue: mockUrlResolver },
      ],
    }).compile();

    useCase = module.get<UploadMediaUseCase>(UploadMediaUseCase);
  });

  it('should upload an icon, store it by asset type, and return full public URL', async () => {
    const file: any = {
      originalname: 'star.svg',
      mimetype: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    };

    const result = await useCase.execute('icons', file);

    expect(result.assetType).toBe('icons');
    expect(result.filename.startsWith('icons_')).toBe(true);
    expect(result.filename.endsWith('.svg')).toBe(true);
    expect(result.publicUrl).toBe(
      `http://localhost:3000/assets/icons/${result.filename}`,
    );
    expect(result.relativePath).toBe(`icons/${result.filename}`);
    expect(result.mimeType).toBe('image/svg+xml');
    expect(result.sizeBytes).toBe(file.buffer.length);

    expect(mockStorage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        assetType: 'icons',
        filename: result.filename,
        mimeType: 'image/svg+xml',
      }),
    );
  });

  it('should upload an avatar, store it by asset type, and return full public URL', async () => {
    // Valid WebP header
    const webpHeader = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from('WEBP'),
    ]);
    const file: any = {
      originalname: 'photo.webp',
      mimetype: 'image/webp',
      buffer: Buffer.concat([webpHeader, Buffer.alloc(20 * 1024)]),
    };

    const result = await useCase.execute('avatars', file);

    expect(result.assetType).toBe('avatars');
    expect(result.filename.startsWith('avatars_')).toBe(true);
    expect(result.publicUrl).toBe(
      `http://localhost:3000/assets/avatars/${result.filename}`,
    );
  });

  it('should throw BadRequestException for missing file', async () => {
    await expect(useCase.execute('icons', undefined as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException for unsupported asset type', async () => {
    const file: any = {
      originalname: 'test.txt',
      buffer: Buffer.from('hello'),
    };

    await expect(useCase.execute('unsupported_type', file)).rejects.toThrow(
      /is not supported/,
    );
  });
});
