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

## Ao gerar um repo a partir deste template (rename obrigatório)

O Forge scaffolda com `octokit.repos.createUsingTemplate` — **cópia literal, sem
substituição de placeholder**. Todo nome deste template chega intacto no repo
gerado.

Lista **completa**:

| Onde | Valor atual | O que quebra se ficar |
| --- | --- | --- |
| `package.json` → `name` | `@desenrolai/worker-template` | colide com todo outro repo gerado deste template |
| `package-lock.json` → `name` (2 ocorrências) | idem | regenerado sozinho: rode `npm install` **depois** de trocar o `package.json` |
| `package.json` → `description` | `Template: BullMQ worker (TypeScript)` | nada — cosmético, e **não casa com o grep abaixo** |
| `README.md` → título | `desenrolai-worker-ts-template` | nada — cosmético |
| `.github/workflows/ci.yml` → `IMAGE_NAME` | `desenrolai/${{ ... }}` | **NÃO troque**: `desenrolai` aqui é a org do GHCR, não o nome do template. O repo já entra por `github.event.repository.name` |

Nenhum ponto deste template é lido em runtime — nada quebra funcionalmente se o
rename ficar pela metade. O risco real é o `package.json` sem rename: todos os
workers gerados passam a se chamar `@desenrolai/worker-template`.

Confira, do próprio repo:

```bash
git grep -nI -e 'worker-template' -e 'worker-ts-template' -- . ':!README.md'
```

Saída vazia = os pontos que casam o nome foram todos trocados. **Ele não pega a
`description` do `package.json`** (não contém o nome) — confira essa à mão.

`private: true` fica. Sem ele, um `npm publish` acidental empurraria um pacote
escopado com o nome do template. Remova só quando o repo gerado for de fato
publicável, e com o nome já trocado.

Ao trocar a fila e o processor de exemplo, lembre do valor default de
`QUEUE_NAME` (`hello`) em `src/index.ts` e do nome do arquivo
`src/hello.processor.ts` — são exemplo, não nome de template, e não aparecem no
grep acima.

O `-- . ':!README.md'` exclui esta própria seção, que cita os valores antigos
de propósito. **Apague esta seção** depois de concluir o rename — ela é
instrução de scaffold, não documentação do repo gerado.
