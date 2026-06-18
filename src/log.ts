// Tiny console helpers for tidy, hierarchical output (no third-party logger).

export const step = (msg: string): void => console.log(`\n▸ ${msg}`);

export const info = (msg: string): void => console.log(`  ${msg}`);

export const item = (msg: string): void => console.log(`    · ${msg}`);

export const done = (msg: string): void => console.log(`  ✓ ${msg}`);

export const warn = (msg: string): void => console.warn(`  ⚠ ${msg}`);
