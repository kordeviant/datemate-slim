# DateMate Platform Rules & Client Validation Specification

> **Authoritative Specification for Client Developers (Android, iOS, Web)**  
> **Live Online Endpoint**: [`/docs/rules`](http://localhost:3000/docs/rules) or [`/v1/docs/rules`](http://localhost:3000/v1/docs/rules) | **Swagger API Docs**: [`/docs`](http://localhost:3000/docs)  
> **Last Updated**: September 2026 • Automatically synchronized on each backend update

This standalone document defines all validation rules, formats, constraints, permitted values, and error behaviors for the DateMate platform. Client applications must follow these rules before submitting data to avoid `400 Bad Request` or `409 Conflict` errors.

---

## Accessing This Document Online

This rules document is hosted live directly by the backend server:

| Format | URL | Description |
| :--- | :--- | :--- |
| **Interactive Web Page** | `GET /docs/rules` or `GET /v1/docs/rules` | Formatted responsive documentation with dark mode and copy buttons |
| **Raw Markdown** | `GET /docs/rules?format=raw` | Plain markdown text for embedding in IDEs, CLIs, or mobile apps |
| **Downloadable .md** | `GET /docs/rules?download=1` | Downloads `DateMate-RULES.md` directly |
| **Structured JSON** | `GET /docs/rules?format=json` | Returns `{ title, version, lastUpdated, content }` in standard response envelope |

---

## Table of Contents
1. [Media & Image Upload Rules](#1-media--image-upload-rules)
   - [1.1 Scalable Media Upload & Public Asset System](#scalable-media-upload--public-asset-system)
   - [1.2 Avatar vs. Selfie Distinction](#avatar-vs-selfie-distinction)
   - [1.3 Gallery & Profile Picture Update Rules](#13-gallery--profile-picture-update-rules-put-v1usersprofile--post-v1usersprofile)
2. [Username Rules](#2-username-rules)
3. [Full Name Rules](#3-full-name-rules)
4. [Date of Birth & Age Restrictions](#4-date-of-birth--age-restrictions)
5. [Languages Rules](#5-languages-rules)
   - [5.1 App Interface Language (`language`)](#51-app-interface-language-language)
   - [5.2 Spoken Languages in Profile (`Profile.languages`)](#52-spoken-languages-in-profile-profilelanguages)
6. [Demographics & Attributes](#6-demographics--attributes)
   - [6.1 Gender](#61-gender)
   - [6.2 Height & Weight](#62-height--weight)
   - [6.3 Education Degree](#63-education-degree)
   - [6.4 Profession / Occupation](#64-profession--occupation)
   - [6.5 Relationship Status](#65-relationship-status)
   - [6.6 City & Geolocation Coordinates](#66-city--geolocation-coordinates)
7. [Dating Preferences & Lifestyle](#7-dating-preferences--lifestyle)
   - [7.1 Relation Type](#71-relation-type)
   - [7.2 Lifestyle Attributes (Drinking, Smoking, Kids, Pets, Religion)](#72-lifestyle-attributes)
8. [Personality & Astrological Sign](#8-personality--astrological-sign)
9. [Profile Completion & Verification](#9-profile-completion--verification)
10. [Account & Security Rules](#10-account--security-rules)
11. [Client Payload Schema Reference](#11-client-payload-schema-reference)
12. [HTTP Response Envelope & Error Codes](#12-http-response-envelope--error-codes)

---

## 1. Media & Image Upload Rules

DateMate strictly verifies image files at the binary level using magic bytes to protect platform integrity and ensure optimal mobile rendering.

| Rule | Requirement | Backend Enforcement |
| :--- | :--- | :--- |
| **Supported Formats by Asset Type** | **Icons**: SVG, PNG, WebP<br>**Images**: JPEG, PNG, WebP, GIF<br>**Avatars**: JPEG, PNG, WebP<br>**Audio**: MP3, OGG, WAV, WebM, AAC | Binary magic bytes validated per asset type rules |
| **Prohibited Formats** | Scripts, Executables (APK, EXE, ZIP), Malicious SVG with scripts | Strictly rejected with `400 Bad Request` |
| **File Size Limits by Type** | **Icons**: Max 2 MB<br>**Images**: Max 15 MB<br>**Avatars**: Min 10 KB, Max 10 MB<br>**Audio**: Max 20 MB | Files exceeding type bounds rejected with `400 Bad Request` |
| **Server Processing** | Auto-oriented via EXIF, resized, WebP conversion, GPS metadata stripped | Sharp library cleans image metadata |
| **Scalable Public Routes** | `/assets/icons/{filename}`<br>`/assets/images/{filename}`<br>`/assets/avatars/{filename}`<br>`/assets/selfies/{filename}`<br>`/assets/{type}/{filename}` | Dynamic asset controller with ETag and immutable caching |
| **Storage Independence** | Files stored on disk or S3/object storage by asset type; public URL generated dynamically via `baseUrl` | DB stores relative key; domain changes require zero DB migrations |
| **Unique Safe Filenames** | `<assetType>_<uuidHex>_<timestamp>.<ext>` | URL-safe, collision-proof, path-traversal protected |

### Scalable Media Upload & Public Asset System
- **Public URL Resolution (`baseUrl`)**:
  - The public asset URL is never hardcoded in the database.
  - The server reads `ASSET_BASE_URL` (or fallback `MEDIA_BASE_URL` / `APP_BASE_URL`) from environment configuration.
  - Changing domains or switching to a CDN (e.g. `https://cdn.datemate.com`) is achieved simply by updating `ASSET_BASE_URL` in `.env` without modifying stored database records.
- **Upload Endpoints**:
  - `POST /media/upload/:type` (and `/assets/upload/:type`): Upload by asset type parameter (`icons`, `images`, `avatars`, `selfies`).
  - Specialized endpoints: `POST /media/upload/icons`, `POST /media/upload/images`, `POST /media/upload/avatars`.
  - Returns `MediaUploadResponseDto` containing `filename`, `assetType`, full `publicUrl` (resolved with `baseUrl`), `relativePath`, and `sizeBytes`.
- **Public Asset Serving**:
  - `GET /assets/icons/{filename}`
  - `GET /assets/images/{filename}`
  - `GET /assets/avatars/{filename}`
  - `GET /assets/selfies/{filename}`
  - `GET /assets/{type}/{filename}` (extensible to any future asset types like `banners`, `audio`, `documents`).
  - High-performance caching: `Cache-Control: public, max-age=31536000, immutable`, `ETag` conditional `304 Not Modified`.

### Avatar vs. Selfie Distinction
- **`avatar` (Public Profile Picture)**:
  - Displayed publicly to other users in match feeds and profile cards.
  - Returned in profile responses as full public URL: `Profile.avatar: string` (e.g. `http://localhost:3000/assets/avatars/avatar_1.webp`).
- **`selfie` (Private Verification Photo)**:
  - Used **strictly by human administrators** to verify the user identity against the avatar photo.
  - Stored privately in `/uploads/selfies/selfie_<userId>_<timestamp>.webp` or S3 bucket.
  - **CRITICAL CLIENT INVARIANT**: The server **never returns the selfie URL** in any profile response (`Profile.selfie` is not returned: *this will not use still, only client should send*). The client sends the selfie photo during onboarding/edit, but does not receive or render it back.

### 1.3 Gallery & Profile Picture Update Rules (`PUT /v1/users/profile` & `POST /v1/users/profile`)

DateMate strictly separates identity avatars, private verification selfies, and public profile swipe photos.

| Rule | Requirement | Backend Enforcement |
| :--- | :--- | :--- |
| **Single Image Upload Per Request** | At most **one gallery picture** can be uploaded per request (`maxCount: 1`) | Multi-image uploads are strictly rejected with `400 Bad Request` (`Only one gallery image is allowed per request`). |
| **Gallery Payload as an Object** | Request metadata must be a **single JSON object**, NOT an array | Payload format: `gallery: { isProfilePicture?: boolean, description?: string }` (parsed from string in multipart form-data). |
| **Default `isProfilePicture` Behavior** | `isProfilePicture` is optional | If omitted, backend automatically defaults `isProfilePicture: true` on the user's first gallery image upload. |
| **Selecting Existing Profile Picture (`profilePictureId`)** | Client passes integer ID at root level | Sets the designated gallery image as the active swipe photo. **No `profilePicture` string URL key is required or accepted in the request**. |
| **Single Canonical Contract (Strictly Outside `Profile`)** | `gallery` and `profilePictureId` belong **strictly at root level** | Never duplicate or accept `gallery` or `profilePictureId` inside the `Profile` object. |
| **Resolution & Size Limits** | Minimum **1200x800**, maximum **4096x4096**, max **3 MB** | Images below 1200x800 or exceeding 3MB rejected with `400 Bad Request`. Automatically converted to optimized WebP. |

---

## 2. Username Rules

The username is the user's unique identity handle across the platform.

| Rule | Constraint | Details & Examples |
| :--- | :--- | :--- |
| **Length** | **3 to 30 characters** | Outer whitespace automatically trimmed |
| **Allowed Characters** | `a-z`, `A-Z`, `0-9`, `.`, `_`, `-` | Strictly alphanumeric with dots, underscores, and hyphens |
| **Must Contain Letters** | Cannot be numbers only | e.g. `12345` is **rejected**; `user123` is **accepted** |
| **Start / End Boundaries** | Must start and end with an alphanumeric character | `_john` or `john.` are **rejected**; `john_doe` is **accepted** |
| **Consecutive Special Chars** | No adjacent dots, underscores, or hyphens | `john..doe`, `john__doe`, `john.-doe` are **rejected** |
| **Forbidden Characters** | No spaces, zero-width chars, emojis, or script chars | Prohibited: ` `, emojis (`\p{Extended_Pictographic}`), `< > ' " ; { } --` |
| **Uniqueness** | Must be globally unique (case-insensitive) | `JohnDoe` and `johndoe` collide (`409 Conflict`) |
| **Reserved Names** | Prohibited administrative & brand names | `admin`, `system`, `support`, `moderator`, `staff`, `official`, `verified`, `datemate`, `root`, etc. |
| **Status Impersonation** | Prohibited prefix or suffix status badges | Cannot begin or end with `verified_`, `_verified`, `official_`, `_official`, `admin_`, `_admin`, etc. |

---

## 3. Full Name Rules

- **Property**: `Profile.fullName`
- **Replaces**: Legacy `firstName` and `lastName` fields.
- **Length**: Between **2 and 100 characters**.
- **Content Restriction**: Cannot contain only numbers. Must contain real non-numeric characters.
- **Trimming**: Leading and trailing whitespaces are automatically stripped.

---

## 4. Date of Birth & Age Restrictions

DateMate is an adult dating platform with strict legal age validation.

| Rule | Requirement | Notes |
| :--- | :--- | :--- |
| **Format** | `YYYY-MM-DD` (e.g. `1998-11-25`) | Output responses always return `YYYY-MM-DD` format |
| **Input Acceptance** | `YYYY-MM-DD` or standard ISO string (`1998-11-25T00:00:00.000Z`) | Automatically normalized to `YYYY-MM-DD` |
| **Calendar Validity** | Strict Gregorian calendar validation | Rejects impossible dates (e.g. `2000-02-30`, `1998-13-01`) |
| **Future Dates** | Prohibited | Cannot be greater than current UTC date |
| **Minimum Age** | **18 years old** | Users `< 18` rejected with `400 Bad Request` |
| **Maximum Age** | **80 years old** | Users `> 80` rejected with `400 Bad Request` |
| **Immutability** | Anti-fraud protection | Once set during onboarding, DOB cannot be altered without administrative support |

---

## 5. Languages Rules

DateMate manages two separate language dimensions:

### 5.1 App Interface Language (`language`)
Controls the application UI localization (menu labels, notifications, system messages).

- **Accepted Values**: `EN`, `FA` (case-insensitive: `'en'`, `'fa'`, `'EN'`, `'FA'`).
- **Normalized Response**: Returned in uppercase as `"EN"` or `"FA"`.
- **Database Storage**: PostgreSQL enum `Language` in `users.language`.
- **Rejection**: Any code other than `EN`/`FA` (e.g. `FR`, `DE`) throws `400 Bad Request`.

### 5.2 Spoken Languages in Profile (`Profile.languages`)
Lists the languages the user speaks fluently, displayed on their public dating profile.

- **Strict Whitelist (25 Accepted Languages)**:
  `'en'`, `'fa'`, `'de'`, `'fr'`, `'es'`, `'it'`, `'pt'`, `'ru'`, `'uk'`, `'tr'`, `'ar'`, `'hi'`, `'ur'`, `'zh'`, `'ja'`, `'ko'`, `'nl'`, `'pl'`, `'sv'`, `'no'`, `'da'`, `'fi'`, `'cs'`, `'el'`, `'he'`
- **Full Name to Code Mapping**:
  The client can send full English or native language names (e.g. `Persian`, `German`, `Français`, `日本語`). The backend automatically converts and stores the **2-letter lowercase code** in the database.
- **Accepted Input Formats**:
  1. JSON Array of strings: `["fa", "en"]` or `["Persian", "English"]`
  2. JSON-stringified array (in multipart form data): `'["Persian", "English"]'`
  3. Comma-separated string: `"Persian, English, German"`
- **Deduplication**: Repeated languages (e.g. `["en", "English"]`) are automatically deduplicated to `["en"]`.
- **Database Storage**: Saved as a JSON array of 2-letter codes (`JsonB`) in `profiles.languages`: e.g. `["fa", "en"]`.
- **Rejection**: Any language outside the 25 allowed languages (e.g. `["klingon"]`, `["xx"]`) is rejected with `400 Bad Request`.

#### Complete Language Code Mapping Table
| Code | Standard English Name | Alternative & Native Names Accepted |
| :--- | :--- | :--- |
| `en` | English | English |
| `fa` | Persian / Farsi | Farsi, Parsi |
| `de` | German | Deutsch |
| `fr` | French | Français, Francais |
| `es` | Spanish | Español, Espanol, Castilian |
| `it` | Italian | Italiano |
| `pt` | Portuguese | Português, Portugues |
| `ru` | Russian | Русский, Russkiy |
| `uk` | Ukrainian | Українська, Ukrayinska |
| `tr` | Turkish | Türkçe, Turkce |
| `ar` | Arabic | العربية, Arabiya |
| `hi` | Hindi | हिन्दी |
| `ur` | Urdu | اردو |
| `zh` | Chinese | Mandarin, Cantonese, Zhongwen, 中文 |
| `ja` | Japanese | Nihongo, 日本語 |
| `ko` | Korean | Hangul, Hangugeo, 한국어 |
| `nl` | Dutch | Nederlands, Flemish |
| `pl` | Polish | Polski |
| `sv` | Swedish | Svenska |
| `no` | Norwegian | Norsk |
| `da` | Danish | Dansk |
| `fi` | Finnish | Suomi |
| `cs` | Czech | Čeština, Cestina |
| `el` | Greek | Ελληνικά, Ellinika, Ellenika |
| `he` | Hebrew | עברית, Ivrit |

---

## 6. Demographics & Attributes

### 6.1 Gender
- **Property**: `Profile.Demographic.gender`
- **Accepted Input**: `Male` or `Female` (case-insensitive: `male`, `female`, `MALE`, `FEMALE`).
- **Normalized Response**: Uppercase `"MALE"` or `"FEMALE"`.
- **Database Storage**: Enum `Gender` in `demographics.gender`.

### 6.2 Height & Weight
- **Height (`Profile.Demographic.height`)**:
  - Unit: Centimeters (cm).
  - Constraint: Positive number greater than 0 (e.g. `180`).
- **Weight (`Profile.Demographic.weight`)**:
  - Unit: Kilograms (kg).
  - Constraint: Positive number greater than 0 (optional).

### 6.3 Education Degree
- **Property**: `Profile.Demographic.degree`
- **Accepted Values & Auto-Mapping**:
  - `DOCTORATE`: `'PhD'`, `'Doctorate'`, `'Doctoral'`
  - `MASTER_DEGREE`: `'Master'`, `'Masters'`, `'MSc'`, `'MA'`
  - `BACHELOR_DEGREE`: `'Bachelor'`, `'Bachelors'`, `'BSc'`, `'BA'`
  - `ASSOCIATE_DEGREE`: `'Associate'`, `'College Degree'`
  - `SOME_COLLEGE`: `'Some College'`, `'University Student'`
  - `HIGH_SCHOOL_DIPLOMA`: `'High School'`, `'Diploma'`
  - `RATHER_NOT_SAY`: `'Rather not say'`, `'Private'`

### 6.4 Profession / Occupation
- **Property**: `Profile.Demographic.profession`
- **Type**: String, up to 100 characters (e.g. `"Software Engineer"`).

### 6.5 Relationship Status
- **Property**: `Profile.Demographic.relationStatus`
- **Accepted Values & Auto-Mapping**:
  - `SINGLE`: `'Single'`, `'Unmarried'`
  - `IN_A_RELATIONSHIP`: `'In a relationship'`, `'Dating'`
  - `MARRIED`: `'Married'`
  - `COMPLICATED`: `'Complicated'`, `'It\'s complicated'`
  - `OPEN_RELATIONSHIP`: `'Open relationship'`, `'Open'`
  - `DIVORCED`: `'Divorced'`
  - `WIDOWED`: `'Widowed'`
  - `RATHER_NOT_SAY`: `'Rather not say'`

### 6.6 City & Geolocation Coordinates
- **City (`Profile.Demographic.City.id`)**:
  - Must be a valid integer ID referencing the `cities` catalog.
  - **Foreign Key Safety**: If the requested `cityId` does not exist in the database, the server returns `City: null` instead of failing, preventing foreign key constraint errors.
- **Latitude & Longitude (`lat`, `lon`)**:
  - `lat`: Decimal number between `-90.0` and `90.0`.
  - `lon`: Decimal number between `-180.0` and `180.0`.

---

## 7. Dating Preferences & Lifestyle

### 7.1 Relation Type
- **Property**: `Profile.Preferences.relation`
- **Defines**: The kind of relationship the user is seeking.
- **Accepted Values & Auto-Mapping**:
  - `FUN`: `'Fun and Dating'`, `'Fun'`, `'Casual'`
  - `OPEN`: `'Open'`, `'Open to anything'`
  - `LONG`: `'Long term'`, `'Serious relationship'`, `'Long'`

### 7.2 Lifestyle Attributes
- **Drinking (`Preferences.drinking`)**: `SOCIALLY`, `NEVER`, `OCCASIONALLY`, `REGULARLY`, `RATHER_NOT_SAY`
- **Smoking (`Preferences.smoking`)**: `YES`, `NO`, `SOMETIMES`, `RATHER_NOT_SAY`
- **Kids (`Preferences.kids`)**: `LOVE_KIDS`, `MAYBE_SOME_DAY_WANT_KIDS`, `UNDECIDED_ABOUT_KIDS`, `DO_NOT_WANT_KIDS`, `ALREADY_HAVE_KIDS`, `RATHER_NOT_SAY`
- **Pets (`Preferences.pets`)**: `CATS`, `DOGS`, `CATS_AND_DOGS`, `OTHER_ANIMALS`, `NO_PETS`, `RATHER_NOT_SAY`
- **Religion (`Demographic.religion`)**: `CHRISTIANITY`, `ISLAM`, `HINDUISM`, `BUDDHISM`, `JUDAISM`, `SPIRITUALITY`, `AGNOSTIC`, `ATHEISM`, `OTHER`, `RATHER_NOT_SAY`

---

## 8. Personality & Astrological Sign

- **Mood (`Personality.mood`)**:
  `INTROVERT`, `EXTROVERT`, `SOMEWHERE_IN_BETWEEN`, `RATHER_NOT_SAY`
- **Star Sign (`Personality.starSign`)**:
  `ARIES`, `TAURUS`, `GEMINI`, `CANCER`, `LEO`, `VIRGO`, `LIBRA`, `SCORPIO`, `SAGITTARIUS`, `CAPRICORN`, `AQUARIUS`, `PISCES`, `RATHER_NOT_SAY`

---

## 9. Profile Completion & Verification

### 9.1 Profile Completion (`Profile.profileCompleted: boolean`)
The backend calculates profile completion dynamically. It evaluates to `true` **only** when all of the following conditions are met:
1. **Basic Info**: `fullName` (valid), `username` (valid), `avatarUrl` (uploaded), and at least one spoken language in `languages`. (Note: `selfie` upload is an optional identity verification step and is not required for profile onboarding completion).
2. **Demographics**: `birthDate` (18–80), `gender`, `height` (>0), `degree`, `job`/`profession`, and `relationStatus`.
3. **Preferences**: `relation` (relationship kind specified).
4. **Question Answers**: The user has answered all mandatory questions currently configured in the database (questions of type `PREFERENCES` and `INTERESTS` are excluded from the profile completion check).

> **Status Check Endpoints**: Both `GET /users/profile` and `GET /v1/users/profile` return `{ "status": "success", "data": boolean }` for instant splash/onboarding redirection in client apps. Both `GET /users/me` and `GET /v1/users/me` retrieve the full profile with `Answers`.

### 9.2 Profile Identity Validation (`profileValidated: boolean`)
- Indicates whether an administrator has manually approved the user's private verification selfie against their public avatar.
- Unvalidated users may have restricted interactions depending on platform safety configurations.

---

## 10. Account & Security Rules

- **Email**: Must be a valid email format (`@IsEmail()`), unique across users.
- **Password**:
  - Minimum **8 characters**.
  - Must include at least 1 uppercase letter (`A-Z`), 1 lowercase letter (`a-z`), 1 number (`0-9`), and 1 special symbol (`!@#$%^&*`).
- **Email Verification OTP**:
  - 6-digit numeric code generated upon signup or forgot-password.
  - Stored in Redis with a **10-minute expiration (TTL)**.
- **JWT Access Token**:
  - Lifespan: **15 minutes**.
  - Transmitted via `Authorization: Bearer <TOKEN>`.
- **JWT Refresh Token**:
  - Lifespan: **7 days**.
  - Single-use rotation: Each refresh generates a new token pair and revokes the used token. Reuse of a revoked token invalidates all active sessions for security.
- **Google Play Integrity Nonce**:
  - Generated via `POST /v1/auth/nonce`.
  - Cryptographically secure 32-byte hex string for anti-tamper client verification.
- **Incremental Update Invariant ("Don't touch what already exists")**:
  - In `PUT /v1/users/profile`, **all fields are optional**.
  - Any omitted field or section retains its existing database value. Omitted fields are **never** cleared or set to null unintentionally.

---

## 11. Client Payload Schema Reference

### 11.1 Complete Profile Update Request (`PUT /v1/users/profile`)
```json
{
  "language": "EN",
  "lat": 35.6892,
  "lon": 51.389,
  "profilePictureId": 12,
  "gallery": {
    "isProfilePicture": true,
    "description": "Weekend vibes"
  },
  "Profile": {
    "fullName": "Parsa",
    "username": "parsa",
    "phoneNumber": "+1234567890",
    "bio": "Software engineer living in Tehran.",
    "languages": ["Persian", "English"],
    "Demographic": {
      "birthDate": "1998-11-25",
      "gender": "Male",
      "height": 180,
      "degree": "PhD",
      "profession": "Software Engineer",
      "relationStatus": "Single",
      "City": { "id": 12 }
    },
    "Preferences": {
      "relation": "Long term"
    }
  }
}
```

> **Multipart Form-Data Flexibility**:
> When uploading avatars/selfies/gallery via `multipart/form-data`, clients can send data in either:
> 1. **Structured / JSON string**: A `Profile` text field containing stringified JSON, with `gallery` and `profilePictureId` strictly at the root level outside `Profile`, or
> 2. **Flat form-data fields**: Direct fields (`fullName`, `username`, `birthDate`, `gender`, `height`, `degree`, `profession`, `relationStatus`, `cityId`, `relation`, `languages`, `profilePictureId`, `gallery`).
> Both nested JSON string and flat multipart form-data formats are fully accepted.
> **Note**: At most 1 gallery image upload is allowed per request (`maxCount: 1`).

### 11.2 Profile Response Schema (`GET /v1/users/me` & `PUT /v1/users/profile`)
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
    "profileValidated": true,
    "isPremium": false,
    "Profile": {
      "fullName": "Parsa",
      "username": "parsa",
      "phoneNumber": "+1234567890",
      "bio": "Software engineer living in Tehran.",
      "languages": ["fa", "en"],
      "avatar": "/uploads/avatars/avatar_1_1726912345.webp",
      "profilePicture": "http://localhost:3000/assets/images/gallery_1_123.webp",
      "profilePictureId": 12,
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
      }
    },
    "gallery": [
      {
        "id": 12,
        "url": "http://localhost:3000/assets/images/gallery_1_123.webp",
        "description": "Weekend vibes",
        "likesCount": 0,
        "isProfilePicture": true,
        "createdAt": "2026-10-05T12:00:00.000Z"
      }
    ]
  },
  "error": null
}
```

> **Client Invariants**:
> - Only `fullName` is used (`firstName` is removed).
> - Profile answers only return `Answers` map `{ [questionId]: answerId }` (no `answersList` or `answerIds`, and no text). The client resolves question and answer text using the questions list fetched from `GET /v1/questions`.
> - `LikedActivities` is removed.
> - `selfie` URL is omitted from responses (`this will not use still, only client should send`).
> - **Gallery single object**: In requests, `gallery` is sent as a single object `{ isProfilePicture?: boolean, description?: string }` (maximum 1 image file per request).
> - **Root-level placement (No Duplication)**: Both `gallery` and `profilePictureId` belong strictly at the root level outside `Profile`. No `profilePicture` string URL key is required.

---

## 12. HTTP Response Envelope & Error Codes

Every endpoint returns the standard client envelope:

```typescript
interface ResponseResult<T> {
  status: "success" | "error";
  message: string;
  data: T | null;
  error?: {
    type: string;
    message: string;
  } | null;
}
```

### Common HTTP Error Codes
| HTTP Status | Meaning | Typical Trigger |
| :--- | :--- | :--- |
| **`400 Bad Request`** | Validation failure | Age `< 18` or `> 80`, invalid username format, image `< 50KB` or corrupted, language outside whitelist |
| **`401 Unauthorized`** | Authentication required | Missing or expired JWT Access Token |
| **`403 Forbidden`** | Access denied | User is banned or account is suspended |
| **`404 Not Found`** | Resource missing | Requested entity does not exist |
| **`409 Conflict`** | Resource already exists | Username or email already registered |
| **`500 Server Error`** | Internal error | Unhandled server exception |

---

## 13. Interests & Activities (`/interests`, `Profile.interest`)

### 13.1 Client Category Model
Each category in `GET /interests` (and `GET /interest`) matches the Android client schema:
```json
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
    }
  ]
}
```

### 13.2 Updating User Interests (`LikedActivities`)
Clients can submit selected interests in `PUT /users/me` or `POST /users/profile` using:
- `LikedActivities`: key-value map by category ID like questions Answers: `{ "1": [1, 2], "9": 72 }` (or single `1`)
- Backward-compatible formats: array of IDs (`[1, 2, 72]`) or category objects (`[ { "id": 1, "Interest": [ { "id": 1 } ] } ]`)
- In `GET /users/me`, only `Profile.LikedActivities` is returned as `{ [categoryId]: interestId | interestId[] }` (duplicate `interest` and `interests` arrays are omitted).

