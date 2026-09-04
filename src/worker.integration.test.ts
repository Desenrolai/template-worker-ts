import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Queue, Worker } from 'bullmq';
import { helloProcessor } from './hello.processor';
import type { HelloJobData } from './hello.processor';
import { parseRedisUrl } from './redis';

// Teste de INTEGRAÇÃO: exige um Redis real. Roda em `npm run test:integration`,
// não em `npm test`.
//
// Existe por causa de uma regressão concreta: a partir do BullMQ 6 o `ioredis`
// deixou de vir embutido e virou peer opcional. Sem ele declarado, typecheck,
// lint, testes unitários e build ficam TODOS verdes e o worker morre na primeira
// conexão com "BullMQ could not load the optional 'ioredis' package".
// Nenhum gate estático pega isso — só um job real contra um Redis real.

const REDIS_URL = process.env['REDIS_URL'];

// Falha alto em vez de pular em silêncio: um gate que se auto-desliga quando a
// variável some não é gate.
if (!REDIS_URL) {
  throw new Error(
    'REDIS_URL é obrigatória para o teste de integração. ' +
      'Ex.: REDIS_URL=redis://localhost:6379 npm run test:integration',
  );
}

const QUEUE_NAME = `hello-integration-${process.pid}`;
const JOB_TIMEOUT_MS = 15_000;

describe('worker contra Redis real', () => {
  let queue: Queue<HelloJobData>;
  let worker: Worker<HelloJobData>;

  beforeAll(() => {
    const connection = parseRedisUrl(REDIS_URL);
    queue = new Queue<HelloJobData>(QUEUE_NAME, { connection });
    worker = new Worker<HelloJobData>(QUEUE_NAME, helloProcessor, { connection });
  });

  afterAll(async () => {
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
  });

  it('conecta no Redis e processa um job enfileirado de fora', async () => {
    const completed = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => { reject(new Error(`nenhum job completou em ${JOB_TIMEOUT_MS}ms`)); },
        JOB_TIMEOUT_MS,
      );
      worker.once('completed', (job) => {
        clearTimeout(timer);
        resolve(job.id ?? 'sem-id');
      });
      worker.once('failed', (_job, err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    const job = await queue.add('hello', { message: 'job de integração' });

    await expect(completed).resolves.toBe(job.id);
  });

  it('parseRedisUrl produz opções que o BullMQ aceita de fato', async () => {
    // A prova é a conexão abrir e responder — o unit test de parseRedisUrl só
    // confere o shape do objeto, nunca que o BullMQ o aceita.
    const counts = await queue.getJobCounts();

    expect(counts).toHaveProperty('waiting');
    expect(typeof counts['waiting']).toBe('number');
  });
});
