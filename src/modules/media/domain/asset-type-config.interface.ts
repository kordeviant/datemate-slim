export interface AssetTypeRule {
  assetType: string;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  maxSizeBytes: number;
  minSizeBytes?: number;
  magicBytesValidation?: boolean;
  description: string;
}
