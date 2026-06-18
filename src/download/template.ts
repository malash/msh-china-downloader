import { fileURLToPath } from 'node:url';
import { Eta } from 'eta';

export const eta = new Eta({
  views: fileURLToPath(new URL('../templates/', import.meta.url)),
});
