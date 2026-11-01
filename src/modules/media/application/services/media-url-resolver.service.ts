import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MediaUrlResolverService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Reads the configured public base URL from environment or configuration.
   * Priority: ASSET_BASE_URL -> MEDIA_BASE_URL -> APP_BASE_URL -> http://localhost:<PORT>
   */
  public getBaseUrl(): string {
    const raw =
      this.configService.get<string>('ASSET_BASE_URL') ||
      this.configService.get<string>('MEDIA_BASE_URL') ||
      this.configService.get<string>('APP_BASE_URL') ||
      `http://localhost:${this.configService.get<number>('PORT', 3000)}`;

    return raw.trim().replace(/\/+$/, '');
  }

  /**
   * Formats the public URL for an asset given its type and filename.
   * Format: <baseUrl>/assets/<assetType>/<filename>
   */
  public getPublicUrl(assetType: string, filename: string): string {
    const baseUrl = this.getBaseUrl();
    const cleanType = assetType.toLowerCase().trim().replace(/^\/+|\/+$/g, '');
    const cleanFilename = filename.trim().replace(/^\/+|\/+$/g, '');

    return `${baseUrl}/assets/${cleanType}/${cleanFilename}`;
  }

  /**
   * Converts any stored relative path, legacy path, or key into a full public URL.
   * This ensures the domain can be changed later without modifying stored data in the database.
   */
  public resolveUrl(storedPathOrKey: string | null | undefined): string {
    if (!storedPathOrKey || typeof storedPathOrKey !== 'string') {
      return '';
    }

    const trimmed = storedPathOrKey.trim();
    if (!trimmed) {
      return '';
    }

    // Already an absolute HTTP/HTTPS URL
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    const baseUrl = this.getBaseUrl();

    // Legacy /uploads/avatars/foo.webp or /uploads/selfies/foo.webp
    if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
      const cleanPath = trimmed.replace(/^\/?uploads\//, '');
      return `${baseUrl}/assets/${cleanPath}`;
    }

    // Modern /assets/<type>/<filename>
    if (trimmed.startsWith('/assets/') || trimmed.startsWith('assets/')) {
      const cleanPath = trimmed.replace(/^\/?assets\//, '');
      return `${baseUrl}/assets/${cleanPath}`;
    }

    // Pure relative key: <assetType>/<filename> or just filename
    const cleanKey = trimmed.replace(/^\/+/, '');
    if (cleanKey.includes('/')) {
      return `${baseUrl}/assets/${cleanKey}`;
    }

    // Fallback: default to images if no assetType directory prefix was provided
    return `${baseUrl}/assets/images/${cleanKey}`;
  }

  /**
   * Parses an asset URL or relative path into assetType and filename components.
   */
  public parseAssetPath(
    urlOrPath: string,
  ): { assetType: string; filename: string } | null {
    if (!urlOrPath) return null;

    let pathOnly = urlOrPath.replace(/^https?:\/\/[^/]+/i, '');
    pathOnly = pathOnly.replace(/^\/?(assets|uploads)\//i, '');

    const segments = pathOnly.split('/').filter(Boolean);
    if (segments.length >= 2) {
      return {
        assetType: segments[0].toLowerCase(),
        filename: segments.slice(1).join('/'),
      };
    }

    return null;
  }
}
