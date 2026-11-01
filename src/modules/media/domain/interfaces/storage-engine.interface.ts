import {
  StorageFileStream,
  StoredFileInput,
  StoredFileResult,
} from './stored-file.interface';

export const STORAGE_ENGINE = 'STORAGE_ENGINE';

export interface IStorageEngine {
  /**
   * Persists a file into the storage backend organized by asset type.
   */
  save(file: StoredFileInput): Promise<StoredFileResult>;

  /**
   * Retrieves a file as a stream or buffer along with metadata (size, mimeType, etag).
   */
  get(assetType: string, filename: string): Promise<StorageFileStream>;

  /**
   * Checks if an asset exists in storage.
   */
  exists(assetType: string, filename: string): Promise<boolean>;

  /**
   * Deletes an asset from storage.
   */
  delete(assetType: string, filename: string): Promise<boolean>;

  /**
   * Returns the driver type (e.g. 'local', 's3', 'gcs', 'cdn').
   */
  getStorageType(): string;
}
