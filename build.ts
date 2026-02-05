import { rm } from 'node:fs/promises'
import { build } from 'bun'

// Clean dist folder
await rm('./dist', { recursive: true, force: true })

console.log('Building for Node.js...')
await build({
  entrypoints: ['./index.ts'],
  outdir: './dist/node',
  target: 'node',
  format: 'esm',
  minify: false,
  sourcemap: 'external',
  splitting: false,
  external: ['playwright', 'zod', 'dotenv'],
})

console.log('Building for Bun...')
await build({
  entrypoints: ['./index.ts'],
  outdir: './dist/bun',
  target: 'bun',
  format: 'esm',
  minify: false,
  sourcemap: 'external',
  splitting: false,
  external: ['playwright', 'zod', 'dotenv'],
})

// Generate TypeScript declarations
console.log('Generating types...')
await Bun.spawn(['bunx', 'tsc', '--project', 'tsconfig.build.json'], {
  stdout: 'inherit',
  stderr: 'inherit',
})

console.log('✓ Build complete')
