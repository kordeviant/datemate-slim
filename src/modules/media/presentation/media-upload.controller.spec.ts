import { Test, TestingModule } from '@nestjs/testing';
import { MediaUploadController } from './media-upload.controller';
import { UploadMediaUseCase } from '../application/use-cases/upload-media.use-case';
import { AssetTypeRegistry } from '../domain/asset-type-registry';

describe('MediaUploadController', () => {
  let controller: MediaUploadController;
  let mockUploadUseCase: any;
  let registry: AssetTypeRegistry;

  beforeEach(async () => {
    mockUploadUseCase = {
      execute: jest.fn().mockImplementation((type: string, file: any) =>
        Promise.resolve({
          filename: `${type}_123.webp`,
          assetType: type,
          publicUrl: `http://localhost:3000/assets/${type}/${type}_123.webp`,
          relativePath: `${type}/${type}_123.webp`,
          mimeType: 'image/webp',
          sizeBytes: 1024,
          createdAt: new Date().toISOString(),
        }),
      ),
    };

    registry = new AssetTypeRegistry();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaUploadController],
      providers: [
        { provide: UploadMediaUseCase, useValue: mockUploadUseCase },
        { provide: AssetTypeRegistry, useValue: registry },
      ],
    }).compile();

    controller = module.get<MediaUploadController>(MediaUploadController);
  });

  it('should upload asset by type route parameter', async () => {
    const file: any = { originalname: 'badge.svg' };
    const result = await controller.uploadAssetByType('icons', file);

    expect(mockUploadUseCase.execute).toHaveBeenCalledWith('icons', file, undefined);
    expect(result.publicUrl).toBe('http://localhost:3000/assets/icons/icons_123.webp');
  });

  it('should upload icon using dedicated route', async () => {
    const file: any = { originalname: 'icon.svg' };
    const result = await controller.uploadIcon(file);

    expect(mockUploadUseCase.execute).toHaveBeenCalledWith('icons', file, undefined);
    expect(result.assetType).toBe('icons');
  });

  it('should upload image using dedicated route', async () => {
    const file: any = { originalname: 'banner.webp' };
    const result = await controller.uploadImage(file);

    expect(mockUploadUseCase.execute).toHaveBeenCalledWith('images', file, undefined);
    expect(result.assetType).toBe('images');
  });

  it('should upload avatar using dedicated route', async () => {
    const file: any = { originalname: 'profile.webp' };
    const result = await controller.uploadAvatar(file);

    expect(mockUploadUseCase.execute).toHaveBeenCalledWith('avatars', file, undefined);
    expect(result.assetType).toBe('avatars');
  });

  it('should return list of supported asset types and rules', () => {
    const types = controller.getSupportedTypes();
    expect(types.length).toBeGreaterThan(0);
    expect(types.some((t) => t?.assetType === 'icons')).toBe(true);
    expect(types.some((t) => t?.assetType === 'images')).toBe(true);
    expect(types.some((t) => t?.assetType === 'avatars')).toBe(true);
  });
});
