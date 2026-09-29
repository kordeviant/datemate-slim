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
- **Description**: Retrieves the authenticated user's complete profile in Android-matching schema with top-level `id`, `email`, `language`, `lat`, `lon`, `profileValidated`, and nested `Profile` object containing `fullName`, `username`, `phoneNumber`, `bio`, `languages`, `avatar`, `profileCompleted`, `Demographic`, `Preferences`, and `Answers`. (Note: `selfie` URL is not returned: this will not use still, only client should send; `LikedActivities` is removed).
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
      "Profile": {
        "fullName": "Parsa",
        "username": "parsa",
        "phoneNumber": "+1234567890",
        "bio": "Software engineer living in Tehran.",
        "languages": ["fa", "en"],
        "avatar": "/uploads/avatars/avatar_1_1726912345.webp",
        "profileCompleted": true,
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
        "Preferences": {
          "relation": "LONG"
        },
        "Answers": {
          "1": 0
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
- **Optional File Fields (multipart/form-data)**:
  - `avatar` (File): Public profile picture (JPEG/PNG/WebP, 50KB-5MB, min 300x300).
  - `selfie` (File): Private verification selfie (JPEG/PNG/WebP, 50KB-5MB, min 300x300). Note: this will not use still, only client should send; server does not return selfie URL in response.
- **Fields Description**:
  - Top-level: `language` (`EN`/`FA`, case-insensitive), `lat`, `lon`
  - `Profile`: `fullName` (2–100 chars), `username` (3–30 chars), `phoneNumber`, `bio`, `languages` (Array or comma-separated string; accepted: `en`, `fa`, `de`, `fr`, `es`, `it`, `pt`, `ru`, `uk`, `tr`, `ar`, `hi`, `ur`, `zh`, `ja`, `ko`, `nl`, `pl`, `sv`, `no`, `da`, `fi`, `cs`, `el`, `he`. Full language names are converted to 2-letter codes in DB).
  - `Profile.Demographic`: `birthDate` (ISO or YYYY-MM-DD, age 18–80), `gender` (`MALE`/`FEMALE`), `height` (cm), `degree`, `profession`, `relationStatus`, `City.id`
  - `Profile.Preferences`: `relation` (`FUN`, `OPEN`, `LONG`)
- **Incremental Update**: All fields optional; omitted fields retain existing values.
- **Success Response (200 OK)**: Same schema as `GET /users/me`.
- **Error Responses**:
  - `400 Bad Request`: Validation failure (username, language, age, image).
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




