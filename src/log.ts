// Tidy, hierarchical console output. picocolors handles the ANSI escapes (and
// auto-disables them when output isn't a TTY).

import pc from 'picocolors';

export const step = (msg: string): void => console.log(`\n${pc.bold(pc.blue('▸'))} ${pc.bold(msg)}`);

export const info = (msg: string): void => console.log(`  ${msg}`);

export const item = (msg: string): void => console.log(`    ${pc.dim('·')} ${msg}`);

export const done = (msg: string): void => console.log(`  ${pc.green('✓')} ${msg}`);

export const warn = (msg: string): void => console.warn(`  ${pc.yellow('⚠')} ${msg}`);

export const error = (msg: string): void => console.error(`  ${pc.red('✗')} ${msg}`);
