import { LikesController } from './likes.controller';
import { GetLikesReceivedUseCase } from '../application/use-cases/get-likes-received.use-case';
import { TokenService } from '../../auth/application/services/token.service';

describe('LikesController', () => {
  let controller: LikesController;
  let mockGetLikesReceivedUseCase: jest.Mocked<GetLikesReceivedUseCase>;
  let mockTokenService: jest.Mocked<TokenService>;

  beforeEach(() => {
    mockGetLikesReceivedUseCase = {
      execute: jest.fn(),
    } as any;

    mockTokenService = {
      verifyAccessToken: jest.fn(),
    } as any;

    controller = new LikesController(
      mockGetLikesReceivedUseCase,
      mockTokenService,
    );
  });

  it('retrieves likes received for authenticated user with strictly requested fields', async () => {
    mockGetLikesReceivedUseCase.execute.mockResolvedValue([
      {
        id: 202,
        fullName: 'Alex Ray',
        username: 'alex_r',
        city: 'Tehran',
        isOnline: false,
        avatarUrl: 'http://localhost:3000/assets/avatars/avatar_202.webp',
      },
    ]);

    const req = { user: { sub: 88 } };
    const result = await controller.getLikes(req);

    expect(result).toEqual({
      status: 'success',
      message: 'Likes retrieved successfully',
      data: [
        {
          id: 202,
          fullName: 'Alex Ray',
          username: 'alex_r',
          city: 'Tehran',
          isOnline: false,
          avatarUrl: 'http://localhost:3000/assets/avatars/avatar_202.webp',
        },
      ],
    });
    expect(mockGetLikesReceivedUseCase.execute).toHaveBeenCalledWith(88);
  });
});
