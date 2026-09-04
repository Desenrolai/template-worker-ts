# desenrolai-worker-ts-template

Template for BullMQ workers (TypeScript).

## Stack

- **Node 24 LTS** + **TypeScript 6** (CommonJS)
- `bullmq` 6 — queue processing
- `vitest` 4 — tests

## Structure

```
src/
  index.ts              # entrypoint — creates Worker, registers processors
  hello.processor.ts    # example job processor (replace with your logic)
  redis.ts              # Redis connection factory
  hello.processor.test.ts
scripts/
  cpu-limit.mjs         # limite de CPU do cgroup → maxWorkers do Vitest
  cpu-limit.test.mjs
```

## Getting started

```bash
npm ci
REDIS_URL=redis://localhost:6379 npm run dev   # run via tsx
npm run build
REDIS_URL=redis://localhost:6379 npm start
npm test
```

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run build` | `tsc -p tsconfig.build.json` (sem testes em `dist/`) |
| `npm run dev` | tsx |
| `npm start` | roda o build |
| `npm run lint` | ESLint (flat config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run test:cov` | Vitest + coverage |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `QUEUE_NAME` | `hello` | BullMQ queue to consume |
| `WORKER_CONCURRENCY` | `5` | Max concurrent jobs |

## Deploy

Deployed as a Kubernetes **Deployment** with no Service or Ingress.
No HTTP port is exposed, portanto a imagem não tem `EXPOSE` nem `HEALTHCHECK` —
o `forge.yaml` declara `port` e `healthPath` como `null` e a saúde é observada
pela profundidade da fila (KEDA). A imagem roda como usuário não-root (`node`).

## Pool de teste e cgroup

`scripts/cpu-limit.mjs` lê o limite de CPU do cgroup (v2 `cpu.max`, v1
`cpu.cfs_quota_us`) e alimenta o `maxWorkers` do Vitest em `vitest.config.mjs`.
Dentro de um container, `os.cpus()` reporta as CPUs do **host**: sem esse ajuste
o Vitest sobe workers demais e o job morre com todos os testes passando. Fora de
container (macOS local) o helper cai para `os.cpus().length`.
