# AA-ACP-App — Claude Code Context
# Updated: 21/05/2026 | Session 22

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
│   ├── layout.tsx          → admin workspace layout (WorkspaceLayout — includes "S3 Campaign" nav link)
│   ├── s0/review/page.tsx  → S0 tour review page [AA-44]
│   └── s3/review/page.tsx  → Gate 2 HITL review UI [AA-45]
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
- useSearchParams() MUST be wrapped in <Suspense> for Next.js static export (CI #19 fail lesson)
- react-markdown NOT installed — use <pre className="whitespace-pre-wrap"> for markdown display

## SESSION 22 STATE (21/05/2026)
- Branch: develop | Commit: 2a37231
- CI: #20 green
- Pages shipped: /workspace/s3/review (Gate 2 HITL — calendar + ads accordion + funnel bar + approve/reject modals)
- Nav updated: WorkspaceLayout now includes "S3 Campaign" link

## ACTIVE WORK
ACP M2 sprint — UI tasks:
- AA-44: S0 review page ✅ (merged)
- AA-88: Competitor URL management page ✅ (merged)
- AA-45: S3 Gate 2 HITL review page ✅ (develop, CI #20 green)
- AA-89: B2B self-approval — migration 021 (Session 23 P0)
- AA-90: S1 Trigger page (/workspace/s1/run) ← NEXT after AA-89

## Git Rules — NON-NEGOTIABLE
- ALWAYS work on branch: develop (never main directly)
- Commit to develop only
- DO NOT merge to main — human does that manually after CI green
- Before starting: git checkout develop && git pull origin develop
