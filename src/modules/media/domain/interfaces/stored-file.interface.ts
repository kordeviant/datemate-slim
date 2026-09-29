export interface StoredFileInput {
  assetType: string;
  filename: string;
  buffer: Buffer;
  mimeType: string;
  metadata?: Record<string, any>;
}

export interface StoredFileResult {
  assetType: string;
  filename: string;
  storageKey: string; // Storage key e.g. "icons/icon_123.svg"
  sizeBytes: number;
  mimeType: string;
  storagePath?: string; // Physical path if stored on local disk
}

export interface StorageFileStream {
  stream: NodeJS.ReadableStream | Buffer;
  sizeBytes: number;
  mimeType: string;
  lastModified?: Date;
  etag?: string;
}
