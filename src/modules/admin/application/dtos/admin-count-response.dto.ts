import { ApiProperty } from '@nestjs/swagger';

export class AdminCountDataDto {
  @ApiProperty({ description: 'Total count value', example: 7 })
  count: number;
}

export class AdminCountResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Count retrieved successfully' })
  message: string;

  @ApiProperty({ type: AdminCountDataDto })
  data: AdminCountDataDto;
}
