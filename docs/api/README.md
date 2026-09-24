# DateMate REST API Specification

Complete reference for all implemented REST API endpoints with request bodies, response payloads, error models, and practical examples.

Interactive Swagger UI documentation is available when running the backend at:
👉 **`http://localhost:3000/docs`**

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

### 3.1 Check Profile Completion
- **Method**: `GET`
- **Path**: `/v1/users/profile`
- **Headers**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`
- **Description**: Checks whether the authenticated user has completed their profile and answered all onboarding questions. Returns `false` until all onboarding questions and steps are completed.
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Operation successful",
    "data": false,
    "error": null
  }
  ```

---

### 3.2 Update Profile (Step-by-Step Onboarding & Profile Editing)
- **Method**: `PUT`
- **Path**: `/v1/users/profile`
- **Headers**:
  - `Authorization: Bearer <JWT_ACCESS_TOKEN>`
  - `Content-Type: multipart/form-data`
- **Form-Data Fields (all fields optional to support incremental step-by-step onboarding and profile editing)**:
  - `avatar` (File, optional): Profile picture (JPEG, PNG, or WebP; 50 KB – 5 MB; min 300x300, max 4096x4096).
  - `firstName` (Text, optional): User first name (2–50 characters, cannot be only numbers).
  - `username` (Text, optional): Unique username handle (3–30 characters, no spaces/emojis/HTML, cannot start/end with symbols or have consecutive symbols, reserved names prohibited).
  - `birthDate` (Text, optional): Date of birth (`YYYY-MM-DD`, valid calendar date, strictly 18–80 years old; locked against modification after initial setup without support verification).
  - `age` (Number, optional): User age in years (alternative fallback if client sends age directly).
  - `gender` (Text, optional): Must be strictly `Male` or `Female`.
  - `language` (Text, optional): User language: `EN` (English) or `FA` (Farsi), case-insensitive (normalized to lowercase `en` or `fa` in the database).
  - `phoneNumber` (Text, optional): Contact phone number.
  - `bio` (Text, optional): User biography / description.
  - `cityId` (Number, optional): Selected city ID from region selection.
  - `latitude` (Number, optional): Latitude coordinate (defaults to `0.0`).
  - `longitude` (Number, optional): Longitude coordinate (defaults to `0.0`).

- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Operation successful",
    "data": {
      "userId": 1,
      "firstName": "John",
      "username": "john_doe",
      "phoneNumber": "+1234567890",
      "bio": "Software engineer living in Tehran.",
      "avatarUrl": "/uploads/avatars/avatar_1_1726912345.webp",
      "age": 27,
      "gender": "MALE",
      "cityId": 12,
      "language": "en",
      "profileCompleted": false
    },
    "error": null
  }
  ```

- **Error Responses**:
  - `400 Bad Request`: Validation failure on username format, invalid language (not `EN`/`FA`), age limits (<18 or >80), or corrupted image.
  - `401 Unauthorized`: Missing or invalid JWT access token.
  - `409 Conflict`: Username already in use by another user.

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


