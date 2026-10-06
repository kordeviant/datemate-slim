# DateMate REST API Specification

Complete reference for all implemented REST API endpoints with request bodies, response payloads, error models, and practical examples.

Interactive Swagger UI documentation is available when running the backend at:
👉 **`http://localhost:3000/docs`**

### OpenAPI JSON & Postman Export
You can export the full OpenAPI 3.0 specification file (`swagger.json`) to import directly into **Postman** or other API clients:

```bash
# Export/update OpenAPI JSON files (datemate-api.json & docs/api/swagger.json)
npm run docs:export
```

- **Offline Files**: Generated at [datemate-api.json](file:///home/parsa/Documents/projects/datemate/backend/datemate-api.json) and [docs/api/swagger.json](file:///home/parsa/Documents/projects/datemate/backend/docs/api/swagger.json).
- **Live Endpoint**: When running the dev server, fetch via `http://localhost:3000/docs-json` or:
  ```bash
  curl -o datemate-api.json http://localhost:3000/docs-json
  ```
- **Postman Import**: Open Postman -> **Import** -> Select `datemate-api.json` (or paste `http://localhost:3000/docs-json`).

> 📘 **Authoritative Client Validation Rules & Guidelines**:  
> For complete specifications on media uploads, username rules, full name, age boundaries, spoken languages whitelist, demographics, and security, refer to the standalone [**RULES.md**](file:///home/parsa/Documents/projects/datemate/backend/docs/RULES.md) or access the live specification at **[`http://localhost:3000/docs/rules`](http://localhost:3000/docs/rules)** (or `/v1/docs/rules`).

---

## 1. Unified Response Envelope (`ResponseResult<T>`)

Every HTTP endpoint returns the standard client-expected envelope:

```typescript
interface ResponseResult<T> {
  status: "success" | "error";
  message: string;
  data: T | null;
  error?: {
    type: string;    // E.g. "UNKNOWN_ERROR", "NOT_PREMIUM", "AGE_TOO_LOW", etc.
    message: string;
  } | null;
}
```

---

## 2. Authentication Endpoints (`/v1/auth`)

### 2.1 Sign Up (Initiate Registration)
- **Method**: `POST`
- **Path**: `/v1/auth/signup`
- **Description**: Validates email and password, generates a 6-digit OTP code, saves pending signup in Redis (10m TTL), and sends a verification email via Nodemailer.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "StrongPassword123!",
    "integrityToken": "base64_play_integrity_token",
    "packageName": "com.dmate.datemate"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Verification code sent to email",
    "data": null,
    "error": null
  }
  ```
- **Error Response (409 Conflict)**:
  ```json
  {
    "status": "error",
    "message": "Email already registered",
    "data": null,
    "error": {
      "type": "UNKNOWN_ERROR",
      "message": "Email already registered"
    }
  }
  ```

---

### 2.2 Verify Code (Complete Registration)
- **Method**: `POST`
- **Path**: `/v1/auth/verify`
- **Description**: Verifies the 6-digit email OTP, creates the user record in PostgreSQL, initiates a device session with refresh token, and returns JWT access & refresh tokens.
- **Request Body**:
  ```json
  {
    "code": "123456",
    "device": "Samsung Galaxy S23",
    "userAgent": "DateMate/2.6 (Android 14)",
    "fcmToken": "eXamPLe-fCm-ToKen..."
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Operation successful",
    "data": {
      "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh": "d9b7f5e1a3c54d8e9f2b1a0c4e7d8f9a...",
      "userId": 101
    },
    "error": null
  }
  ```

---

### 2.3 Sign In (Login)
- **Method**: `POST`
- **Path**: `/v1/auth/signin`
- **Description**: Authenticates email and password, checks ban status, creates a new session, and returns new tokens.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "StrongPassword123!",
    "device": "Google Pixel 8",
    "userAgent": "DateMate/2.6 (Android 14)",
    "fcmToken": "optional_fcm_token",
    "integrityToken": "base64_integrity_token",
    "packageName": "com.dmate.datemate"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Operation successful",
    "data": {
      "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh": "d9b7f5e1a3c54d8e9f2b1a0c4e7d8f9a...",
      "userId": 101
    },
    "error": null
  }
  ```

---

### 2.4 Refresh Token (Token Rotation)
- **Method**: `POST`
- **Path**: `/v1/auth/refresh`
- **Description**: Validates the refresh token, invalidates it immediately (single-use rotation), and issues a fresh access/refresh pair.
- **Request Body**:
  ```json
  {
    "token": "d9b7f5e1a3c54d8e9f2b1a0c4e7d8f9a..."
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Operation successful",
    "data": {
      "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh": "new_refresh_token_string...",
      "userId": 101
    },
    "error": null
  }
  ```

---

### 2.5 Forgot Password
- **Method**: `POST`
- **Path**: `/v1/auth/forgot-password`
- **Description**: Generates a 6-digit reset code in Redis (10m TTL) and sends a reset email to the user.
- **Request Body**:
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "If the email exists, a reset code was sent",
    "data": null,
    "error": null
  }
  ```

---

### 2.6 Reset Password
- **Method**: `POST`
- **Path**: `/v1/auth/reset-password`
- **Description**: Verifies code, updates user password hash, and revokes all existing refresh sessions.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "code": "654321",
    "password": "NewStrongPassword456!"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Password reset successfully",
    "data": null,
    "error": null
  }
  ```

