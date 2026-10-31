export const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

// File extension -> the content type we'll store it with
export const ALLOWED_TYPES: Record<string, string> = {
  wav: "audio/wav",
  aif: "audio/aiff",
  aiff: "audio/aiff",
  flac: "audio/flac",
};