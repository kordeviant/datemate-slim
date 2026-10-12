import { MatchesController } from './matches.controller';
import { GetLikesReceivedUseCase } from '../application/use-cases/get-likes-received.use-case';
import { TokenService } from '../../auth/application/services/token.service';

describe('MatchesController', () => {
  let controller: MatchesController;
  let mockGetLikesReceivedUseCase: jest.Mocked<GetLikesReceivedUseCase>;
  let mockTokenService: jest.Mocked<TokenService>;

  beforeEach(() => {
    mockGetLikesReceivedUseCase = {
      execute: jest.fn(),
    } as any;

    mockTokenService = {
      verifyAccessToken: jest.fn(),
    } as any;

    controller = new MatchesController(
      mockGetLikesReceivedUseCase,
      mockTokenService,
    );
  });

  it('retrieves matches/likes for authenticated user with strictly requested fields', async () => {
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
    const result = await controller.getMatches(req);

    expect(result).toEqual({
      status: 'success',
      message: 'Matches retrieved successfully',
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
