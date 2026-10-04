import { ApiProperty } from '@nestjs/swagger';
import { AdminUserListItemDto } from './admin-users-response.dto';

export class UpdateAdminUserResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'User updated successfully' })
  message: string;

  @ApiProperty({ type: AdminUserListItemDto })
  data: AdminUserListItemDto;
}
