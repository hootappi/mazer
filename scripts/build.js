import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist/src', { recursive: true });
await cp('public', 'dist', { recursive: true });
await cp('src', 'dist/src', { recursive: true });
await writeFile('dist/build.json', JSON.stringify({ version: '1.0.0' }));
console.log('Built Mazer 1.0.0 into dist/');
