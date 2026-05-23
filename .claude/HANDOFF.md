# HANDOFF.md — AA-ACP-App
Last updated: 23/05/2026 | Session 31

## Current State
- Branch: main (production deployed)
- Vercel: acp.lumiguides.it.com — READY ✅
- ECS: shared api:185 (STOP REQUIRED)
- AA-103: COMPLETE ✅ — all S0-S4 pages live on production

## Completed (Session 31 — AA-103)
- S0 Upload + Brand Brief: /workspace/pipeline/s0 ✅
- S1 Rewrite + Gate 1: /workspace/pipeline/s1 ✅
- S2 Market Research: /workspace/pipeline/s2 ✅
- S3 Calendar + Gate 2: /workspace/pipeline/s3 ✅
- S4 Blog + Gate 3: /workspace/pipeline/s4 ✅
- Pipeline Run List + Inspector: /workspace/pipeline + /workspace/pipeline/[run_id] ✅
- PR #1 squash-merged → develop → main
- CI: CI #32 ✅ | Deploy #10 ✅

## Next Session
1. Manual UAT all pages on production (need ECS + RDS running)
2. WordPress Docker UAT setup (blocks S4 CMS publish)
3. Fix EventBridge S3→S4 source mismatch (acp.pipeline vs acp.s3)
4. Verify Gate 1 auto-approve logic against live pipeline

## Known Blockers
- WordPress UAT: Docker + ngrok + Secrets Manager not set up
- EventBridge S3→S4 source mismatch — S4 trigger won't fire until fixed

## Cost Note
ECS/RDS shared with CIS — stop via CIS stop commands (see AA-CIS-App HANDOFF.md)
