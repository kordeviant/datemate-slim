import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { FriendRequestStatus } from '../../domain/enums/friend-request-status.enum';

export class FriendRequestsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by request direction: received (incoming) or sent (outgoing)',
    enum: ['received', 'sent'],
    default: 'received',
  })
  @IsOptional()
  @IsEnum(['received', 'sent'])
  type?: 'received' | 'sent' = 'received';

  @ApiPropertyOptional({
    description: 'Filter by status: PENDING, ACCEPTED, REJECTED, CANCELLED',
    enum: FriendRequestStatus,
    default: FriendRequestStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(FriendRequestStatus)
  status?: FriendRequestStatus = FriendRequestStatus.PENDING;
}