---

### 2.7 Google Play Integrity Nonce
- **Method**: `POST`
- **Path**: `/v1/auth/nonce`
- **Description**: Generates a cryptographically secure random nonce string for Google Play Integrity requests.
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Operation successful",
    "data": "7f8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d...",
    "error": null
  }
  ```

---

### 2.8 Google Sign-In
- **Method**: `POST`
- **Path**: `/v1/auth/google`
- **Headers**: `Authorization: Bearer <Google_Id_Token>`
- **Request Body**:
  ```json
  {
    "device": "Pixel 8",
    "userAgent": "DateMate/2.6",
    "integrityToken": "play_integrity_token",
    "packageName": "com.dmate.datemate"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Operation successful",
    "data": {
      "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh": "d9b7f5e1a3c54d8e9f2b1a0c4e7d8f9a...",
      "userId": 101
    },
    "error": null
  }
  ```

---

### 2.9 Apple Sign-In
- **Method**: `POST`
- **Path**: `/v1/auth/apple`
- **Headers**: `Authorization: Bearer <Apple_Identity_Token>` *(Optional if provided in body)*
- **Request Body**:
  ```json
  {
    "device": "iPhone 15 Pro",
    "userAgent": "DateMate/2.6 (iOS 17.5)",
    "identityToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6...",
    "bundleId": "com.dmate.datemate",
    "firstName": "John",
    "lastName": "Doe"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Operation successful",
    "data": {
      "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh": "d9b7f5e1a3c54d8e9f2b1a0c4e7d8f9a...",
      "userId": 101
    },
    "error": null
  }
  ```

---

## 3. Users Endpoints (`/v1/users`)

### 3.1 Get Current User Profile & Completion Status
- **Method**: `GET`
- **Path**: `/users/me` or `/v1/users/me`
- **Headers**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`
- **Description**: Retrieves the authenticated user's complete profile in Android-matching schema with top-level `id`, `email`, `language`, `lat`, `lon`, `profileValidated`, `isPremium`, and nested `Profile` object containing `fullName`, `username`, `phoneNumber`, `bio`, `languages`, `avatar`, `isPremium`, `profileCompleted`, `Demographic`, `RelationType`, `Answers`, and `LikedActivities`.
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Operation successful",
    "data": {
      "id": 1,
      "email": "user@example.com",
      "language": "EN",
      "lat": 35.6892,
      "lon": 51.389,
      "profileValidated": false,
      "isPremium": false,
      "Profile": {
        "fullName": "Parsa",
        "username": "parsa",
        "phoneNumber": "+1234567890",
        "bio": "Software engineer living in Tehran.",
        "languages": ["fa", "en"],
        "avatar": "/uploads/avatars/avatar_1_1726912345.webp",
        "profileCompleted": true,
        "isPremium": false,
        "Demographic": {
          "birthDate": "1998-11-25",
          "gender": "MALE",
          "height": 180,
          "degree": "DOCTORATE",
          "profession": "Software Engineer",
          "relationStatus": "SINGLE",
          "City": {
            "id": 12,
            "name": "Tehran",
            "state": "Tehran Province",
            "country": "Iran"
          }
        },
        "RelationType": "LONG",
        "Answers": {
          "1": 0
        },
        "LikedActivities": {
          "1": [1, 2],
          "9": 72
        }
      }
    },
    "error": null
  }
  ```
- **Error Response (401 Unauthorized)**:
  ```json
  {
    "status": "error",
    "message": "Missing Authorization header",
    "data": null,
    "error": {
      "type": "UNKNOWN_ERROR",
      "message": "Missing Authorization header"
    }
  }
  ```

---

### 3.2 Update Profile (Step-by-Step Onboarding & Profile Editing)
- **Method**: `PUT` or `POST`
- **Path**: `/v1/users/profile`
- **Headers**:
  - `Authorization: Bearer <JWT_ACCESS_TOKEN>`
  - `Content-Type: multipart/form-data` or `application/json`
- **Mobile Client Support**: Supports `@POST("users/profile")` with `@Part("data")` JSON string (`UpdateUserHttp`) as well as direct JSON/multipart payload.
- **Request Body (Android-matching Schema)**:
  ```json
  {
    "language": "EN",
    "lat": 35.6892,
    "lon": 51.389,
    "profilePictureId": 12,
    "gallery": {
      "isProfilePicture": true,
      "description": "Weekend trip"
    },
    "Profile": {
      "fullName": "Parsa",
      "username": "parsa",
      "phoneNumber": "+1234567890",
      "bio": "Software engineer living in Tehran.",
      "languages": ["Persian", "English"],
      "Demographic": {
        "birthDate": "1998-11-25",
        "gender": "MALE",
        "height": 180,
        "degree": "PhD",
        "profession": "Software Engineer",
        "relationStatus": "Single",
        "City": { "id": 12 }
      },
      "Preferences": { "relation": "LONG" }
    }
  }
  ```
- **O (multipart/form-data)**:
  - `avatar` (File): Public profile picture avatar (JPEG/PNG/WebP, 50KB-5MB, min 300x300).
  - `selfie` (File): Private verification selfie (JPEG/PNG/WebP, 50KB-5MB, min 300x300).
  - `gallery` (File): Single gallery picture file (WebP/JPEG/PNG, min 1200x800, max 3MB). **Note**: only 1 gallery picture file is allowed per request; uploading multiple gallery files in a single request returns `400 Bad Request`.
- **Fields Description**:
  - Top-level: `language` (`EN`/`FA`, case-insensitive), `lat`, `lon`
  - `gallery` (Object): Single gallery photo object `{ isProfilePicture?: boolean, image?: string, description?: string, id?: number }`. Sent strictly outside `Profile` at root level.
    - `isProfilePicture` (Boolean, optional): When uploading a new gallery photo or referencing one, determines if it is the active profile swipe photo. If not sent, backend automatically sets the first gallery image as `isProfilePicture: true` by default.
  - `profilePictureId` (Number, optional): Gallery photo ID to set as active profile picture. **Single canonical contract: sent strictly outside the `Profile` object at the root level** (not duplicated inside `Profile`). **There is no need for `profilePicture` key in the request**.
  - `Profile`: `fullName` (2–100 chars), `username` (3–30 chars), `phoneNumber`, `bio`, `languages` (Array or comma-separated string; accepted: `en`, `fa`, `de`, `fr`, `es`, `it`, `pt`, `ru`, `uk`, `tr`, `ar`, `hi`, `ur`, `zh`, `ja`, `ko`, `nl`, `pl`, `sv`, `no`, `da`, `fi`, `cs`, `el`, `he`. Full language names are converted to 2-letter codes in DB).
  - `Profile.Demographic`: `birthDate` (ISO or YYYY-MM-DD, age 18–80), `gender` (`MALE`/`FEMALE`), `height` (cm), `degree`, `profession`, `relationStatus`, `City.id`
  - `Profile.Preferences`: `relation` (`FUN`, `OPEN`, `LONG`)
- **Incremental Update**: All fields optional; omitted fields retain existing values.
- **Success Response (200 OK)**: Returns updated profile including `Profile.profilePictureId` and `gallery: GalleryItemResponseDto[]`.
- **Error Responses**:
  - `400 Bad Request`: Validation failure (multiple gallery files/items sent, username, language, age, image).
  - `401 Unauthorized`: Missing/invalid JWT.
  - `409 Conflict`: Username already taken.

---

### 3.3 Check Profile Status (Mobile Onboarding Check)
- **Method**: `GET`
- **Path**: `/v1/users/profile`
- **Headers**:
  - `Authorization: Bearer <JWT_ACCESS_TOKEN>`
- **Description**: Fast profile onboarding completion check designed for Android/iOS splash, login, and signup flows (`SignInApiInterface.checkUserProfile`).
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Operation successful",
    "data": true,
    "error": null
  }
  ```
  Returns `true` in `data` if all onboarding requirements are met, or `false` otherwise.
