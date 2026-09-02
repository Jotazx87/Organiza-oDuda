# Organiza Compras

Aplicativo pessoal para registrar compras, acompanhar entregas, organizar cotações e guardar anexos.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/organiza-compras/src/App.tsx` — login, navegação, cadastro/edição de compras, anexos e exportações
- `artifacts/organiza-compras/src/index.css` — tema visual da aplicação
- `artifacts/api-server/src/routes/` — autenticação, compras, anexos, resumo e histórico de exportações
- `lib/api-spec/openapi.yaml` — contrato único da API
- `lib/db/src/schema/index.ts` — tabelas e enums do banco

## Architecture decisions

- Valores monetários usam `numeric(12, 2)` no PostgreSQL e são exibidos em reais no aplicativo.
- A forma de pagamento possui opções controladas e mantém `Não informada` como padrão para registros antigos.
- Anexos podem ser vinculados a uma compra ou armazenados como cotação avulsa; neste segundo caso, o nome da cotação é obrigatório.
- O campo interno `recipient` aparece para o usuário como `Solicitante`, preservando compatibilidade com registros já existentes.

## Product

O Organiza Compras centraliza pedidos pessoais, permitindo acompanhar o status de entrega, registrar solicitante, valor total e forma de pagamento, anexar comprovantes e cotações e exportar os dados.

## User preferences

As telas e mensagens ficam em português do Brasil.

## Gotchas

- Anexos têm limite de 8 MB e a API valida que todo anexo tenha uma compra ou um nome de cotação.
- Após alterar `lib/api-spec/openapi.yaml`, execute o codegen antes de validar servidor ou cliente.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
