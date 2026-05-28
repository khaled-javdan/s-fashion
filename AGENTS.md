<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project spec

**Before doing anything, read [`SPEC.md`](./SPEC.md) at the repo root.** It is the single source of truth for the v1 build:

- Stack, conventions (money in fils, RTL with logical Tailwind properties, locale-prefixed routes)
- Final Prisma data model
- The 4 parallel tracks (A: design/i18n/layout, B: database, C: integrations, D: auth)
- File ownership map — each track has a "files OWNED" and "files MUST NOT touch" list
- Env vars (full list in [`.env.example`](./.env.example))

If you were assigned a specific track, find your section in `SPEC.md` and stay strictly within your owned files. Coordinate with the parent session before installing any new dependency — all packages were installed pre-flight.
