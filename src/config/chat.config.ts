export interface ChatConfig {
  maxMessageLength: number;
  maxAttachmentsPerMessage: number;
  maxGroupTitleLength: number;
  maxGroupDescriptionLength: number;
  minGroupMembers: number;
  maxGroupMembers: number;
  maxGroupsPerUser: number;
  presenceDebounceMs: number;
  wsPingIntervalMs: number;
  wsPingTimeoutMs: number;
  wsNamespace: string;
}

export const chatConfig = (): { chat: ChatConfig } => ({
  chat: {
    maxMessageLength: parseInt(process.env.CHAT_MAX_MESSAGE_LENGTH || '4000', 10),
    maxAttachmentsPerMessage: parseInt(process.env.CHAT_MAX_ATTACHMENTS_PER_MESSAGE || '10', 10),
    maxGroupTitleLength: parseInt(process.env.CHAT_MAX_GROUP_TITLE_LENGTH || '100', 10),
    maxGroupDescriptionLength: parseInt(process.env.CHAT_MAX_GROUP_DESCRIPTION_LENGTH || '500', 10),
    minGroupMembers: parseInt(process.env.CHAT_MIN_GROUP_MEMBERS || '2', 10),
    maxGroupMembers: parseInt(process.env.CHAT_MAX_GROUP_MEMBERS || '100', 10),
    maxGroupsPerUser: parseInt(process.env.CHAT_MAX_GROUPS_PER_USER || '50', 10),
    presenceDebounceMs: parseInt(process.env.CHAT_PRESENCE_DEBOUNCE_MS || '3000', 10),
    wsPingIntervalMs: parseInt(process.env.CHAT_WS_PING_INTERVAL_MS || '30000', 10),
    wsPingTimeoutMs: parseInt(process.env.CHAT_WS_PING_TIMEOUT_MS || '25000', 10),
    wsNamespace: '/chat',
  },
});
