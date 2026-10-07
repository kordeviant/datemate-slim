import { ApiProperty } from '@nestjs/swagger';

export class DeleteAdminUserDataDto {
  @ApiProperty({ example: 101, description: 'Deleted user ID' })
  userId: number;

  @ApiProperty({ example: true, description: 'Deletion success flag' })
  deleted: boolean;
}

export class DeleteAdminUserResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'User deleted successfully' })
  message: string;

  @ApiProperty({ type: DeleteAdminUserDataDto })
  data: DeleteAdminUserDataDto;
}
