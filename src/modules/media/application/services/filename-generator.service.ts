import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';

@Injectable()
export class FilenameGeneratorService {
  /**
   * Generates a collision-proof, URL-safe, sanitized filename.
   * Pattern: <prefix>_<uuidHex>_<timestamp>.<safeExt>
   */
  public generateUniqueFilename(
    assetType: string,
    originalName?: string,
    mimeType?: string,
  ): string {
    const cleanPrefix = this.sanitizePrefix(assetType);
    const uniqueId = crypto.randomUUID().replace(/-/g, '');
    const timestamp = Date.now();
    const safeExt = this.getSafeExtension(mimeType, originalName);

    return `${cleanPrefix}_${uniqueId}_${timestamp}${safeExt}`;
  }

  /**
   * Sanitizes a string prefix to only contain alphanumeric characters.
   */
  public sanitizePrefix(prefix: string): string {
    const sanitized = prefix.toLowerCase().replace(/[^a-z0-9]/g, '');
    return sanitized || 'asset';
  }

  /**
   * Sanitizes any filename, removing directory traversal sequences and unsafe characters.
   */
  public sanitizeFilename(filename: string): string {
    if (!filename) return '';

    // Normalize Windows and Unix path separators
    const normalized = filename.replace(/\\/g, '/');
    // Strip directory traversal and path separators
    const base = path.posix.basename(normalized);
    // Remove dangerous characters, allow only alphanumeric, dash, underscore, dot
    return base.replace(/[^a-zA-Z0-9_.-]/g, '_');
  }

  /**
   * Determines if a filename is strictly URL-safe and free from directory traversal.
   */
  public isSafeFilename(filename: string): boolean {
    if (!filename || typeof filename !== 'string') return false;

    let decoded = filename;
    try {
      decoded = decodeURIComponent(filename);
    } catch {
      return false;
    }

    // Reject null bytes, traversal sequences, or slashes
    if (
      decoded.includes('..') ||
      decoded.includes('/') ||
      decoded.includes('\\') ||
      decoded.includes('\0')
    ) {
      return false;
    }

    // Must match safe naming pattern: alphanumeric with underscores, dashes, spaces, parentheses, and single valid extension
    const safePattern = /^[a-zA-Z0-9 _().-]+(\.[a-zA-Z0-9]{1,10})?$/;
    return safePattern.test(decoded) && decoded.length <= 150;
  }


  /**
   * Resolves a safe file extension from MIME type or original file extension.
   */
  public getSafeExtension(mimeType?: string, originalName?: string): string {
    if (mimeType) {
      switch (mimeType.toLowerCase()) {
        case 'image/svg+xml':
          return '.svg';
        case 'image/png':
          return '.png';
        case 'image/jpeg':
          return '.jpg';
        case 'image/webp':
          return '.webp';
        case 'image/gif':
          return '.gif';
        case 'application/pdf':
          return '.pdf';
        case 'audio/mpeg':
          return '.mp3';
        case 'audio/ogg':
          return '.ogg';
        case 'audio/wav':
          return '.wav';
        case 'audio/webm':
          return '.webm';
        case 'audio/aac':
          return '.aac';
      }
    }

    if (originalName) {
      const ext = path.extname(originalName).toLowerCase();
      if (/^\.[a-z0-9]{2,5}$/.test(ext)) {
        return ext === '.jpeg' ? '.jpg' : ext;
      }
    }

    return '.bin';
  }
}
