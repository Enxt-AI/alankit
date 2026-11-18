/**
 * File upload utilities for stock documents
 * Handles validation, preview generation, and upload processing
 */

/**
 * Validate a file for upload
 * @param file - File to validate
 * @param maxSizeMB - Maximum file size in MB (default: 5)
 * @param allowedTypes - Array of allowed MIME types
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateFile(
  file: File,
  maxSizeMB: number = 5,
  allowedTypes: string[] = ['application/pdf', 'image/jpeg', 'image/png']
): { isValid: boolean; error?: string } {
  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      isValid: false,
      error: `File size must be less than ${maxSizeMB}MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  return { isValid: true };
}

/**
 * Generate a preview URL for image files
 * @param file - Image file to preview
 * @returns Promise resolving to data URL string
 */
export function generatePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Get file extension from filename
 * @param filename - Filename to extract extension from
 * @returns File extension (lowercase)
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Get MIME type from file extension
 * @param extension - File extension
 * @returns MIME type or null if unknown
 */
export function getMimeTypeFromExtension(extension: string): string | null {
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
  };

  return mimeTypes[extension] || null;
}