- **Error Responses**:
  - `401 Unauthorized`: Missing or invalid JWT access token.

---

## 4. System Endpoints

### 4.1 Health Check
- **Method**: `GET`
- **Path**: `/health`, `/v1/health`, or `/`
- **Description**: Basic healthcheck endpoint for client and infrastructure connectivity testing.
- **Success Response (200 OK)**:
  ```json
  {
    "status": "ok"
  }
  ```

### 4.2 Authoritative Server Time
- **Method**: `GET`
- **Path**: `/v1/time` or `/time`
- **Description**: Returns server epoch time in milliseconds for mobile clock synchronization.
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Operation successful",
    "data": 1726830000000,
    "error": null
  }
  ```

### 4.3 Platform Rules & Client Validation Specification
- **Method**: `GET`
- **Path**: `/docs/rules` or `/v1/docs/rules` (also aliased as `/rules` and `/v1/rules`)
- **Description**: Authoritative online specification of all validation rules, media requirements, language whitelist, demographic constraints, and payload schemas. Dynamically rendered directly from the backend to ensure clients always see up-to-date rules.
- **Query Parameters**:
  - `format`: `html` (default responsive web view), `json` (structured API JSON), `raw` / `md` (plain Markdown).
  - `download`: Pass `1` to download `DateMate-RULES.md`.
- **Success Response (200 OK)**: Formatted HTML, raw Markdown, or JSON wrapped in standard envelope.

---

## 5. Media & Asset Management API (`/media` & `/assets`)

### 5.1 Upload Media Asset
- **Method**: `POST`
- **Path**: `/v1/media/upload/:type` or `/assets/upload/:type`
- **Asset Types**: `icons`, `images`, `avatars`, `banners`, `audio`, `documents`
- **Consumes**: `multipart/form-data` (`file`)
- **Dedicated Shortcuts**:
  - `POST /v1/media/upload/icons`
  - `POST /v1/media/upload/images`
  - `POST /v1/media/upload/avatars`
- **Success Response (201 Created)**:
  ```json
  {
    "status": "success",
    "message": "Operation successful",
    "data": {
      "filename": "icons_c74384e0323b417187274a6c6c7b9ec3_1727599000000.svg",
      "assetType": "icons",
      "publicUrl": "http://localhost:3000/assets/icons/icons_c74384e0323b417187274a6c6c7b9ec3_1727599000000.svg",
      "relativePath": "icons/icons_c74384e0323b417187274a6c6c7b9ec3_1727599000000.svg",
      "mimeType": "image/svg+xml",
      "sizeBytes": 2458,
      "createdAt": "2026-09-29T11:45:00.000Z"
    },
    "error": null
  }
  ```

### 5.2 Retrieve Public Assets
- **Method**: `GET`
- **Paths**:
  - `/assets/icons/:filename`
  - `/assets/images/:filename`
  - `/assets/avatars/:filename`
  - `/assets/:type/:filename`
- **Description**: Streams the binary asset with high-performance caching headers (`Cache-Control: public, max-age=31536000, immutable`), ETag validation, and `304 Not Modified` conditional support.
- **Success Response (200 OK)**: Binary media content with appropriate `Content-Type`.

### 5.3 Get Supported Asset Types & Rules
- **Method**: `GET`
- **Path**: `/v1/media/types` or `/media/types`
- **Description**: Returns all currently registered asset types, supported MIME types, and file size limits.

---

## 6. Interests Endpoints (`/v1/interests`, `/interests`, `/v1/interest`, `/interest`)

### 6.1 Get All Interest Categories & Interests
- **Method**: `GET`
- **Path**: `/v1/interests` (or `/interests`, `/v1/interest`, `/interest`)
- **Query Parameters**:
  - `language` *(optional)*: `'en'` or `'fa'`.
  - `id` *(optional)*: Category ID filter.
- **Headers**: None (Public)
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Operation successful",
    "data": [
      {
        "id": 1,
        "en": "Food",
        "fa": "غذا",
        "icon": {
          "type": "IMAGE",
          "url": "http://localhost:3000/assets/icons/Beach%20With%20Umbrella.svg",
          "alt": ""
        },
        "Interest": [
          {
            "id": 1,
            "en": "Gaming",
            "fa": "بازی"
          },
          {
            "id": 2,
            "en": "Camping",
            "fa": "کمپینگ"
          },
          {
            "id": 3,
            "en": "Movies",
            "fa": "فیلم"
          },
          {
            "id": 4,
            "en": "Nature",
            "fa": "طبیعت"
          },
          {
            "id": 5,
            "en": "Studying",
            "fa": "مطالعه"
          }
        ]
      }
    ],
    "error": null
  }
  ```

