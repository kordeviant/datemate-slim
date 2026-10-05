  import { Injectable } from '@nestjs/common';
import { AssetType } from './asset-type.enum';
import { AssetTypeRule } from './asset-type-config.interface';

@Injectable()
export class AssetTypeRegistry {
  private readonly rules = new Map<string, AssetTypeRule>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    // Icons: SVGs, PNGs, WebP icons (e.g. badges, category icons, small UI elements)
    this.register({
      assetType: AssetType.ICONS,
      allowedMimeTypes: ['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg'],
      allowedExtensions: ['.svg', '.png', '.webp', '.jpg', '.jpeg'],
      maxSizeBytes: 5 * 1024 * 1024, // 5 MB
      magicBytesValidation: true,
      description: 'Vector and raster UI icons and badge assets',
    });

    // Images: standard photographic / gallery / content images
    this.register({
      assetType: AssetType.IMAGES,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
      maxSizeBytes: 15 * 1024 * 1024, // 15 MB
      magicBytesValidation: true,
      description: 'Standard images, event banners, and gallery media',
    });

    // Avatars: user profile and verification photos
    this.register({
      assetType: AssetType.AVATARS,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
      minSizeBytes: 10 * 1024, // 10 KB
      maxSizeBytes: 10 * 1024 * 1024, // 10 MB
      magicBytesValidation: true,
      description: 'User profile photos and avatars',
    });

    // Selfies: user identity verification photos
    this.register({
      assetType: AssetType.SELFIES,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
      minSizeBytes: 10 * 1024, // 10 KB
      maxSizeBytes: 15 * 1024 * 1024, // 15 MB
      magicBytesValidation: true,
      description: 'User identity verification selfie photos',
    });

    // Banners: promotional and community event banners
    this.register({
      assetType: AssetType.BANNERS,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
      maxSizeBytes: 10 * 1024 * 1024, // 10 MB
      magicBytesValidation: true,
      description: 'Wide aspect-ratio headers and banners',
    });

    // Audio: voice notes and audio clips
    this.register({
      assetType: AssetType.AUDIO,
      allowedMimeTypes: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac'],
      allowedExtensions: ['.mp3', '.ogg', '.wav', '.webm', '.aac', '.m4a'],
      maxSizeBytes: 20 * 1024 * 1024, // 20 MB
      magicBytesValidation: false,
      description: 'Voice messages and audio recordings',
    });

    // Documents: verification documents, PDFs
    this.register({
      assetType: AssetType.DOCUMENTS,
      allowedMimeTypes: ['application/pdf'],
      allowedExtensions: ['.pdf'],
      maxSizeBytes: 20 * 1024 * 1024, // 20 MB
      magicBytesValidation: true,
      description: 'User verification or compliance documents',
    });
  }

  public register(rule: AssetTypeRule): void {
    const key = rule.assetType.toLowerCase().trim();
    this.rules.set(key, {
      ...rule,
      assetType: key,
    });
  }

  public isSupported(assetType: string): boolean {
    if (!assetType) return false;
    return this.rules.has(assetType.toLowerCase().trim());
  }

  public getConfig(assetType: string): AssetTypeRule | undefined {
    if (!assetType) return undefined;
    return this.rules.get(assetType.toLowerCase().trim());
  }

  public getAllSupportedTypes(): string[] {
    return Array.from(this.rules.keys());
  }
}
