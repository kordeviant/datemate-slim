import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LocalStorageService } from './local-storage.service';
import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('LocalStorageService', () => {
  let service: LocalStorageService;
  const testUploadDir = path.join(process.cwd(), 'scratch', 'test-uploads');

  beforeAll(() => {
    if (!fs.existsSync(testUploadDir)) {
      fs.mkdirSync(testUploadDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: any) => {
              if (key === 'UPLOADS_DIR') return testUploadDir;
              return def;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LocalStorageService>(LocalStorageService);
  });

  it('should save file into uploads/<assetType>/<filename>', async () => {
    const result = await service.save({
      assetType: 'icons',
      filename: 'star_test.svg',
      buffer: Buffer.from('<svg></svg>'),
      mimeType: 'image/svg+xml',
    });

    expect(result.assetType).toBe('icons');
    expect(result.filename).toBe('star_test.svg');
    expect(result.storageKey).toBe('icons/star_test.svg');
    expect(fs.existsSync(result.storagePath!)).toBe(true);
  });

  it('should prevent path traversal attacks on save', async () => {
    await expect(
      service.save({
        assetType: 'icons',
        filename: '../../evil.sh',
        buffer: Buffer.from('echo hacked'),
        mimeType: 'application/x-sh',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should check if file exists', async () => {
    await service.save({
      assetType: 'images',
      filename: 'existing.webp',
      buffer: Buffer.from('webp-data'),
      mimeType: 'image/webp',
    });

    expect(await service.exists('images', 'existing.webp')).toBe(true);
    expect(await service.exists('images', 'non_existent.webp')).toBe(false);
  });

  it('should stream file and compute ETag on get', async () => {
    await service.save({
      assetType: 'avatars',
      filename: 'avatar_stream.webp',
      buffer: Buffer.from('avatar-data'),
      mimeType: 'image/webp',
    });

    const file = await service.get('avatars', 'avatar_stream.webp');
    expect(file.mimeType).toBe('image/webp');
    expect(file.sizeBytes).toBe(Buffer.from('avatar-data').length);
    expect(file.etag).toBeDefined();
    expect(file.stream).toBeDefined();
  });

  it('should throw NotFoundException on get for non-existent file', async () => {
    await expect(service.get('avatars', 'ghost.webp')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should delete file successfully', async () => {
    await service.save({
      assetType: 'icons',
      filename: 'to_delete.svg',
      buffer: Buffer.from('<svg></svg>'),
      mimeType: 'image/svg+xml',
    });

    expect(await service.exists('icons', 'to_delete.svg')).toBe(true);
    const deleted = await service.delete('icons', 'to_delete.svg');
    expect(deleted).toBe(true);
    expect(await service.exists('icons', 'to_delete.svg')).toBe(false);
  });
});
