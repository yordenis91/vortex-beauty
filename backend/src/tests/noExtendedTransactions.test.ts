import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// `prisma.$transaction` del cliente extendido abre una transacción por
// operación y rompe la atomicidad; hay que usar runInTransaction (lib/db.ts).
function listTsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listTsFiles(path);
    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });
}

describe('convenciones de acceso a datos', () => {
  it('ningún código de producción usa prisma.$transaction directamente', () => {
    const offenders = listTsFiles(join(__dirname, '..')).filter((file) => {
      const code = readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
        .join('\n');
      return /(?<![A-Za-z])prisma\.\$transaction\b/.test(code);
    });
    expect(offenders).toEqual([]);
  });
});
