# DateMate Chat — Media, Voice & File Attachments Client Guide

This standalone guide provides client developers (Android, iOS, Web) with complete specifications, code snippets, and payloads for integrating **photos, videos, voice messages, and file attachments** in DateMate Chat.

---

## 1. Overview & Lifecycle Flow

Attachment messaging follows a **2-step lifecycle**:

```text
[Client]                                                        [Backend]
   │                                                                │
   │  1. POST /v1/chat/upload (Multipart file + metadata)           │
   ├───────────────────────────────────────────────────────────────>│
   │                                                                │
   │  2. Return public URL, detected MIME, size, & duration         │
   │<───────────────────────────────────────────────────────────────┤
   │                                                                │
   │  3. WS emit 'message.send' (with URL, type, duration)          │
   ├───────────────────────────────────────────────────────────────>│
   │                                                                │
   │  4. Broadcast 'message.created' to room members                │
   │<═══════════════════════════════════════════════════════════════╡
```

1. **Upload First**: The client uploads the binary media/file via the REST upload endpoint (`POST /v1/chat/upload`), which returns a public streamable URL and file metadata.
2. **Send via WebSocket**: The client sends the message over WebSocket (`message.send`), attaching the URL, type, and optional metadata/duration.
3. **Receive Broadcast**: All room participants receive the `message.created` socket event with the attachment details and render the appropriate UI component (voice player, image preview, video player, or file download card).

---

## 2. REST Upload Endpoint

Upload the binary file first to obtain a permanent, streamable URL.

### Endpoint Details
- **Method & Path**: `POST /v1/chat/upload` *(alias: `POST /v1/upload`)*
- **Content-Type**: `multipart/form-data`
- **Header**: `Authorization: Bearer <JWT>`

### Form-Data Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | `Binary` | **Yes** | The media/file payload. |
| `type` | `String` | No | Category hint: `image`, `video`, `voice`, or `file`. If omitted, auto-detected from MIME type. |
| `duration` | `Number` | No | Recording duration in seconds (e.g., `14.5`). Recommended for voice notes and video clips. |
| `conversationId` | `UUID` | No | Target conversation ID. If provided, verifies that the user is an active member. |

### File Size Limits & Allowed Formats

| Category | Max Size | Supported Formats |
|---|---|---|
| **Voice / Audio** | **25 MB** | `.m4a`, `.aac`, `.ogg`, `.mp3`, `.wav`, `.weba`, `.opus` |
| **Photos / Images** | **20 MB** | `.jpg`, `.jpeg`, `.png`, `.webp`, `.heic`, `.gif` |
| **Video** | **100 MB** | `.mp4`, `.mov`, `.webm`, `.m4v`, `.mkv` |
| **Documents / Files** | **50 MB** | `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.zip`, etc. *(Executables such as `.exe`, `.sh`, `.bat` are blocked)* |

### Successful Response (`201 Created`)
```json
{
  "success": true,
  "status": "success",
  "message": "Operation successful",
  "data": {
    "url": "https://chat-datemate.testdevvvv.site/uploads/a7e3bf50-e7f3-4e4b-91bb-cb468a4e3210.ogg",
    "type": "voice",
    "duration": 14.5,
    "fileName": "audio_record.ogg",
    "storedFileName": "a7e3bf50-e7f3-4e4b-91bb-cb468a4e3210.ogg",
    "mimeType": "audio/ogg",
    "size": 48210
  },
  "error": null
}
```

---

## 3. Sending Attachment via WebSocket (`/chat` namespace)

After receiving the upload response, emit `message.send` over the Socket.IO connection.

### Payload Schema (`message.send`)

| Field | Type | Required | Description |
|---|---|---|---|
| `conversationId` | `UUID string` | **Yes** | Target conversation UUID. |
| `clientMessageId` | `string` | **Yes** | Unique client ID (UUID v4) for **idempotency & deduplication**. |
| `type` | `string` | **Yes** | `text`, `image`, `video`, `voice`, or `file`. |
| `url` | `string` | Conditional | Public URL from the upload step (required for non-text messages). |
| `duration` | `number` | No | Duration in seconds (for voice messages). |
| `content` | `string` | Conditional | Text caption (optional when attachment is provided, up to 4000 characters). |
| `attachment` | `object` | No | Optional nested object containing `{ url, type, duration, fileName, fileSize, mimeType }`. |

### Client Implementation Example (TypeScript / JavaScript)

