export enum MessageType {
  TEXT = "text",
  IMAGE = "image",
  VIDEO = "video",
  VOICE = "voice",
  FILE = "file",
}

export function normalizeMessageType(type?: string | null): MessageType {
  if (!type) return MessageType.TEXT;
  const lower = type.toLowerCase().trim();
  switch (lower) {
    case "photo":
    case "image":
    case "picture":
      return MessageType.IMAGE;
    case "video":
    case "movie":
      return MessageType.VIDEO;
    case "voice":
    case "audio":
    case "voice_note":
      return MessageType.VOICE;
    case "file":
    case "document":
      return MessageType.FILE;
    case "text":
    default:
      return MessageType.TEXT;
  }
}
