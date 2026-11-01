import { SwipesController } from './swipes.controller';
import { RecordSwipeUseCase } from '../application/use-cases/record-swipe.use-case';
import { TokenService } from '../../auth/application/services/token.service';

describe('SwipesController', () => {
  let controller: SwipesController;
  let mockRecordSwipeUseCase: jest.Mocked<RecordSwipeUseCase>;
  let mockTokenService: jest.Mocked<TokenService>;

  beforeEach(() => {
    mockRecordSwipeUseCase = {
      execute: jest.fn(),
    } as any;

    mockTokenService = {
      verifyAccessToken: jest.fn(),
    } as any;

    controller = new SwipesController(
      mockRecordSwipeUseCase,
      mockTokenService,
    );
  });

  it('records swipe using request user from guard and returns 200 OK', async () => {
    mockRecordSwipeUseCase.execute.mockResolvedValue();

    const req = { user: { sub: 10 } };
    const result = await controller.swipe(
      { targetUserId: 20, direction: 'RIGHT' },
      req,
    );

    expect(result).toEqual({
      status: 'success',
      message: 'Swipe recorded successfully',
    });
    expect(mockRecordSwipeUseCase.execute).toHaveBeenCalledWith(10, {
      targetUserId: 20,
      direction: 'RIGHT',
    });
  });

  it('records swipe using Authorization header fallback', async () => {
    mockTokenService.verifyAccessToken.mockResolvedValue({ sub: 15 });
    mockRecordSwipeUseCase.execute.mockResolvedValue();

    const req = {};
    const result = await controller.swipe(
      { targetUserId: 30, direction: 'LEFT' },
      req,
      'Bearer test_token',
    );

    expect(result).toEqual({
      status: 'success',
      message: 'Swipe recorded successfully',
    });
    expect(mockRecordSwipeUseCase.execute).toHaveBeenCalledWith(15, {
      targetUserId: 30,
      direction: 'LEFT',
    });
  });
});
