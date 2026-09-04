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
| `npm test` | Vitest — unitários, sem Redis |
| `npm run test:integration` | Vitest — **exige Redis real** (`REDIS_URL`) |
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

## Teste de integração (exige Redis real)

```bash
docker run -d -p 6379:6379 redis:7-alpine
REDIS_URL=redis://localhost:6379 npm run test:integration
```

Ele existe por uma razão específica, não por completude. A partir do **BullMQ 6**
o `ioredis` deixou de vir embutido e virou peer **opcional**. Sem ele declarado
como dependência direta, o cenário é:

| Gate | Com o `ioredis` faltando |
| --- | --- |
| `npm run lint` | verde |
| `npm run typecheck` | verde |
| `npm test` (10 unitários) | verde |
| `npm run build` | verde |
| `node dist/index.js` | **morre**: `BullMQ could not load the optional 'ioredis' package` |

Medido, não suposto: removendo o `ioredis` do `node_modules` os quatro gates
acima continuam verdes e só `test:integration` reproduz o erro de produção.

A suíte unitária testa o *processor* isolado e **nunca abre conexão** — é por
isso que ela não pode ser o gate disso. O job `integration` do CI sobe um
`redis:7-alpine` como service container e os jobs de imagem dependem dele
(`needs: [ci, integration]`) — inclusive o build de PR.

Sem `REDIS_URL` o teste **falha alto** em vez de pular: um gate que se
auto-desliga quando a variável some não é gate.

## CI: runner do repo gerado

O workflow roda em runner **hospedado** por padrão. Este template é público — em
repo público o Actions hospedado é gratuito, e apontar self-hosted aqui deixaria
um PR de fork executar código de terceiro dentro do cluster.

⚠️ **O repo gerado é privado, e nele esse default não vale.** Com a cota
hospedada bloqueada por billing, o job **falha em ~2 s sem executar nenhum
step** — e sem mensagem no log que oriente.

Zero steps, sozinho, não identifica nada: um job `skipped` pelo `if:` também
reporta zero. **O separador é a conclusão**: `failure` em ~2 s é billing;
`skipped` é o `if:`. Parece YAML quebrado, não é — a causa costuma vir na
*annotation* do job, não no log. Não perca tempo procurando erro no workflow.

Antes do primeiro push, defina duas **variáveis de repositório** (Settings →
Secrets and variables → Actions → Variables) com **array JSON** de labels:

| Variável           | Valor                              | Usada por                    |
| ------------------ | ---------------------------------- | ---------------------------- |
| `CI_RUNNER`        | `["self-hosted","desenrolai"]`     | job `ci`                     |
| `CI_RUNNER_DOCKER` | `["self-hosted","docker-builder"]` | jobs que constroem a imagem  |

```bash
gh variable set CI_RUNNER --body '["self-hosted","desenrolai"]'
gh variable set CI_RUNNER_DOCKER --body '["self-hosted","docker-builder"]'
```

São dois pools diferentes de propósito: o pool `desenrolai` **não tem Docker**
(`dockerEnabled: false`), só o `docker-builder` tem. Build de imagem no pool
errado falha por falta de daemon.

JSON é obrigatório: `runs-on` com a string `self-hosted,desenrolai` vira **um**
label contendo vírgula — não dois — e o job fica em `queued` para sempre. Sem as
variáveis definidas, o default hospedado continua valendo.

O job `integration` também usa `CI_RUNNER_DOCKER`, e não `CI_RUNNER`: o
`services:` do Redis é um container e exige daemon Docker **no runner**. Apontá-lo
para o pool geral faria o gate do `ioredis` cair — que é o pior desfecho
possível, já que ele é o único gate que pega a regressão descrita acima.

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
