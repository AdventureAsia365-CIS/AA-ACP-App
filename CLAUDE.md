# CLAUDE.md — AA-ACP-App

## Project Context
ACP (Agency Content Pipeline) — B2B tenant-facing portal delivering AI-generated
SEO content to travel agencies. Part of AA_Ecosys program.

## Stack
- **Frontend**: Next.js 14 (TypeScript), Tailwind CSS, Vercel
- **Backend API**: AA-CIS-App (shared ECS service)
- **Portal URL**: acp.lumiguides.it.com
- **Vercel Project**: aa-acp-portal

## Git Workflow (NON-NEGOTIABLE)
```
feature/aa-XX-desc → develop → CI green → main → Deploy (Vercel)
```
- NEVER merge directly to main
- Always create feature branch from develop
- Branch naming: feature/aa-XX-short-desc

## Code Patterns

### TypeScript / Next.js
- No localStorage/sessionStorage (not supported in Vercel artifacts)
- Use React state (useState, useReducer) for all client state
- API calls to: process.env.NEXT_PUBLIC_API_URL (default: https://api-cis.lumiguides.it.com)
- Auth: X-Admin-Secret header for admin, API key for B2B tenants
- TypeScript strict mode — no `any` types

### Component Patterns
- No HTML `<form>` tags — use onClick handlers
- Graceful empty states for all data-dependent UI
- Loading states for all async operations

### API Integration
- Social content: GET/POST /v1/acp/s4/social/*
- Batch review: POST /v1/social/batch-review
- Context panel: GET /v1/social/{id}/context
- Angle retry: POST /v1/acp/s4/social/{id}/retry-angle

## Current State (05/06/2026)
- Branch: develop (main = production)
- Main commit: 5232a0f
- Key pages built:
  - /workspace/social — Gate 3-social batch review grid (AA-111)
  - ContextPanel with quality score + angle retry (AA-127, AA-126)
  - S1→S4.2 pipeline views (S0-S4 workspace)

## Do NOT
- Use localStorage (not supported)
- Hardcode API URLs (use env vars)
- Create nested code blocks in prompts
