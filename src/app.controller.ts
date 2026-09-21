import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('System')
@Controller()
export class AppController {
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Health check',
    description: 'Basic healthcheck endpoint for client connectivity testing.',
  })
  @ApiResponse({
    status: 200,
    description: 'Server is healthy',
    schema: {
      example: {
        status: 'ok',
      },
    },
  })
  healthCheck() {
    return { status: 'ok' };
  }

  @Get('time')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authoritative server time',
    description:
      'Returns current server epoch time in milliseconds for client clock synchronization.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current epoch time in milliseconds',
    schema: {
      example: {
        status: 'success',
        message: 'Operation successful',
        data: 1726830000000,
        error: null,
      },
    },
  })
  getServerTime(): number {
    return Date.now();
  }
}
