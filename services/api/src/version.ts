import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Versão da API lida do package.json (funciona tanto em src/ quanto em dist/). */
export const version: string = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
).version;
