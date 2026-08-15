import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Integration tests share one local Postgres/Redis — avoid cross-file
    // interference from concurrent table cleanup.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/db/schema.ts',   // table definitions, no branching logic
        'src/db/migrate.ts',  // one-off CLI script
        'src/index.ts',       // process entrypoint (app.listen)
      ],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 85,
      },
    },
  },
})
