// Storage utilities for file validation and path security
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024; // 50 MiB general limit
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MiB avatar limit

// Allowed MIME types (default decisions from the user)
export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/**
 * Returns true if the supplied MIME type is in the whitelist or if it is undefined/null.
 */
export function isValidMimeType(mime?: string | null): boolean {
  return !mime || ALLOWED_MIME_TYPES.includes(mime);
}

/**
 * Sanitizes a filename to remove path separators and dangerous characters.
 * Truncates to 255 bytes to stay within typical DB limits.
 */
export function sanitizeFileName(name: string): string {
  // Replace characters that could be used for traversal or injection
  const sanitized = name.replace(/[\\/:*?"<>|]/g, "_");
  return sanitized.substring(0, 255);
}

/**
 * Storage object names are client‑supplied, so keep them within the uploader's
 * namespace and reject traversal or malformed paths before writing metadata.
 */
export function isScopedStoragePath(path: string, prefixes: string[]): boolean {
  // Must start with one of the allowed prefixes followed by a slash
  if (!prefixes.some((prefix) => path.startsWith(`${prefix}/`))) return false;
  // Disallow Windows backslashes and parent‑directory traversal
  if (path.includes("\\") || path.includes("..")) return false;
  const parts = path.split("/");
  // At least two parts (prefix + filename) and no empty segments
  return parts.length >= 2 && parts.every((part) => part.length > 0);
}

export function isUserStoragePath(path: string, userId: string): boolean {
  return isScopedStoragePath(path, [userId]);
}

/**
 * Validates file size against the appropriate limit.
 * Pass `isAvatar` to enforce the stricter avatar limit.
 */
export function isValidFileSize(size: number | null | undefined, isAvatar = false): boolean {
  const limit = isAvatar ? AVATAR_MAX_BYTES : MAX_ATTACHMENT_BYTES;
  return size == null || size <= limit;
}
