import { Test, TestingModule } from '@nestjs/testing';
import { GetMediaStreamUseCase } from './get-media-stream.use-case';
import { STORAGE_ENGINE } from '../../domain/interfaces/storage-engine.interface';
import { AssetTypeRegistry } from '../../domain/asset-type-registry';
import { FilenameGeneratorService } from '../services/filename-generator.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('GetMediaStreamUseCase', () => {
  let useCase: GetMediaStreamUseCase;
  let mockStorage: any;

  beforeEach(async () => {
    mockStorage = {
      get: jest.fn().mockResolvedValue({
        stream: Buffer.from('data'),
        sizeBytes: 4,
        mimeType: 'image/svg+xml',
        etag: '"123"',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetMediaStreamUseCase,
        AssetTypeRegistry,
        FilenameGeneratorService,
        { provide: STORAGE_ENGINE, useValue: mockStorage },
      ],
    }).compile();

    useCase = module.get<GetMediaStreamUseCase>(GetMediaStreamUseCase);
  });

  it('should retrieve asset stream for supported asset type and safe filename', async () => {
    const result = await useCase.execute('icons', 'badge_123.svg');

    expect(result.mimeType).toBe('image/svg+xml');
    expect(result.etag).toBe('"123"');
    expect(mockStorage.get).toHaveBeenCalledWith('icons', 'badge_123.svg');
  });

  it('should retrieve selfie stream for selfies asset type', async () => {
    mockStorage.get.mockResolvedValueOnce({
      stream: Buffer.from('webp-data'),
      sizeBytes: 1024,
      mimeType: 'image/webp',
      etag: '"selfie-123"',
    });

    const result = await useCase.execute('selfies', 'selfie_56_1791204615298.webp');

    expect(result.mimeType).toBe('image/webp');
    expect(result.etag).toBe('"selfie-123"');
    expect(mockStorage.get).toHaveBeenCalledWith('selfies', 'selfie_56_1791204615298.webp');
  });

  it('should throw NotFoundException for unsupported asset category', async () => {
    await expect(
      useCase.execute('invalid_cat', 'test.svg'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException for unsafe filename with path traversal', async () => {
    await expect(
      useCase.execute('icons', '../../etc/passwd'),
    ).rejects.toThrow(BadRequestException);
  });
});
