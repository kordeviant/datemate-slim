import { Test, TestingModule } from '@nestjs/testing';
import { AssetsController } from './assets.controller';
import { GetMediaStreamUseCase } from '../application/use-cases/get-media-stream.use-case';
import { HttpStatus } from '@nestjs/common';

describe('AssetsController', () => {
  let controller: AssetsController;
  let mockGetStreamUseCase: any;
  let mockRes: any;

  beforeEach(async () => {
    mockGetStreamUseCase = {
      execute: jest.fn().mockResolvedValue({
        stream: Buffer.from('<svg></svg>'),
        sizeBytes: 13,
        mimeType: 'image/svg+xml',
        etag: 'W/"13-12345"',
        lastModified: new Date('2026-09-29T10:00:00Z'),
      }),
    };

    mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetsController],
      providers: [
        {
          provide: GetMediaStreamUseCase,
          useValue: mockGetStreamUseCase,
        },
      ],
    }).compile();

    controller = module.get<AssetsController>(AssetsController);
  });

  it('should stream icon at /assets/icons/:filename with caching headers', async () => {
    await controller.getIcon('star.svg', mockRes);

    expect(mockGetStreamUseCase.execute).toHaveBeenCalledWith(
      'icons',
      'star.svg',
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'image/svg+xml',
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=31536000, immutable',
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith('ETag', 'W/"13-12345"');
    expect(mockRes.end).toHaveBeenCalledWith(Buffer.from('<svg></svg>'));
  });

  it('should stream image at /assets/images/:filename', async () => {
    mockGetStreamUseCase.execute.mockResolvedValueOnce({
      stream: Buffer.from('img-data'),
      sizeBytes: 8,
      mimeType: 'image/webp',
      etag: '"8-123"',
    });

    await controller.getImage('photo.webp', mockRes);

    expect(mockGetStreamUseCase.execute).toHaveBeenCalledWith(
      'images',
      'photo.webp',
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/webp');
  });

  it('should stream avatar at /assets/avatars/:filename', async () => {
    mockGetStreamUseCase.execute.mockResolvedValueOnce({
      stream: Buffer.from('avatar-data'),
      sizeBytes: 11,
      mimeType: 'image/webp',
      etag: '"11-123"',
    });

    await controller.getAvatar('user.webp', mockRes);

    expect(mockGetStreamUseCase.execute).toHaveBeenCalledWith(
      'avatars',
      'user.webp',
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/webp');
  });

  it('should stream selfie at /assets/selfies/:filename', async () => {
    mockGetStreamUseCase.execute.mockResolvedValueOnce({
      stream: Buffer.from('selfie-data'),
      sizeBytes: 12,
      mimeType: 'image/webp',
      etag: '"12-123"',
    });

    await controller.getSelfie('selfie_56_123.webp', mockRes);

    expect(mockGetStreamUseCase.execute).toHaveBeenCalledWith(
      'selfies',
      'selfie_56_123.webp',
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/webp');
  });

  it('should support scalable route /assets/:type/:filename for any asset type', async () => {
    mockGetStreamUseCase.execute.mockResolvedValueOnce({
      stream: Buffer.from('banner-data'),
      sizeBytes: 11,
      mimeType: 'image/jpeg',
      etag: '"11-123"',
    });

    await controller.getAsset('banners', 'promo.jpg', mockRes);

    expect(mockGetStreamUseCase.execute).toHaveBeenCalledWith(
      'banners',
      'promo.jpg',
    );
  });

  it('should return 304 Not Modified when if-none-match matches etag', async () => {
    await controller.getIcon('star.svg', mockRes, 'W/"13-12345"');

    expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.NOT_MODIFIED);
    expect(mockRes.end).toHaveBeenCalled();
  });
});
