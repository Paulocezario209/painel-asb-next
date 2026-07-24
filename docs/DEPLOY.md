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
- `npm ci` → `npm run lint` (advisory) → **`npm test`** (gate; `node:test`+`tsx`, middleware + `/api/version`)
  → **`npm run build`** (gate; placeholders `NEXT_PUBLIC_*`, `GIT_SHA` do commit).

## Endpoint de versão — **padrão do control-plane**
`app/api/version/route.ts` → retorna **SOMENTE** `{ "sha": process.env.GIT_SHA ?? "unknown" }` (mesmo
schema/campo do `/version` do CP). **Público por exceção EXATA no middleware** (`proxy.ts`,
`isPublicVersionRoute` = `pathname === "/api/version"`, resolvida **antes** de qualquer init/consulta
Supabase — sem sessão, sem banco, sem cookie, sem usuário). **Só `GET` e `HEAD`** (demais métodos → `405`
automático do App Router). **`Cache-Control: no-store, max-age=0`** para o verify nunca receber SHA antigo por cache.
`Dockerfile`: `ARG GIT_SHA` + `ENV GIT_SHA` no stage runner (o painel **já usa build-args** `NEXT_PUBLIC_*`,
então o mecanismo é comprovado). Se o serviço não passar `GIT_SHA`, `/api/version` retorna `sha:"unknown"`.

> **Histórico (401):** antes desta exceção, o middleware `proxy.ts` barrava `/api/*` sem sessão com
> `401 JSON` — o `matcher` cobria `/api/version`. **Não** era Basic Auth nem infra EasyPanel; era a
> aplicação. Corrigido isentando **apenas** o path exato `/api/version`.

## Validação pública AUTOMÁTICA (`.github/workflows/verify-deploy.yml`, roda no push da main)
Prova de SHA **automática** pelo **domínio custom** `https://painel.americansteakbrasil.com/api/version`
(alcançável pelo GitHub Actions — **DEBT-334 RESOLVIDA**). Gate estrito, polling limitado + `timeout-minutes`:
- **Sucesso obrigatório:** TLS válido · `GET /api/version?deploy_sha=<github.sha>` → **200** · JSON válido ·
  **`sha` completo == `github.sha`**.
- **Rejeita** (workflow vermelho): `unknown` · SHA antigo/abreviado · redirect(login) · `401/403/404` · timeout ·
  `200` sem JSON válido. Falha → evidência sanitizada, **não** dispara novo deploy, aponta rollback (`git revert`).
- Saída sanitizada: só status + comparação de SHA; nunca headers/cookies/token.

> O domínio custom é **aditivo** (o `*.easypanel.host` segue no ar) e **agnóstico** para o app: a exceção
> pública de `/api/version` no `proxy.ts` vale para qualquer host que aponte ao serviço `sdr-american-painelnext`.

## Rollback
- **EasyPanel:** re-deploy da versão anterior (UI/API do serviço — login do Paulo).
- **Git:** `git revert <sha>` na `main` → auto-deploy da reversão → `verify` prova o SHA revertido.

## Pré-condições para LIGAR (ação do Paulo, uma vez)
1. PAT fine-grained com **repo `painel-asb-next` · Metadata read · Contents read · Webhooks read/write**.
2. EasyPanel cria o webhook de auto-deploy (integração GitHub) do serviço `sdr-american-painelnext`.
3. (Recomendado) build-arg `GIT_SHA` no serviço + branch-protection na `main` exigindo o check `Painel CI`.