```javascript
// 1. Upload file
const formData = new FormData();
formData.append("file", voiceFile);
formData.append("type", "voice");
formData.append("duration", "14.5");

const uploadRes = await fetch("https://chat-datemate.testdevvvv.site/v1/chat/upload", {
  method: "POST",
  headers: { "Authorization": `Bearer ${accessToken}` },
  body: formData,
});
const { data: uploadData } = await uploadRes.json();

// 2. Emit over WebSocket
const clientMessageId = crypto.randomUUID();

socket.emit(
  "message.send",
  {
    conversationId: "8197569f-e793-552d-b862-9686ebe37edf",
    clientMessageId,
    type: uploadData.type,        // "voice", "image", "video", or "file"
    url: uploadData.url,
    duration: uploadData.duration, // 14.5
    content: "",                   // optional caption
    attachment: {
      url: uploadData.url,
      type: uploadData.type,
      duration: uploadData.duration,
      fileName: uploadData.fileName,
      fileSize: uploadData.size,
      mimeType: uploadData.mimeType,
    },
  },
  (ack) => {
    if (ack.success) {
      console.log("Sent successfully:", ack.data.message);
    } else {
      console.error("Failed to send:", ack.message);
    }
  }
);
```

### Server Acknowledgment Callback
```json
{
  "success": true,
  "status": "success",
  "message": "Message sent successfully",
  "data": {
    "message": {
      "messageId": "91a8ecf4-4a25-4c07-b30a-2fb6f6cf557a",
      "conversationId": "8197569f-e793-552d-b862-9686ebe37edf",
      "senderId": 42,
      "content": "",
      "type": "voice",
      "url": "https://chat-datemate.testdevvvv.site/uploads/a7e3bf50-e7f3-4e4b-91bb-cb468a4e3210.ogg",
      "duration": 14.5,
      "attachment": {
        "url": "https://chat-datemate.testdevvvv.site/uploads/a7e3bf50-e7f3-4e4b-91bb-cb468a4e3210.ogg",
        "type": "voice",
        "duration": 14.5,
        "fileName": "audio_record.ogg",
        "fileSize": 48210,
        "mimeType": "audio/ogg"
      },
      "clientMessageId": "c8a141b7-1c21-4f35-9017-d5fa6cf1b012",
      "createdAt": "2026-10-28T14:30:00.000Z"
    }
  },
  "error": null
}
```

---

## 4. Receiving Real-Time Broadcast (`message.created`)

All participants currently joined to the conversation room receive the `message.created` socket event:

```javascript
socket.on("message.created", (message) => {
  console.log("New message received:", message);

  switch (message.type) {
    case "voice":
      // Render voice player with message.duration and message.url
      break;
    case "image":
      // Render image preview
      break;
    case "video":
      // Render video player
      break;
    case "file":
      // Render document card with message.attachment.fileName & fileSize
      break;
    default:
      // Render standard text bubble
      break;
  }
});
```

### Broadcast Event Payload
```json
{
  "messageId": "91a8ecf4-4a25-4c07-b30a-2fb6f6cf557a",
  "conversationId": "8197569f-e793-552d-b862-9686ebe37edf",
  "senderId": 42,
  "content": "",
  "type": "voice",
  "url": "https://chat-datemate.testdevvvv.site/uploads/a7e3bf50-e7f3-4e4b-91bb-cb468a4e3210.ogg",
  "duration": 14.5,
  "attachment": {
    "url": "https://chat-datemate.testdevvvv.site/uploads/a7e3bf50-e7f3-4e4b-91bb-cb468a4e3210.ogg",
    "type": "voice",
    "duration": 14.5,
    "fileName": "audio_record.ogg",
    "fileSize": 48210,
    "mimeType": "audio/ogg"
  },
  "clientMessageId": "c8a141b7-1c21-4f35-9017-d5fa6cf1b012",
  "createdAt": "2026-10-28T14:30:00.000Z"
}
```

---

## 5. Audio & Video Streaming (HTTP 206 Byte-Range)

The media delivery endpoint supports HTTP byte-range seeking:
- **URL**: `GET /uploads/:fileName`
- **Headers Returned**:
  - `Accept-Ranges: bytes`
  - `Cache-Control: public, max-age=31536000, immutable`
- Native players (`AVPlayer` on iOS, `ExoPlayer` on Android, and HTML5 `<audio>` / `<video>`) can scrub and seek audio/video streams smoothly with standard `Range: bytes=start-end` requests.

---

## 6. Inbox & History Models

### Inbox List (`GET /v1/conversations`)
- Media messages automatically format the inbox preview:
  - Voice: `🎤 Voice message (15s)`
  - Photo: `📷 Photo`
  - Video: `🎥 Video`
  - Document: `📎 Document` or the original file name
- `lastMessage` and each entry in `recentMessages` include `type`, `url`, `duration`, and `attachment`.

### Message History (`GET /v1/conversations/:id/messages`)
- Returned historical messages include all attachment fields (`type`, `url`, `duration`, `attachment`), matching the `message.created` socket structure.
