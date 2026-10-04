import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum AdminUserStatusFilter {
  ALL = 'ALL',
  BLOCKED = 'BLOCKED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  COMPLETED = 'COMPLETED',
}

export enum AdminGenderFilter {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  ALL = 'ALL',
}

export enum AdminUserSortBy {
  CREATED_AT = 'createdAt',
  LAST_SEEN_AT = 'lastSeenAt',
  WALLET = 'wallet',
}

export enum AdminSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class GetAdminUsersDto {
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
    description: 'Search string across name, username, and email',
    example: 'sara',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by user status',
    enum: AdminUserStatusFilter,
    default: AdminUserStatusFilter.ALL,
  })
  @IsOptional()
  @IsEnum(AdminUserStatusFilter)
  status: AdminUserStatusFilter = AdminUserStatusFilter.ALL;

  @ApiPropertyOptional({
    description: 'Filter by gender',
    enum: AdminGenderFilter,
    default: AdminGenderFilter.ALL,
  })
  @IsOptional()
  @IsEnum(AdminGenderFilter)
  gender: AdminGenderFilter = AdminGenderFilter.ALL;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: AdminUserSortBy,
    default: AdminUserSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(AdminUserSortBy)
  sortBy: AdminUserSortBy = AdminUserSortBy.CREATED_AT;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: AdminSortOrder,
    default: AdminSortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(AdminSortOrder)
  order: AdminSortOrder = AdminSortOrder.DESC;
}
