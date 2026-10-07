import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountDataDto {
  @ApiProperty({ example: 12, description: 'Deleted user ID' })
  userId: number;

  @ApiProperty({ example: true, description: 'Account deletion status' })
  deleted: boolean;
}

export class DeleteAccountResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Account deleted successfully' })
  message: string;

  @ApiProperty({ type: DeleteAccountDataDto })
  data: DeleteAccountDataDto;
}
