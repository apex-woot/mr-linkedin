import { build } from 'bun'

await build({
  entrypoints: ['./index.ts'],
  outdir: './dist',
  target: 'node',
  format: 'esm',
  minify: false,
  sourcemap: 'external',
  splitting: false,
  external: ['playwright', 'zod', 'dotenv'],
})

// Generate TypeScript declarations
await Bun.spawn(['bunx', 'tsc', '--project', 'tsconfig.build.json'], {
  stdout: 'inherit',
  stderr: 'inherit',
})

console.log('✓ Build complete')
