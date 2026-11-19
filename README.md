# quasiAthlete (v1 Proof of Concept)

**quasiAthlete** is a multisport training load ledger and gated weekly template scheduler built on the **F1 + Thin F2 Hybrid** architecture for athletes combining:

- **1 Main Sport:** Swimming (`swim`), Rowing — **Erg Only** (`erg`), or Squash (`squash`)
- **1 Always-On Track Branch:** Sprint Track 60m–400m (`sprint_track` → `sprint_force` heavy low-rep gym) **or** Md–Long Track 800m–5km (`mdlong_track` → `distance_prehab` tendon/eccentric prehab gym)

---

## Quick Start (Zero-Setup Local Dev)

You do **not** need to install Postgres manually just to explore locally — when `DATABASE_URL` is unset, `quasiAthlete` automatically runs embedded PostgreSQL 16 (`@electric-sql/pglite`) with the exact same Drizzle ORM schema and `migrations/001_init.sql`.

```bash
# 1. Install dependencies
npm install

# 2. Run the pure-TS F1/F2 rule engine unit tests (35 tests across all 6 archetypes & states)
npm test

# 3. Start the dev server (http://127.0.0.1:3000)
npm run dev
```

Open **http://127.0.0.1:3000** in your browser. From the onboarding screen (or the **Dev Sandbox** tab), you can load any of the 30 one-click presets (`swim`/`erg`/`squash` × `sprint_track`/`mdlong_track` × `baseline`/`green`/`amber_spike`/`amber_symptom`/`red_clinical`).

---

## Connecting Real PostgreSQL (Local or Cursor Apps)

When `DATABASE_URL` is set (either locally via Postgres/Docker or automatically on Cursor Apps via `cursor-app.json`), the app seamlessly switches from embedded PGlite to `pg.Pool` + Drizzle ORM:

```bash
# Push Drizzle schema OR run the SQL migration directly against Postgres
export DATABASE_URL="postgresql://user:pass@127.0.0.1:5432/quasiathlete"
npm run db:migrate     # runs migrations/001_init.sql idempotently
# or
npm run db:push        # pushes src/db/schema.ts via drizzle-kit

# Optional: seed a preset from the CLI into Postgres
npm run db:seed -- erg sprint_track amber_spike
```

> **Security note:** Never commit `.env` files containing `DATABASE_URL`.

---

## How to Tweak F1 Rules & Weekly Templates (No Code Changes Needed)

All domain thresholds and weekly schedules live in plain, human-readable JSON under `config/`. The server reads these files fresh on every request, so your edits show up as soon as you refresh the browser (or click **Reload Config JSON** in the Dev Sandbox):

| File | What you can tweak |
|---|---|
| `config/rules.json` | Baseline min weeks (`P5`), user-hard budget delta & consecutive hard-day cap (`P4`), per-discipline spike ratios & min deltas (`P2`), erg `>30 min` continuous bout threshold, multi-domain stacking & high-risk combos (`P3`), regional pain thresholds & region→provoker mapping (`P6`), red-line clinical thresholds (`P9`), and Amber trim copy. |
| `config/templates/swim__sprint_track.json` | Swimming + Sprint Track (`sprint_force`) 7-day template |
| `config/templates/swim__mdlong_track.json` | Swimming + Md–Long Track (`distance_prehab`) 7-day template |
| `config/templates/erg__sprint_track.json` | Erg Rowing + Sprint Track (`sprint_force`) 7-day template |
| `config/templates/erg__mdlong_track.json` | Erg Rowing + Md–Long Track (`distance_prehab`) 7-day template |
| `config/templates/squash__sprint_track.json` | Squash + Sprint Track (`sprint_force`) 7-day template |
| `config/templates/squash__mdlong_track.json` | Squash + Md–Long Track (`distance_prehab`) 7-day template |

After editing `config/rules.json` or any template JSON, run `npm test` to verify your rule invariants still pass!

---

## Project Layout

```text
config/
  rules.json                 # Editable F1 traffic-light thresholds & stacking rules
  templates/                 # 6 editable weekly archetype templates (3 main sports x 2 track branches)
migrations/
  001_init.sql               # Additive Postgres schema migration (matches src/db/schema.ts)
scripts/
  migrate.mjs                # Idempotent Postgres migration runner (runs at end of npm run build)
  seed.ts                    # CLI preset seeder for local Postgres
src/
  domain/                    # Pure TypeScript F1/F2 rule engine (zero DB/UI coupling!)
    types.ts                 # Domain types & R1-R5 consent metadata
    schemas.ts               # Zod validation schemas
    config-loader.ts         # Fresh JSON loader for config/rules.json & config/templates/*.json
    ledger.ts                # Weekly ISO-Monday dual ledger & rolling baseline math
    evaluator.ts             # F1 evaluator (Precedence: P9 Red -> P5 Baseline -> P6 -> P4 -> P2/P3 -> Green)
    templates.ts             # Thin F2 weekly template gate (Baseline / Green / Amber / Red)
    presets.ts               # Dev Sandbox multi-week preset generator
  db/
    schema.ts                # Drizzle ORM Postgres schema
    index.ts                 # Dual-mode Drizzle adapter (pg.Pool with DATABASE_URL, PGlite fallback)
    queries.ts               # Owner-scoped DB reads, writes, and live review orchestration
  app/
    api/                     # Authenticated Next.js Route Handlers (Zod-validated)
  components/                # Simple, readable React + Tailwind UI components
tests/
  rule-engine.test.ts        # Vitest unit tests covering P1-P6, P9, P10 & all 30 presets
```

---

## Active Domain Principles Implemented

- **P1 (Dual ledger: global + regional):** Tracks optional `sessionRpe * durationMin` as an informational trend alongside mandatory discipline-specific exposure and regional symptom scores.
- **P2 (Non-fungible disciplines):** Separate weekly units for swim, erg, squash, track, and gym — never summed into cross-sport km.
- **P3 (One novel stressor at a time):** Flags simultaneous spikes in `>= 2` domains + sport-specific high-risk combos; Green weeks allow at most one small progression in one dimension.
- **P4 (Hard-session budget — user-declared only):** Weekly hard count and consecutive hard-day clustering come strictly from the athlete's `easy` / `moderate` / `hard` tag, never inferred from RPE or HR.
- **P5 (Baseline before progression):** First 2–4 weeks run in observe-only mode until personal baselines stabilize.
- **P6 (Symptoms override metrics):** Recurring regional pain (`>= 3/10`) or next-morning pain overrides numerically Green load → Amber, trims the provoking domain, and surfaces cross-sport substitution warnings.
- **P9 (Red-line escalations — evaluated BEFORE Baseline):** Focal rib/chest-wall pain (`>= 2/10`), severe pain (`>= 7/10`), worsening shoulder/back across 2+ weeks, or any clinical red flag forces **Red** immediately, withholding standard/amber templates and displaying clinical assessment guidance.
- **P10 (Main sport + track branch shape UX):** Selects the weekly template, sport-adaptive session logging fields, regional symptom prompts, and gym split (`sprint_force` vs `distance_prehab`).

---

## Common Commands

```bash
npm run dev        # Start local dev server at http://127.0.0.1:3000
npm test           # Run Vitest unit tests for F1/F2 engine
npm run typecheck  # Run TypeScript strict typecheck (tsc --noEmit)
npm run build      # Production Next.js build + Postgres migration script
```
