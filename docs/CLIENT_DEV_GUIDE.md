# DateMate Client Developer Guide

Comprehensive reference and integration guide for **iOS, Android, and Web** client developers connecting to the DateMate backend services.

---

## Table of Contents
1. [Connectivity, Environments & Protocol Support](#1-connectivity-environments--protocol-support)
2. [Authentication & Unified Response Envelope](#2-authentication--unified-response-envelope)
3. [User Blocking & Safety System (Card #69)](#3-user-blocking--safety-system-card-69)
4. [Conversations & Server-Side Unread Tracking (Card #78)](#4-conversations--server-side-unread-tracking-card-78)
5. [Message Deletion & Preview Management (Card #68)](#5-message-deletion--preview-management-card-68)
6. [Real-Time WebSocket Protocol (Socket.IO v4)](#6-real-time-websocket-protocol-socketio-v4)
7. [Media, Voice & File Attachments Flow](#7-media-voice--file-attachments-flow)
8. [Discovery, Matching & Profile Invariants](#8-discovery-matching--profile-invariants)
9. [Device Token & Push Notifications](#9-device-token--push-notifications)
10. [Client Code Snippets (Swift & Kotlin)](#10-client-code-snippets-swift--kotlin)

---

## 1. Connectivity, Environments & Protocol Support

### 1.1 Base URLs

| Environment | REST API Base URL | WebSocket Gateway URL |
|---|---|---|
| **Staging / Dev** | `https://dev-datemate.testdevvvv.site` | `https://dev-datemate.testdevvvv.site` (paths `/chat` & `/socket.io`) |
| **Local Development** | `http://localhost:3000` | `ws://localhost:3000` (paths `/chat` & `/socket.io`) |

> 💡 Both versioned paths (e.g. `/v1/...`) and root paths (e.g. `/...`) are supported across all domains. `/v1/...` is the canonical, recommended format.

---

## 2. Authentication & Unified Response Envelope

### 2.1 Authorization Header
Include the access token in every authenticated HTTP request:
```http
Authorization: Bearer <ACCESS_TOKEN>
```

### 2.2 Standard Response Envelope (`ResponseResult<T>`)
Every REST response follows the strict contract:
```typescript
interface ResponseResult<T> {
  success: boolean;        // true on success, false on error
  status: "success" | "error";
  message: string;         // Human-readable status message
  data: T | null;          // Typed payload on success, null on error
  error?: {
    type: string;          // E.g. "BAD_REQUEST", "FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"
    message: string;       // Technical description of the error
  } | null;
}
```

---

## 3. User Blocking & Safety System (Card #69)

DateMate features a two-way blocking system. When user A blocks user B:
1. User B cannot send 1:1 messages to user A (returns `403 Forbidden`).
2. Push notifications (FCM) are automatically suppressed between them.
3. Both users receive real-time socket events to immediately update their chat UI.

```text
[User A]                                      [Backend]                                     [User B]
   │                                              │                                            │
   │  POST /v1/users/202/block                   │                                            │
   ├─────────────────────────────────────────────>│                                            │
   │                                              │  WS emit 'user.blocked' to user:202        │
   │                                              ├───────────────────────────────────────────>│
   │  WS emit 'user.blocked' to user:101          │                                            │
   │<─────────────────────────────────────────────┤                                            │
```

### 3.1 Block a User
- **Method & Path**: `POST /v1/users/{userId}/block`
- **Headers**: `Authorization: Bearer <JWT>`
- **Request Body** *(Optional)*:
  ```json
  {
    "reason": "Harassment or inappropriate behavior"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "status": "success",
    "message": "User blocked successfully",
    "data": { "userId": 202 }
  }
  ```
- **Error Codes**:
  - `400 Bad Request`: When trying to block oneself (`"You cannot block yourself"`).
  - `404 Not Found`: Target user does not exist.

### 3.2 Unblock a User
- **Method & Path**: `DELETE /v1/users/{userId}/block`
- **Headers**: `Authorization: Bearer <JWT>`
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "status": "success",
    "message": "User unblocked successfully",
    "data": { "userId": 202 }
  }
  ```

### 3.3 List Blocked Users
- **Method & Path**: `GET /v1/users/blocked`
- **Headers**: `Authorization: Bearer <JWT>`
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "status": "success",
    "message": "Blocked users retrieved",
    "data": [
      {
        "id": 202,
        "username": "alex_smith",
        "firstName": "Alex",
        "profilePictureUrl": "https://dev-datemate.testdevvvv.site/assets/images/alex.webp",
        "avatarUrl": "https://dev-datemate.testdevvvv.site/assets/images/alex.webp",
        "blockedAt": "2026-11-18T14:30:00Z"
      }
    ]
  }
  ```

### 3.4 WebSocket Events for Block/Unblock
Clients can also trigger block/unblock over WebSocket, or listen for server notifications:

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `user.block` *(or `user:block`)* | Client -> Server | `{"userId": 202, "reason": "..."}` | Blocks the target user |
| `user.unblock` *(or `user:unblock`)* | Client -> Server | `{"userId": 202}` | Unblocks the target user |
| `user.blocked` | Server -> Client | `{"userId": 202, "blockedBy": 101}` | Emitted to both users' rooms (`user:101`, `user:202`) |
| `user.unblocked` | Server -> Client | `{"userId": 202, "unblockedBy": 101}` | Emitted to both users' rooms (`user:101`, `user:202`) |

---

## 4. Conversations & Server-Side Unread Tracking (Card #78)

Unread state is tracked on the server per user and per conversation.
- Reinstalling the app or signing in on multiple devices retains the accurate unread count.
- Opening a conversation marks it as read on the server and synchronizes all active devices.
- A user's **own messages never increment** their unread counter.

### 4.1 Unread Count in Conversation Lists
Every conversation item returned by `GET /v1/conversations`, `GET /v1/conversations/direct`, and `GET /v1/conversations/group` includes the authoritative `unreadCount`:

```json
{
  "conversationId": "4a71c84f-6f77-4b76-a0bf-9538466b0337",
  "type": "direct",
  "title": "Sarah Jenkins",
  "unreadCount": 3,
  "lastMessage": {
    "messageId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "senderId": 202,
    "content": "Are you coming tonight?",
    "type": "text",
    "createdAt": "2026-11-18T16:20:00Z"
  }
}
```

### 4.2 Mark Conversation as Read (REST)
Call this endpoint whenever the user enters or views a conversation:
- **Method & Path**: `POST /v1/conversations/{conversationId}/read`
- **Headers**: `Authorization: Bearer <JWT>`
- **Request Body** *(Optional)*:
  ```json
  {
    "messageId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "status": "success",
    "message": "Conversation marked as read",
    "data": {
      "conversationId": "4a71c84f-6f77-4b76-a0bf-9538466b0337",
      "unreadCount": 0
    }
  }
  ```

### 4.3 Mark Conversation as Read (WebSocket)
Alternatively, emit over the active socket:
```typescript
socket.emit("conversation.read", {
  conversationId: "4a71c84f-6f77-4b76-a0bf-9538466b0337",
  messageId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
}, (response) => {
  console.log("Read confirmed:", response);
});
```

### 4.4 Cross-Device Synchronization Event
When a conversation is marked as read from device A, the server broadcasts to the user's personal room (`user:<userId>`):
```json
// Event: "conversation.read"
{
  "conversationId": "4a71c84f-6f77-4b76-a0bf-9538466b0337",
  "unreadCount": 0
}
```
Client device B receives this event and updates its badge / chat list unread count to 0 in real time.

---

## 5. Message Deletion & Preview Management (Card #68)

DateMate supports two modes of message deletion:
1. **Delete for Me**: Hides the message exclusively for the calling user. Other participants continue to see the message.
2. **Delete for Everyone**: Soft-deletes the message for all participants. Restricted to:
   - The original **sender** of the message.
   - A group **Owner** or **Admin**.

```text
[Client]                                                        [Backend]
   │                                                                │
   │  DELETE /v1/conversations/{convId}/messages/{msgId}            │
   │  ?forEveryone=true                                             │
   ├───────────────────────────────────────────────────────────────>│
   │                                                                │
   │  1. Check sender / admin authorization                         │
   │  2. Mark deleted_at & recalculate last_message_preview         │
   │                                                                │
   │  Broadcast 'message.deleted' to conversation room              │
   │<═══════════════════════════════════════════════════════════════╡
   │                                                                │
   │  Broadcast 'conversation.updated' with new last message preview│
   │<═══════════════════════════════════════════════════════════════╡
```

### 5.1 Delete Message Endpoint (REST)
- **Method & Path**: `DELETE /v1/conversations/{conversationId}/messages/{messageId}`
- **Query Parameter**: `?forEveryone=true` *(or `false`)*
- **Or Request Body**:
  ```json
  {
    "forEveryone": true
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "status": "success",
    "message": "Message deleted successfully",
    "data": {
      "conversationId": "4a71c84f-6f77-4b76-a0bf-9538466b0337",
      "messageId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "forEveryone": true
    }
  }
  ```
- **Error Codes**:
  - `403 Forbidden`: When a non-sender/non-admin attempts `forEveryone: true` (`"Only the message sender or group admin can delete for everyone"`).
  - `404 Not Found`: Message does not exist.

### 5.2 Delete Message over WebSocket
```typescript
socket.emit("message.delete", {
  conversationId: "4a71c84f-6f77-4b76-a0bf-9538466b0337",
  messageId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  forEveryone: true
}, (response) => {
  console.log("Delete confirmed:", response);
});
```

### 5.3 Real-Time Deletion Broadcasts
When a message is deleted:
1. **`message.deleted` event**:
   - If `forEveryone: true`: Broadcast to `conversation:<conversationId>`.
   - If `forEveryone: false`: Emitted only to the requesting user's room (`user:<userId>`).
   ```json
   {
     "conversationId": "4a71c84f-6f77-4b76-a0bf-9538466b0337",
     "messageId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
     "forEveryone": true
   }
   ```
2. **`conversation.updated` event**:
   If the deleted message was the latest message in the conversation, the backend automatically recalculates the previous visible message and broadcasts:
   ```json
   {
     "conversationId": "4a71c84f-6f77-4b76-a0bf-9538466b0337",
     "lastMessage": {
       "messageId": "8a0cea3c-2a6c-4c9b-8ecc-1a9c6a2cba5c",
       "content": "Previous message text",
       "type": "text"
     }
   }
   ```

---

## 6. Real-Time WebSocket Protocol (Socket.IO v4)

### 6.1 Handshake & Authentication
Connect to the Socket.IO server passing the JWT access token:
```typescript
import { io } from "socket.io-client";

const socket = io("https://dev-datemate.testdevvvv.site/chat", {
  transports: ["websocket", "polling"],
  auth: {
    accessToken: "YOUR_JWT_ACCESS_TOKEN" // or "token": "..."
  }
});
```
> 💡 The server also accepts tokens in query params (`?token=<JWT>`) and headers (`Authorization: Bearer <JWT>`).

### 6.2 Automatic Personal Room
Upon connection, the server automatically joins the socket to room `user:<userId>`.
- You do **not** need to manually join `user:<userId>`.
- In-app push updates, conversation unread resets, block updates, and inbox previews arrive on this room continuously.

### 6.3 Conversation Room Subscription
When the user opens a specific chat screen, join its conversation room:
```typescript
// On screen open
socket.emit("conversation.join", { conversationId: "4a71c84f..." });

// On screen exit
socket.emit("conversation.leave", { conversationId: "4a71c84f..." });
```

### 6.4 Sending Messages (`message.send`)
Send a message with client-side deduplication ID (`clientMessageId`):
```typescript
socket.emit("message.send", {
  conversationId: "4a71c84f-6f77-4b76-a0bf-9538466b0337",
  clientMessageId: "UUID-GENERATED-BY-CLIENT",
  content: "Hello there!",
  type: "text" // "text" | "image" | "voice" | "video" | "file"
}, (ack) => {
  if (ack.success) {
    console.log("Message delivered:", ack.data.message);
  } else {
    console.error("Failed to send:", ack.error.message);
  }
});
```

### 6.5 Full Socket Events Summary

| Event | Direction | Scope / Room | Purpose |
|---|---|---|---|
| `conversation.join` | Client -> Server | Socket | Subscribes socket to `conversation:<id>` |
| `conversation.leave` | Client -> Server | Socket | Unsubscribes socket from `conversation:<id>` |
| `message.send` | Client -> Server | Socket | Dispatches new message |
| `message.created` | Server -> Client | `conversation:<id>` & `user:<recipientId>` | Broadcasts new message to participants |
| `message.sent` | Server -> Client | Sender Socket | Sender delivery confirmation |
| `conversation.read` | Bidirectional | `user:<userId>` | Marks conversation read / syncs other devices |
| `message.delete` | Client -> Server | Socket | Deletes a message (for me or everyone) |
| `message.deleted` | Server -> Client | `conversation:<id>` or `user:<userId>` | Notifies UI to remove message from screen |
| `conversation.updated` | Server -> Client | `conversation:<id>` & `user:<userId>` | Updates last message preview in chat list |
| `user.block` | Client -> Server | Socket | Blocks a user |
| `user.unblock` | Client -> Server | Socket | Unblocks a user |
| `user.blocked` | Server -> Client | `user:<blockerId>` & `user:<blockedId>` | Notifies UI that block has taken effect |
| `user.unblocked` | Server -> Client | `user:<blockerId>` & `user:<blockedId>` | Notifies UI that block has been removed |
| `user.activity` | Server -> Client | `conversation:<id>` | Real-time presence (online status & last seen) |

---

## 7. Media, Voice & File Attachments Flow

Attachment messaging follows a 2-step lifecycle:
1. **Upload First**: Client posts the binary file to `POST /v1/chat/upload`.
2. **Send Message**: Client attaches the returned URL, MIME type, and duration into `message.send`.

### 7.1 REST Upload Endpoint
- **Method & Path**: `POST /v1/chat/upload`
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `file`: Binary file payload
  - `type`: Category hint (`image`, `video`, `voice`, `file`)
  - `duration`: Recording duration in seconds (for voice and video)
  - `conversationId`: Target conversation UUID
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "status": "success",
    "message": "File uploaded successfully",
    "data": {
      "url": "https://dev-datemate.testdevvvv.site/uploads/chat_voice_8f9a2.m4a",
      "type": "voice",
      "duration": 12.4,
      "fileName": "audio_record.m4a",
      "storedFileName": "chat_voice_8f9a2.m4a",
      "fileSize": 32800,
      "mimeType": "audio/mp4"
    }
  }
  ```

---

## 8. Discovery, Matching & Profile Invariants

### 8.1 Feed & Recommended Invariants
- For both **Feed** (`GET /v1/feed`) and **Recommended** (`GET /v1/recommended`), candidates are eligible as long as `User.profileValidated == true`.
- **Do NOT** assume `selfieUrl` is present. Users with approved verification are valid regardless of whether `selfieUrl` is null.

### 8.2 Gallery & Profile Photo Rules
- **Single Image Upload**: Only 1 gallery photo per upload request (`maxCount: 1`).
- **Gallery Payload as an Object**: Send `gallery` as a single JSON object `{ isProfilePicture?: boolean, description?: string }`, not an array.
- **Default `isProfilePicture`**: When omitted on the first photo, the backend automatically defaults `isProfilePicture: true`.
- **Selecting Profile Picture**: Send `profilePictureId` (integer ID) at root level outside the `Profile` object.

### 8.3 City Details Contract
- In profile responses (`GET /v1/users/profile`), city details reside strictly at `Profile.Demographic.City`:
  ```json
  "City": {
    "id": 150,
    "name": "Tehran",
    "State": {
      "id": 12,
      "name": "Tehran",
      "Country": { "id": 1, "name": "Iran" }
    }
  }
  ```
- In candidate discovery cards (Feed, Recommended, Likes), city is a flat string `city: string | null`.

---

## 9. Device Token & Push Notifications

Register or update the device's push notification token on login and token refresh:
- **Method & Path**: `PUT /v1/users/device-token`
- **Headers**: `Authorization: Bearer <JWT>`
- **Request Body**:
  ```json
  {
    "token": "fcm_or_apns_device_token_string",
    "deviceInfo": {
      "platform": "ios",
      "osVersion": "17.4",
      "appVersion": "2.4.0",
      "model": "iPhone 15 Pro"
    }
  }
  ```
- **Single Canonical Field Names**:
  - Push token field is strictly `token` (never `fcmToken`, `deviceToken`, etc.).
  - Device info field is strictly `deviceInfo`.

---

## 10. Client Code Snippets (Swift & Kotlin)

### 10.1 iOS (Swift / SocketIO-Client-Swift)
```swift
import SocketIO

class ChatManager: ObservableObject {
    static let shared = ChatManager()
    private var manager: SocketManager?
    private var socket: SocketIOClient?

    func connect(token: String) {
        manager = SocketManager(
            socketURL: URL(string: "https://dev-datemate.testdevvvv.site")!,
            config: [
                .log(false),
                .compress,
                .connectParams(["token": token]),
                .extraHeaders(["Authorization": "Bearer \(token)"])
            ]
        )
        socket = manager?.socket(forNamespace: "/chat")

        // 1. Listen for incoming messages
        socket?.on("message.created") { data, _ in
            guard let dict = data[0] as? [String: Any] else { return }
            print("New message received: \(dict)")
        }

        // 2. Listen for read state sync across devices
        socket?.on("conversation.read") { data, _ in
            guard let dict = data[0] as? [String: Any],
                  let convId = dict["conversationId"] as? String else { return }
            print("Conversation \(convId) marked read on another device")
        }

        // 3. Listen for message deletion
        socket?.on("message.deleted") { data, _ in
            guard let dict = data[0] as? [String: Any],
                  let msgId = dict["messageId"] as? String else { return }
            print("Message deleted: \(msgId)")
        }

        // 4. Listen for user blocks
        socket?.on("user.blocked") { data, _ in
            guard let dict = data[0] as? [String: Any] else { return }
            print("User block update: \(dict)")
        }

        socket?.connect()
    }

    func markRead(conversationId: String, messageId: String? = nil) {
        var payload: [String: Any] = ["conversationId": conversationId]
        if let messageId = messageId { payload["messageId"] = messageId }
        socket?.emit("conversation.read", payload)
    }

    func deleteMessage(conversationId: String, messageId: String, forEveryone: Bool) {
        let payload: [String: Any] = [
            "conversationId": conversationId,
            "messageId": messageId,
            "forEveryone": forEveryone
        ]
        socket?.emit("message.delete", payload)
    }
}
```

### 10.2 Android (Kotlin / socket.io-client.java)
```kotlin
package com.dmate.chat

import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject

object ChatSocketManager {
    private var socket: Socket? = null

    fun connect(jwtToken: String) {
        val options = IO.Options().apply {
            transports = arrayOf("websocket", "polling")
            auth = mapOf("accessToken" to jwtToken)
        }

        socket = IO.socket("https://dev-datemate.testdevvvv.site/chat", options)

        // 1. Message created
        socket?.on("message.created") { args ->
            val data = args[0] as JSONObject
            val content = data.optString("content")
            println("Message received: $content")
        }

        // 2. Cross-device read sync
        socket?.on("conversation.read") { args ->
            val data = args[0] as JSONObject
            val convId = data.getString("conversationId")
            println("Conversation read sync: $convId")
        }

        // 3. Message deleted
        socket?.on("message.deleted") { args ->
            val data = args[0] as JSONObject
            val msgId = data.getString("messageId")
            println("Message deleted: $msgId")
        }

        // 4. User blocked
        socket?.on("user.blocked") { args ->
            val data = args[0] as JSONObject
            val userId = data.getLong("userId")
            println("User blocked: $userId")
        }

        socket?.connect()
    }

    fun markConversationAsRead(conversationId: String, messageId: String? = null) {
        val payload = JSONObject().apply {
            put("conversationId", conversationId)
            messageId?.let { put("messageId", it) }
        }
        socket?.emit("conversation.read", payload)
    }

    fun deleteMessage(conversationId: String, messageId: String, forEveryone: Boolean) {
        val payload = JSONObject().apply {
            put("conversationId", conversationId)
            put("messageId", messageId)
            put("forEveryone", forEveryone)
        }
        socket?.emit("message.delete", payload)
    }
}
```
