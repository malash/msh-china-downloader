// Turns an arbitrary string into a filesystem-safe path segment: trims the
// ends, then replaces path separators, reserved characters, and any internal
// whitespace with `_`. Whitespace-only input collapses to '' (so callers can
// fall back to a placeholder name).
export const sanitize = (s: string): string => s.trim().replace(/[/\\:*?"<>|\s]/g, '_');
