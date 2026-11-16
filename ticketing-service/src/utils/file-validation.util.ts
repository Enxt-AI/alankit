import * as fs from 'fs';
import { BadRequestException } from '@nestjs/common';

/**
 * Validates the magic bytes of a file to ensure its actual content matches its extension/mimetype.
 * @param filepath The path to the file to check
 * @param expectedMime The mimetype the client claims the file is
 * @returns true if valid, throws BadRequestException if invalid
 */
export async function validateMagicBytes(filepath: string, expectedMime: string): Promise<boolean> {
  // Read first 8 bytes
  const buffer = Buffer.alloc(8);
  const fileDescriptor = fs.openSync(filepath, 'r');
  
  try {
    fs.readSync(fileDescriptor, buffer, 0, 8, 0);
  } finally {
    fs.closeSync(fileDescriptor);
  }

  const hex = buffer.toString('hex').toUpperCase();

  // Mapping of common mime types to their magic byte signatures (hex)
  const magicSignatures: Record<string, string[]> = {
    'image/jpeg': ['FFD8FF'],
    'image/png': ['89504E470D0A1A0A'],
    'image/gif': ['474946383761', '474946383961'], // GIF87a, GIF89a
    'application/pdf': ['255044462D'], // %PDF-
    'image/webp': ['52494646'], // RIFF
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['504B0304', '504B0506', '504B0708'],
  };

  // We only strictly validate these known formats
  if (magicSignatures[expectedMime]) {
    const validSignatures = magicSignatures[expectedMime];
    const isValid = validSignatures.some(sig => hex.startsWith(sig));
    
    if (!isValid) {
      fs.unlinkSync(filepath);
      throw new BadRequestException(`File content does not match expected type ${expectedMime}`);
    }
    
    // Special check for WebP
    if (expectedMime === 'image/webp') {
      const webpBuffer = Buffer.alloc(12);
      const fdWebp = fs.openSync(filepath, 'r');
      try {
        fs.readSync(fdWebp, webpBuffer, 0, 12, 0);
      } finally {
        fs.closeSync(fdWebp);
      }
      if (webpBuffer.toString('ascii', 8, 12) !== 'WEBP') {
        fs.unlinkSync(filepath);
        throw new BadRequestException(`File content does not match expected type ${expectedMime}`);
      }
    }
  }

  return true;
}

/**
 * Returns a safe extension for the given mime type.
 */
export function getSafeExtension(mimetype: string): string {
  const extensionMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'text/plain': '.txt',
  };
  return extensionMap[mimetype] || '.bin';
}
