# AA-ACP-App — Claude Code Context
# Updated: 23/05/2026 | Session 31

## LIVE STATE
- Frontend: https://acp.lumiguides.it.com ✅ (Vercel — AA-103 production)
- Backend: https://api-cis.lumiguides.it.com (shared ECS with CIS)
- CI: Deploy #10 ✅ | CI #32 ✅ (main)
- AWS: STOPPED (shared ECS api:185, shared RDS — stop after session)
- Branch: main (AA-103 merged to production)

## STACK
- Frontend: Next.js, React 19, TypeScript (Vercel)
- Backend: FastAPI (shared ECS with CIS)
- DB: PostgreSQL 15 RDS (shared with CIS)
- LLM: AWS Bedrock T1 sonnet-4-5 (writer) + T2 haiku-4-5 (planner/evaluator)
- Pipeline: Step Functions + LangGraph 7-node (S2) + Lambda (S4 trigger)
- External: DataForSEO · Apify · WordPress REST API

## STRUCTURE
src/app/
├── (admin)/workspace/
│   ├── layout.tsx          → WorkspaceLayout (nav: Pipeline S0-S4)
│   ├── pipeline/
│   │   ├── page.tsx        → Pipeline run list (10s poll)
│   │   ├── [run_id]/page.tsx → E2E run inspector
│   │   ├── s0/page.tsx     → S0 Upload + Brand Brief
│   │   ├── s1/page.tsx     → S1 Rewrite + Gate 1
│   │   ├── s2/page.tsx     → S2 Market Research
│   │   ├── s3/page.tsx     → S3 Calendar + Gate 2
│   │   └── s4/page.tsx     → S4 Blog + Gate 3
│   └── [other workspace pages]
└── (tenant)/portal/

## DB SCHEMAS (ACP-specific)
- acp_shared: acp_runs · acp_run_context · acp_hitl_requests · acp_output_rules · audit_log
- acp_silver_s2: competitor_data · market_insights · google_trends_cache · reddit_signals_cache · visibility_reports
- acp_silver_s3: content_calendar · ads_plan · social_plan
- acp_silver_s4: blog_briefs · blog_drafts · blog_seo_meta
- acp_gold_output: published_blogs · social_content
- shared: tenants · tenant_brand_rules (shared with CIS)
- silver_aa_internal: raw_tours · generated_content · quality_scores (shared with CIS)

## PIPELINE STAGES
- S0: Input & Brand Brief → raw_tours + acp_runs + acp_run_context
- S1: Tour Content Rewrite (Sonnet-4-5 + DataForSEO) → published_tours + s1_keywords
- S2: Market & Competitor Research (LangGraph 7-node) → visibility_report + market insights
- S3: Content & Campaign Planning → content_calendar + ads_plan + social_plan
- S4: Blog & Social Content → blog_briefs + blog_drafts + published_blogs

## HITL GATES (CRITICAL — never bypass)
- Gate 1: Nghiep · 4h SLA · AUTO-APPROVE if confidence ≥85%
- Gate 2: Ms. Thu · 24h SLA · ALWAYS HUMAN · NEVER auto-approve (commercial review)
- Gate 3: Trang · 48h SLA · ALWAYS HUMAN · NEVER auto-approve (QA)

## AUTH
- Admin Portal: ADMIN_SECRET cookie
- Agency Portal: API key (tenant-scoped)

## EVENTBRIDGE
- Bus: aa-cis-dev-acp-events
- Events: acp.s0 · acp.s1 · acp.s2 · acp.s3 · acp.s4 · acp.s4.social.completed
- Known bug: S3→S4 source mismatch (acp.pipeline vs acp.s3) — not yet fixed
- SFN waitForTaskToken for HITL gates

## ENV VARS — CRITICAL
Underscore env vars corrupt in Claude markdown rendering.
NEVER auto-generate .env files. ALWAYS tell Nghiep to edit manually in VSCode.
Flag: "⚠️ Contains underscore env vars — edit manually in VSCode"

## API CONNECTION
Backend: https://api-cis.lumiguides.it.com (API GW owq9as3wjl)
Auth: X-API-Key header (per tenant, from admin panel)

## CONFIG NOTES
- tsconfig.json: "target": "es2015" added (fixes TS2802 Set iteration)
- useSearchParams() MUST be wrapped in <Suspense> for Next.js static export
- react-markdown NOT installed — use <pre className="whitespace-pre-wrap"> for markdown display

## CI/CD
- Branch: develop → preview deploy
- Branch: main → production deploy (Vercel auto-trigger)
- CI runs on PRs to main (type-check + build + ESLint)

## ACTIVE WORK — 23/05/2026
### AA-103 COMPLETE ✅ (Session 31)
All ACP pipeline stage pages merged to main, Vercel production deployed.

| Page | URL | Status |
|------|-----|--------|
| S0 Upload | /workspace/pipeline/s0 | ✅ Live |
| S1 Rewrite + Gate 1 | /workspace/pipeline/s1 | ✅ Live |
| S2 Market Research | /workspace/pipeline/s2 | ✅ Live |
| S3 Calendar + Gate 2 | /workspace/pipeline/s3 | ✅ Live |
| S4 Blog + Gate 3 | /workspace/pipeline/s4 | ✅ Live |
| Pipeline Run List | /workspace/pipeline | ✅ Live |
| Run Inspector | /workspace/pipeline/[run_id] | ✅ Live |

### Next Priority
1. Manual UAT all pages on production (need ECS + RDS running)
2. WordPress Docker UAT setup (blocks S4 CMS publish)
3. Fix EventBridge S3→S4 source mismatch (acp.pipeline vs acp.s3)
