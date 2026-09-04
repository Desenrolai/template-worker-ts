import { defineConfig } from 'vitest/config';
import { maxWorkers } from './scripts/cpu-limit.mjs';

// Suíte de integração: exige Redis real. Sequencial de propósito — os testes
// compartilham fila e conexão.
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    pool: 'threads',
    maxWorkers: Math.min(1, maxWorkers()),
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
