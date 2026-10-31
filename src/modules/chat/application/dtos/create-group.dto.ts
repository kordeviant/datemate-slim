import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";
import { GroupMembershipStatus } from "../../domain/enums/group-membership-status.enum";

/**
 * References are IDs, not embedded Main Backend models. This keeps the service
 * boundary explicit and prevents stale copies of User/City/Interest data.
 */
export class CreateGroupDto {
  @ApiProperty({ example: "Tehran hikers" })
  @IsString() @MaxLength(100)
  title: string;

  @ApiProperty({ example: false, description: "Private groups require approval or an invitation." })
  @IsBoolean()
  isPrivate: boolean;

  @ApiPropertyOptional({ example: "Weekend hiking and coffee." })
  @IsOptional() @IsString() @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ example: "any", description: "A Main Backend-defined gender value." })
  @IsOptional() @IsString() @MaxLength(32)
  gender?: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional() @IsInt() @Min(0) @Max(150)
  minimumAge?: number;

  @ApiPropertyOptional({ example: 35 })
  @IsOptional() @IsInt() @Min(0) @Max(150)
  maximumAge?: number;

  @ApiPropertyOptional({ example: 7, description: "InterestCategory ID in Main Backend." })
  @IsOptional() @IsInt() @Min(1)
  subjectId?: number;

  @ApiPropertyOptional({ example: 21, description: "City ID in Main Backend." })
  @IsOptional() @IsInt() @Min(1)
  cityId?: number;

  @ApiPropertyOptional({ example: "https://cdn.example.com/groups/hikers.webp" })
  @IsOptional() @IsUrl({ require_tld: false }) @MaxLength(2048)
  avatar?: string;

  @ApiPropertyOptional({ type: [Number], example: [42, 43], description: "Users to invite; they are not members until acceptance." })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsInt({ each: true })
  initialInviteUserIds?: number[];
}

export class UpdateGroupDto {
  @ApiPropertyOptional({ example: "Tehran Hikers Club" }) @IsOptional() @IsString() @MaxLength(100) title?: string;
  @ApiPropertyOptional({ example: false }) @IsOptional() @IsBoolean() isPrivate?: boolean;
  @ApiPropertyOptional({ example: "Updated weekend hiking and coffee meetup details." }) @IsOptional() @IsString() @MaxLength(500) bio?: string;
  @ApiPropertyOptional({ example: "any" }) @IsOptional() @IsString() @MaxLength(32) gender?: string;
  @ApiPropertyOptional({ example: 21 }) @IsOptional() @IsInt() @Min(0) @Max(150) minimumAge?: number;
  @ApiPropertyOptional({ example: 40 }) @IsOptional() @IsInt() @Min(0) @Max(150) maximumAge?: number;
  @ApiPropertyOptional({ example: 7 }) @IsOptional() @IsInt() @Min(1) subjectId?: number;
  @ApiPropertyOptional({ example: 21 }) @IsOptional() @IsInt() @Min(1) cityId?: number;
  @ApiPropertyOptional({ example: "https://cdn.example.com/groups/new-avatar.webp" }) @IsOptional() @IsUrl({ require_tld: false }) @MaxLength(2048) avatar?: string;
  @ApiPropertyOptional({ example: true }) @IsOptional() @IsBoolean() active?: boolean;
}

export class GroupUserDto {
  @ApiProperty({ example: 42 }) @IsInt()
  userId: number;
}

export class BanGroupUserDto {
  @ApiProperty({ example: 42 }) @IsInt()
  userId: number;

  @ApiPropertyOptional({ example: "Spamming in group chat" })
  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

export class ListGroupParticipantsQueryDto {
  @ApiPropertyOptional({
    enum: GroupMembershipStatus,
    default: GroupMembershipStatus.ACTIVE,
    description: "Filter participants by membership status",
  })
  @IsOptional()
  @IsEnum(GroupMembershipStatus)
  status?: GroupMembershipStatus = GroupMembershipStatus.ACTIVE;

  @ApiPropertyOptional({
    default: 30,
    minimum: 1,
    maximum: 100,
    description: "Number of participants to return",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;

  @ApiPropertyOptional({
    description: "Opaque cursor for pagination",
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
