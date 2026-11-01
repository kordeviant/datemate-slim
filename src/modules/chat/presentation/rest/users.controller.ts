import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../../common/guards/jwt-auth.guard";
import { UserPresenceService } from "../../application/services/user-presence.service";
import {
  UserActivityDto,
  BatchUserActivityRequestDto,
  BatchUserActivityResponseDto,
} from "../../application/dtos/user-activity.dto";

@ApiTags("Chat Presence")
@ApiBearerAuth("JWT-auth")
@UseGuards(JwtAuthGuard)
@Controller("users")
export class ChatUsersController {
  constructor(private readonly presenceService: UserPresenceService) {}

  @Get(":userId/activity")
  @ApiOperation({ summary: "Get user activity (online status and last seen)" })
  @ApiParam({ name: "userId", description: "Numeric user ID", type: Number })
  @ApiResponse({
    status: 200,
    description: "User activity details",
    type: UserActivityDto,
  })
  public async getUserActivity(
    @Param("userId", ParseIntPipe) userId: number,
  ): Promise<UserActivityDto> {
    return this.presenceService.getUserActivity(userId);
  }

  @Post("activity")
  @ApiOperation({
    summary: "Batch get user activities (online status and last seen)",
  })
  @ApiResponse({
    status: 200,
    description: "List of user activities",
    type: BatchUserActivityResponseDto,
  })
  public async getBatchUserActivity(
    @Body() dto: BatchUserActivityRequestDto,
  ): Promise<BatchUserActivityResponseDto> {
    const activityMap = await this.presenceService.getUserActivityBatch(dto.userIds);
    return {
      activities: Array.from(activityMap.values()),
    };
  }
}
