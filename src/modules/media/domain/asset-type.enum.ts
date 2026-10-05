export enum AssetType {
  ICONS = 'icons',
  IMAGES = 'images',
  AVATARS = 'avatars',
  SELFIES = 'selfies',
  BANNERS = 'banners',
  AUDIO = 'audio',
  DOCUMENTS = 'documents',
}

export function isValidAssetType(type: string): boolean {
  return Object.values(AssetType).includes(type as AssetType);
}

export function normalizeAssetType(type: string): string {
  return type.toLowerCase().trim();
}
