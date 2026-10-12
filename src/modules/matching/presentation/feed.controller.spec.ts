import { FeedController } from './feed.controller';
import { GetFeedUseCase } from '../application/use-cases/get-feed.use-case';
import { TokenService } from '../../auth/application/services/token.service';

describe('FeedController', () => {
  let controller: FeedController;
  let mockGetFeedUseCase: jest.Mocked<GetFeedUseCase>;
  let mockTokenService: jest.Mocked<TokenService>;

  beforeEach(() => {
    mockGetFeedUseCase = {
      execute: jest.fn(),
    } as any;

    mockTokenService = {
      verifyAccessToken: jest.fn(),
    } as any;

    controller = new FeedController(mockGetFeedUseCase, mockTokenService);
  });

  it('fetches feed candidates for authenticated user', async () => {
    mockGetFeedUseCase.execute.mockResolvedValue({
      candidates: [
        {
          id: 102,
          fullName: 'Sara Connor',
          city: 'Tehran',
          age: 25,
          profilePicture: 'http://cdn/avatar.webp',
          username: 'sara_c',
        },
      ],
      count: 1,
    });

    const req = { user: { sub: 50 } };
    const result = await controller.getFeed({ limit: 20 }, req);

    expect(result).toEqual({
      status: 'success',
      message: 'Feed retrieved successfully',
      data: {
        candidates: expect.any(Array),
        count: 1,
      },
    });
    expect(mockGetFeedUseCase.execute).toHaveBeenCalledWith(50, { limit: 20 });
  });
});
