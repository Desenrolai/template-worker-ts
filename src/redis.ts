import type { ConnectionOptions } from 'bullmq';

/**
 * Parses a Redis URL into BullMQ ConnectionOptions.
 *
 * A partir do BullMQ 6 o `ioredis` deixou de vir embutido: e um peer opcional
 * (`ioredis >= 5.0.0`) e precisa estar declarado como dependencia direta, senao
 * o worker compila e testa verde mas morre ao abrir a conexao.
 *
 * Expected format: redis[s]://[user:password@]host[:port][/db]
 */
export function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);

  const options: ConnectionOptions = {
    host: parsed.hostname || 'localhost',
    port: parsed.port ? parseInt(parsed.port, 10) : 6379,
  };

  if (parsed.password) {
    (options as Record<string, unknown>)['password'] = decodeURIComponent(parsed.password);
  }
  if (parsed.pathname && parsed.pathname !== '/') {
    const db = parseInt(parsed.pathname.slice(1), 10);
    if (!isNaN(db)) {
      (options as Record<string, unknown>)['db'] = db;
    }
  }
  if (parsed.protocol === 'rediss:') {
    (options as Record<string, unknown>)['tls'] = {};
  }

  return options;
}
