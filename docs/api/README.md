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

## 2. Authentication Endpoints (`/auth`)

### 2.1 Sign Up (Initiate Registration)
- **Method**: `POST`
- **Path**: `/auth/signup`
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
- **Path**: `/auth/verify`
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
- **Path**: `/auth/signin`
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
- **Path**: `/auth/refresh`
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
- **Path**: `/auth/forgot-password`
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
- **Path**: `/auth/reset-password`
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
- **Path**: `/auth/nonce`
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
- **Path**: `/auth/google`
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
- **Path**: `/auth/apple`
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

## 3. Users Endpoints (`/users`)

### 3.1 Check Profile Completion
- **Method**: `GET`
- **Path**: `/users/profile`
- **Headers**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`
- **Description**: Checks whether the authenticated user has created a profile and uploaded an avatar.
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Operation successful",
    "data": true,
    "error": null
  }
  ```

---

## 4. System Endpoints

### 4.1 Health Check
- **Method**: `GET`
- **Path**: `/`
- **Success Response (200 OK)**:
  ```json
  {
    "status": "ok"
  }
  ```

### 4.2 Authoritative Server Time
- **Method**: `GET`
- **Path**: `/time`
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
