# Northstar: Career Readiness Dashboard

An explainable career-readiness and skill-gap management prototype for students and early-career users. It connects role requirements to self-assessed skills, explains why each gap matters, ranks next steps by weighted impact, and shows readiness over repeated assessments.

## Current implementation

- Next.js App Router and strict TypeScript dashboard.
- Python FastAPI API owns the role catalog, proficiency normalization, readiness calculation, and gap priorities.
- Three role rubrics: Data Analyst, Software Engineer, and Product Designer.
- Responsive dashboard with role comparison, accessible 0-5 self-assessment controls, progress history, and prioritized learning actions.
- Supabase/Postgres schema migration with relational constraints, assessment history, evidence fields, admin boundaries, and row-level security.
- A clearly labeled sample profile makes the UI usable before accounts or database credentials are configured.

The sample dashboard is a prototype, not a connected production deployment. Demo assessments and history are saved in the current browser's local storage. The API demo profile and role rubric are seeded in Python. The Supabase migration is ready to apply, but the API does not yet read or write Supabase, and authentication, evidence review, and administrator screens are not enabled. The role recommendations are deterministic and rubric-based; no AI model or external job-market feed is connected.

## Run locally

Prerequisites: Node.js 20.9 or later and Python 3.9 or later.

1. Install frontend dependencies from the project root:

   ```powershell
   npm install
   ```

2. Create and install the Python environment:

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
   ```

3. In one terminal, start the API from the project root:

   ```powershell
   .\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000
   ```

4. In another terminal, start the dashboard:

   ```powershell
   npm run dev
   ```

Open `http://localhost:3000`. The API health check is at `http://localhost:8000/api/health` and the interactive API reference is at `http://localhost:8000/docs`.

Copy `.env.example` to `.env.local` only when changing the API URL. `NEXT_PUBLIC_API_URL` is read by the browser; do not put service credentials in a `NEXT_PUBLIC_` variable. For a custom backend CORS allowlist, set `FRONTEND_ORIGINS` in the Python API process environment; its default allows both local loopback URLs on port 3000.

## Verify

```powershell
python -m unittest backend.test_engine
npm run typecheck
npm run build
```

## Supabase schema

Create a Supabase project and apply `supabase/migrations/202610060001_initial_schema.sql` in its SQL editor or through the Supabase CLI. The migration creates profile, role, skill, role-requirement, assessment, and readiness-history tables; seeds the three role rubrics; and enables RLS. Admin access is based on `profiles.account_role`; student account creation defaults to `student`.

Applying the migration alone does not connect the demo API to that project. Before enabling real accounts, add Supabase Auth token verification to the API, use request-scoped database access that respects RLS, persist assessments and snapshots through the Python service, and configure deployment secrets outside the browser bundle.

## Analysis model

Each skill is rated from 0 to 5. Role requirements have a target level and importance weight from 1 to 5. Readiness is the weighted average of the capped proficiency ratios; each gap's priority is its remaining ratio multiplied by the role weight. The API returns the contributing skill-level values, rationale, and one practical next step for every requirement. This is a transparent starter rubric, not a hiring prediction or a labor-market credential.