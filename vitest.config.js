import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globals: false,
    // The whole suite hits a single shared Postgres database. Run every test
    // file in the same fork, serially, so the per-test TRUNCATE in setup.js
    // can't race with another worker's writes.
    pool: 'forks',
    singleFork: true,
    fileParallelism: false,
    setupFiles: ['./tests/setup.js'],
    globalSetup: ['./tests/globalSetup.js'],
    testTimeout: 20000,
  },
})
