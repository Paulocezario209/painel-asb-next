# Deploy — Painel ASB (fluxo gated, padrão control-plane)

> Frente `deploy-automatico-multirepo`. Publica o painel em
> **`https://sdr-american-painelnext.cp0vsf.easypanel.host/`** (Next.js standalone, `Dockerfile`).

## Modelo (idêntico ao control-plane)
```
feature branch → CI verde (PR) → merge na main → webhook GitHub do EasyPanel → build → publica → verify
```
`main` **dispara produção** via a integração GitHub do EasyPanel. Por isso:
- **PROIBIDO** empurrar direto na `main`; integração só por **PR com CI verde**.
- O `master-sync` (FF automático do hook Stop) foi **DESATIVADO** neste repo (empurraria na `main` = deploy sem gate).

## Gates de CI (`.github/workflows/ci.yml`, roda no PR)
- `npm ci` → `npm run lint` (advisory) → **`npm run build`** (gate; placeholders `NEXT_PUBLIC_*`, `GIT_SHA` do commit).

## Endpoint de versão — **padrão do control-plane**
`app/api/version/route.ts` → `{ "sha": process.env.GIT_SHA ?? "unknown" }` (mesmo schema/campo do `/version` do CP).
`Dockerfile`: `ARG GIT_SHA` + `ENV GIT_SHA` no stage runner (o painel **já usa build-args** `NEXT_PUBLIC_*`,
então o mecanismo é comprovado). Se o serviço não passar `GIT_SHA`, `/api/version` retorna `sha:"unknown"`
e o `verify` **não falha por isso** — apenas avisa.

## Validação pública (`.github/workflows/verify-deploy.yml`, roda no push da main)
- **Sucesso obrigatório:** `GET /api/version` → **200** (aplicação no ar; endpoint público, sem auth).
- **SHA best-effort:** compara `.sha` ao commit; `unknown`/mismatch → `::warning::`, nunca inventa sucesso.

## Rollback
- **EasyPanel:** re-deploy da versão anterior (UI/API do serviço — login do Paulo).
- **Git:** `git revert <sha>` na `main` → auto-deploy da reversão → `verify` prova o SHA revertido.

## Pré-condições para LIGAR (ação do Paulo, uma vez)
1. PAT fine-grained com **repo `painel-asb-next` · Metadata read · Contents read · Webhooks read/write**.
2. EasyPanel cria o webhook de auto-deploy (integração GitHub) do serviço `sdr-american-painelnext`.
3. (Recomendado) build-arg `GIT_SHA` no serviço + branch-protection na `main` exigindo o check `Painel CI`.
