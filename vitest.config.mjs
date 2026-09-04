import { defineConfig } from 'vitest/config';
import { maxWorkers } from './scripts/cpu-limit.mjs';

// Deriva do cgroup: os.cpus() reporta o host e superdimensiona os workers.
// Vitest 4 removeu poolOptions — maxWorkers/minWorkers sao top-level.
const workers = maxWorkers();

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', 'dist/**', 'coverage/**'],
    pool: 'threads',
    maxWorkers: workers,
    minWorkers: 1,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
    },
  },
});