### 6.2 Get Single Interest Category by ID
- **Method**: `GET`
- **Path**: `/v1/interests/:id` (or `/interests/:id`)
- **Path Parameter**: `id` (integer)
- **Headers**: None (Public)

### 6.3 Create Interest Category (Admin Only)
- **Method**: `POST`
- **Path**: `/v1/interests` (or `/interests`)
- **Headers**: `Authorization: Bearer <adminAccessToken>`
- **Request Body**:
  ```json
  {
    "en": "Food",
    "fa": "غذا",
    "icon": "icons/Beach With Umbrella.svg",
    "Interest": [
      { "en": "Gaming", "fa": "بازی" },
      { "en": "Camping", "fa": "کمپینگ" }
    ]
  }
  ```

---

## 7. Admin Panel Endpoints (`/v1/admin`)

Requires `Authorization: Bearer <admin_jwt_token>` with role `ADMIN`.

### 7.1 Dashboard Overview Metrics (GAP-1)
- **Method**: `GET`
- **Path**: `/v1/admin/dashboard/overview` (Full overview payload) or `/v1/admin/dashboard/stats` (KPI counters only)
- **Description**: Returns complete dashboard overview: 4 key KPI counters (`stats`), 7-day weekly activity progression with Persian days & solar dates (`weeklyActivity`), platform gender distribution statistics (`genderStats`), recent user support tickets (`recentTickets`), and pending verification selfies (`recentSelfies`).
- **Response (`GET /v1/admin/dashboard/overview`)**:
  ```json
  {
    "status": "success",
    "message": "Dashboard overview data retrieved successfully",
    "data": {
      "stats": {
        "totalUsers": 6570,
        "onlineUsers": 369,
        "pendingSelfies": 7,
        "unansweredTickets": 7
      },
      "weeklyActivity": [
        { "dayName": "ش", "hours": 210, "dateStr": "۱۰ اسفند", "isPeak": true },
        { "dayName": "ی", "hours": 175, "dateStr": "۱۱ اسفند", "isPeak": false },
        { "dayName": "د", "hours": 190, "dateStr": "۱۲ اسفند", "isPeak": false },
        { "dayName": "س", "hours": 140, "dateStr": "۱۳ اسفند", "isPeak": false },
        { "dayName": "چ", "hours": 160, "dateStr": "۱۴ اسفند", "isPeak": false },
        { "dayName": "پ", "hours": 185, "dateStr": "۱۵ اسفند", "isPeak": false },
        { "dayName": "ج", "hours": 130, "dateStr": "۱۶ اسفند", "isPeak": false }
      ],
      "genderStats": {
        "maleCount": 2694,
        "femaleCount": 3876,
        "malePercentage": 41,
        "femalePercentage": 59
      },
      "recentTickets": [
        {
          "id": 101,
          "code": "۲۳۴۶",
          "userName": "سکینه عالیخانی",
          "avatar": "/uploads/avatars/user1.webp",
          "dateTime": "۱۴۰۳/۰۹/۱۲ - ۱۳:۲۳",
          "time": "۱۴:۲۰",
          "unreadCount": 3,
          "status": "PENDING"
        },
        {
          "id": 102,
          "code": "۲۳۴۷",
          "userName": "اکبر میثاقی",
          "avatar": "/uploads/avatars/user2.webp",
          "dateTime": "۱۴۰۳/۰۹/۱۲ - ۱۳:۲۳",
          "time": "۱۴:۲۰",
          "unreadCount": 1,
          "status": "PENDING"
        },
        {
          "id": 103,
          "code": "۲۳۴۸",
          "userName": "دیوید سلیمانی",
          "avatar": "/uploads/avatars/user3.webp",
          "dateTime": "۱۴۰۳/۰۹/۱۲ - ۱۳:۲۳",
          "time": "۱۴:۲۰",
          "unreadCount": 6,
          "status": "PENDING"
        }
      ],
      "recentSelfies": [
        {
          "id": 1,
          "userId": 45,
          "fullName": "چی چانگ",
          "email": "chichang@gmail.com",
          "avatar": "/uploads/avatars/avatar45.webp",
          "selfieUrl": "/uploads/selfies/selfie45.webp",
          "createdAt": "2026-03-03T11:20:00.000Z"
        },
        {
          "id": 2,
          "userId": 52,
          "fullName": "مرتضی هاشمی",
          "email": "morteza@gmail.com",
          "avatar": "/uploads/avatars/avatar52.webp",
          "selfieUrl": "/uploads/selfies/selfie52.webp",
          "createdAt": "2026-03-03T10:45:00.000Z"
        }
      ]
    },
    "error": null
  }
  ```

