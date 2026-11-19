import crypto from "node:crypto";
import { getDb } from "@/db";
import { getAthleteByOwner, getFullDashboardState } from "@/db/queries";
import { benchmarks } from "@/db/schema";
import { createBenchmarkSchema } from "@/domain/schemas";
import { jsonPrivate, requireViewer } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const viewer = await requireViewer(request, { mutating: true });
  if (viewer instanceof Response) return viewer;

  const athlete = await getAthleteByOwner(viewer.ownerSub);
  if (!athlete) {
    return jsonPrivate({ error: "Complete onboarding first." }, 400);
  }

  if (!athlete.consent.tiers.R1_benchmarks?.enabled) {
    return jsonPrivate(
      { error: "Enable R1 Standardized Sport Benchmarks in Consent & Data first." },
      403,
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = createBenchmarkSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonPrivate({ error: "Invalid benchmark entry", details: parsed.error.flatten() }, 400);
  }

  const db = await getDb();
  await db.insert(benchmarks).values({
    id: `bmk_${crypto.randomUUID()}`,
    athleteId: athlete.id,
    ownerSub: viewer.ownerSub,
    sport: parsed.data.sport,
    metricLabel: parsed.data.metricLabel,
    valueText: parsed.data.valueText,
    recordedDate: parsed.data.recordedDate,
    notes: parsed.data.notes ?? null,
  });

  const state = await getFullDashboardState(viewer.ownerSub);
  return jsonPrivate(state, 201);
}
