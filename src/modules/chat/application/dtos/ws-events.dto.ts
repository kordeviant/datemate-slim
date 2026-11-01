import { IsUUID } from "class-validator";

export class JoinConversationWsDto {
  @IsUUID("4", { message: "conversationId must be a valid UUID" })
  conversationId: string;
}

export class LeaveConversationWsDto {
  @IsUUID("4", { message: "conversationId must be a valid UUID" })
  conversationId: string;
}
