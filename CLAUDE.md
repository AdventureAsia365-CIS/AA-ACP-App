# AA-ACP-App — Claude Code Context
# Updated: 20/05/2026 | Session 18

## PURPOSE
Next.js 14 frontend for ACP portal — B2B tenant management + content review

## STACK
- Next.js 14, React 19, TypeScript
- Deploy: Vercel (Hobby — manual deploy)
- Live: https://aa-cis.lumiguides.it.com

## STRUCTURE
src/app/
├── layout.tsx    → root layout
├── page.tsx      → home/dashboard
├── (admin)/workspace/
│   ├── layout.tsx          → admin workspace layout
│   └── s0/review/page.tsx  → S0 tour review page [AA-44]
├── (tenant)/portal/
│   ├── layout.tsx          → portal layout
│   └── competitors/page.tsx → competitor URL management [AA-88]
├── fonts/
├── globals.css
└── favicon.ico

## DEPLOY
vercel --prod
# Pull env vars (add flag — required):
vercel env pull --environment=production

## ENV VARS — CRITICAL
Underscore env vars corrupt in Claude markdown rendering.
NEVER auto-generate .env files.
ALWAYS tell Nghiep to edit manually in VSCode.
Flag: "⚠️ Contains underscore env vars — edit manually in VSCode"

## API CONNECTION
Backend: https://api-cis.lumiguides.it.com (API GW owq9as3wjl)
Auth: X-API-Key header (per tenant, from admin panel)

## CONFIG NOTES
- tsconfig.json: `"target": "es2015"` added (fixes TS2802 Set iteration)

## SESSION 18 STATE (20/05/2026)
- Branch: main (merged from develop)
- CI: #4 green, Vercel deploy triggered
- Pages shipped: /workspace/s0/review, /portal/competitors, portal layout
- Fixes: ESLint no-unused-expressions (S0 review line 169), TS2802 Set spread

## ACTIVE WORK
ACP M2 sprint — UI tasks:
- AA-44: S0 review page ✅ (merged)
- AA-88: Competitor URL management page ✅ (merged)
- AA-85: Fix "Failed to load tenant details" for 4 new tenants
- AA-89: B2B self-approval dashboard (defer M3)
- AA-90: S1 Trigger page (/workspace/s1/run) ← NEXT