### 7.2 Users Directory & Search (GAP-2)
- **Method**: `GET`
- **Path**: `/v1/admin/users`
- **Query Parameters**:
  - `page`: Page number (default: 1)
  - `limit`: Page limit (default: 10, max: 100)
  - `search`: Search name, username, or email
  - `status`: `ALL` | `BLOCKED` | `PENDING_VERIFICATION` | `COMPLETED` (default: `ALL`)
  - `gender`: `MALE` | `FEMALE` | `ALL` (default: `ALL`)
  - `minAge`: Minimum age filter (inclusive, e.g. `24`)
  - `maxAge`: Maximum age filter (inclusive, e.g. `27`)
  - `sortBy`: `createdAt` | `lastSeenAt` | `wallet` (default: `createdAt`)
  - `order`: `asc` | `desc` (default: `desc`)
- **Description**: Returns paginated user records with lightweight payload (excluding heavy gallery, bio, transactions, and chatRooms). Includes `id`, `email`, `fullName`, `avatarUrl`, `age`, `gender`, `isPremium`, `hasPendingSelfie`, `profileValidated`, `isOnline`, `bannedUntil`, and `createdAt`.
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Users list retrieved",
    "data": {
      "items": [
        {
          "id": 1,
          "email": "user@example.com",
          "fullName": "علی رضایی",
          "avatarUrl": "https://api-datemate.testdevvvv.site/uploads/avatars/user1.webp",
          "age": 28,
          "gender": "MALE",
          "isPremium": true,
          "hasPendingSelfie": false,
          "profileValidated": true,
          "isOnline": true,
          "bannedUntil": null,
          "createdAt": "2026-03-15T10:30:00.000Z"
        }
      ],
      "total": 245,
      "page": 1,
      "totalPages": 25
    }
  }
  ```

### 7.3 User Details
- **Method**: `GET`
- **Path**: `/v1/admin/users/:id`
- **Path Parameter**: `id` (integer, e.g. `12`)
- **Headers**: `Authorization: Bearer <ADMIN_JWT_TOKEN>`
- **Description**: Retrieves complete user details for admin modal and inspection tabs (demographics, gallery, transactions, chatRooms, and interests).
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "User details retrieved successfully",
    "data": {
      "id": 12,
      "email": "sarah.smith@example.com",
      "role": "USER",
      "language": "FA",
      "fullName": "سارا محمدی",
      "username": "sarah_m",
      "phoneNumber": "09123456789",
      "bio": "علاقه‌مند به سفر، کوهنوردی و مطالعه کتاب‌های روانشناسی.",
      "avatarUrl": "https://api-datemate.testdevvvv.site/uploads/avatars/user12.webp",
      "selfieUrl": "https://api-datemate.testdevvvv.site/uploads/selfies/user12.webp",
      "profileValidated": true,
      "hasPendingSelfie": false,
      "bannedUntil": null,
      "wallet": 150000,
      "score": 420,
      "notificationsOn": true,
      "isPrivate": false,
      "isOnline": false,
      "isPremium": true,
      "lastSeenAt": "2026-10-05T12:00:00.000Z",
      "createdAt": "2025-11-20T14:22:00.000Z",
      "updatedAt": "2026-04-01T08:15:00.000Z",
      "demographic": {
        "birthDate": "1997-07-05",
        "gender": "FEMALE",
        "age": 29,
        "cityName": "تهران",
        "job": "طراح محصول",
        "degree": "کارشناسی ارشد",
        "height": 168,
        "weight": 58,
        "religion": null,
        "relationStatus": "مجرد"
      },
      "gallery": [
        {
          "id": 101,
          "url": "https://api-datemate.testdevvvv.site/uploads/gallery/photo1.webp",
          "likesCount": 24,
          "createdAt": "2026-01-10T12:00:00.000Z"
        }
      ],
      "transactions": [
        {
          "id": 501,
          "title": "خرید اشتراک طلایی دیتمیت ۳ ماهه",
          "amount": 450000,
          "planName": "اشتراک ویژه طلایی",
          "date": "۱۴۰۳/۱۱/۲۰",
          "bank": "بانک ملت",
          "cardNumber": "****۶۰۳۷",
          "status": "SUCCESS"
        }
      ],
      "chatRooms": [
        {
          "id": 1,
          "title": "کافهگردی و هنر",
          "memberCount": 45,
          "imageUrl": "https://images.unsplash.com/photo-1511632765486-a01980e01a18"
        }
      ],
      "interests": [
        "Traditional Cuisine",
        "Hiking",
        "Art & Design",
        "Cinema",
        "Coffee"
      ]
    }
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Missing or invalid admin token.
  - `403 Forbidden`: Token user does not have ADMIN role.
  - `404 Not Found`:
    ```json
    {
      "status": "error",
      "message": "کاربر مورد نظر یافت نشد"
    }
    ```

### 7.4 Update User & Confirm Selfie Verification
- **Method**: `PATCH` / `PUT`
- **Path**: `/v1/admin/users/:id`
- **Path Parameter**: `id` (integer)
- **Request Body**:
  ```json
  {
    "confirmSelfie": true,
    "bio": "بیوگرافی بروزرسانی‌شده",
    "fullName": "سارا همتی",
    "isPremium": true,
    "wallet": 50.0
  }
  ```
  *(Note: `confirmSelfie: true` validates the user selfie verification, sets `profileValidated = true`, and emits a `PROFILE_VERIFIED` notification)*
- **Response**:
  ```json
  {
    "status": "success",
    "message": "User updated successfully",
    "data": {
      "id": 101,
      "email": "Sarahemati@gmail.com",
      "fullName": "سارا همتی",
      "username": "sara_h",
      "avatarUrl": "http://localhost:3000/assets/avatars/avatar_1.webp",
      "bio": "بیوگرافی بروزرسانی‌شده",
      "isPremium": true,
      "profileValidated": true,
      "selfieVerified": true,
      "isBanned": false,
      "bannedUntil": null,
      "gender": "FEMALE",
      "age": 23,
      "city": "اسلامشهر",
      "registrationCompleted": true,
      "isOnline": true,
      "lastSeenAt": "2026-10-04T07:15:00.000Z",
      "createdAt": "2024-11-20T10:00:00.000Z"
    }
  }
  ```

### 7.5 Ban User (GAP-3)
- **Method**: `POST`
- **Path**: `/v1/admin/users/:id/ban`
- **Path Parameter**: `id` (integer)
- **Request Body**:
  ```json
  {
    "durationHours": 168,
    "reason": "Violation of community rules"
  }
  ```
  *(Note: set `durationHours` to `null` or omit for a permanent ban)*
- **Response**:
  ```json
  {
    "status": "success",
    "message": "User banned successfully",
    "data": {
      "id": 101,
      "email": "Sarahemati@gmail.com",
      "isBanned": true,
      "bannedUntil": "2026-10-11T11:50:00.000Z",
      "reason": "Violation of community rules"
    }
  }
  ```

### 7.6 Unban User
- **Method**: `POST`
- **Path**: `/v1/admin/users/:id/unban`
- **Path Parameter**: `id` (integer)
- **Response**:
  ```json
  {
    "status": "success",
    "message": "User unbanned successfully",
    "data": {
      "id": 101,
      "email": "Sarahemati@gmail.com",
      "isBanned": false,
      "bannedUntil": null
    }
  }
  ```

### 7.5 Pending Selfie Verification Queue (GAP-4)
- **Method**: `GET`
- **Path**: `/v1/admin/verifications`
- **Query Parameters**:
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 10)
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Pending verifications retrieved",
    "data": {
      "items": [
        {
          "userId": 101,
          "fullName": "سارا همتی",
          "username": "sara_h",
          "email": "Sarahemati@gmail.com",
          "avatarUrl": "http://localhost:3000/assets/avatars/avatar_1.webp",
          "selfieUrl": "http://localhost:3000/assets/selfies/selfie_1.webp",
          "gender": "FEMALE",
          "age": 23,
          "city": "اسلامشهر",
          "submittedAt": "2026-10-04T07:15:00.000Z",
          "createdAt": "2024-11-20T10:00:00.000Z"
        }
      ],
      "total": 7,
      "page": 1,
      "totalPages": 1
    }
  }
  ```

### 7.6 Approve Selfie Verification (GAP-4)
- **Method**: `POST`
- **Path**: `/v1/admin/verifications/:userId/approve`
- **Action**: Sets `User.profileValidated = true` and sends `NotificationType.PROFILE_VERIFIED`.
- **Response**:
  ```json
  {
    "status": "success",
    "message": "User selfie verification approved",
    "data": {
      "userId": 101,
      "profileValidated": true
    }
  }
  ```

### 7.7 Reject Selfie Verification (GAP-4)
- **Method**: `POST`
- **Path**: `/v1/admin/verifications/:userId/reject`
- **Request Body**:
  ```json
  {
    "reason": "Blurry face or does not match profile picture"
  }
  ```
- **Action**: Clears selfie, sets `profileValidated = false`, and sends `NotificationType.PROFILE_VERIFIED` rejection notification.
- **Response**:
  ```json
  {
    "status": "success",
    "message": "User selfie verification rejected",
    "data": {
      "userId": 101,
      "profileValidated": false,
      "reason": "Blurry face or does not match profile picture"
    }
  }
  ```





