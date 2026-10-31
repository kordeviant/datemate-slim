import * as path from 'path';

export interface UploadCategoryConfig {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
}

export interface UploadConfig {
  avatar: UploadCategoryConfig;
  galleryPhoto: UploadCategoryConfig;
  video: UploadCategoryConfig;
  chatAttachment: {
    imageMaxSizeBytes: number;
    audioMaxSizeBytes: number;
    videoMaxSizeBytes: number;
    documentMaxSizeBytes: number;
    defaultMaxSizeBytes: number;
    dangerousExtensions: string[];
  };
  storage: {
    uploadDir: string;
    chatUploadDir: string;
  };
}

export const uploadConfig = (): { upload: UploadConfig } => ({
  upload: {
    avatar: {
      maxSizeBytes: parseInt(process.env.UPLOAD_AVATAR_MAX_SIZE_BYTES || String(5 * 1024 * 1024), 10), // 5 MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    },
    galleryPhoto: {
      maxSizeBytes: parseInt(process.env.UPLOAD_GALLERY_MAX_SIZE_BYTES || String(10 * 1024 * 1024), 10), // 10 MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    },
    video: {
      maxSizeBytes: parseInt(process.env.UPLOAD_VIDEO_MAX_SIZE_BYTES || String(50 * 1024 * 1024), 10), // 50 MB
      allowedMimeTypes: ['video/mp4', 'video/quicktime'],
      allowedExtensions: ['.mp4', '.mov'],
    },
    chatAttachment: {
      imageMaxSizeBytes: parseInt(process.env.CHAT_IMAGE_MAX_SIZE_BYTES || String(15 * 1024 * 1024), 10), // 15 MB
      audioMaxSizeBytes: parseInt(process.env.CHAT_AUDIO_MAX_SIZE_BYTES || String(25 * 1024 * 1024), 10), // 25 MB
      videoMaxSizeBytes: parseInt(process.env.CHAT_VIDEO_MAX_SIZE_BYTES || String(100 * 1024 * 1024), 10), // 100 MB
      documentMaxSizeBytes: parseInt(process.env.CHAT_DOCUMENT_MAX_SIZE_BYTES || String(50 * 1024 * 1024), 10), // 50 MB
      defaultMaxSizeBytes: parseInt(process.env.CHAT_UPLOAD_MAX_SIZE_BYTES || String(50 * 1024 * 1024), 10), // 50 MB
      dangerousExtensions: [
        '.exe', '.bat', '.cmd', '.sh', '.php', '.phtml', '.pl', '.cgi',
        '.js', '.mjs', '.vbs', '.msi', '.dll', '.so', '.bin', '.com',
        '.scr', '.vbe', '.wsf', '.wsh', '.apk', '.jar',
      ],
    },
    storage: {
      uploadDir: process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
      chatUploadDir: process.env.CHAT_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'chat'),
    },
  },
});
