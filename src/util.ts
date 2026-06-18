// Sanitizes a string into a filesystem-safe path segment. '' if all whitespace.
export const sanitize = (s: string): string => s.trim().replace(/[/\\:*?"<>|\s]/g, '_');

// Joins segments into a `/`-separated, percent-encoded relative URL.
export const toRelativeUrl = (segments: string[]): string =>
  segments.map(encodeURIComponent).join('/');
