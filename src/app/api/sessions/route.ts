import crypto from "node:crypto";
import { getDb } from "@/db";
import { getAthleteByOwner, getFullDashboardState } from "@/db/queries";
import { sessionLogs } from "@/db/schema";
import { createSessionSchema } from "@/domain/schemas";
import { jsonPrivate, requireViewer } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const viewer = await requireViewer(request, { mutating: true });
  if (viewer instanceof Response) return viewer;

  const athlete = await getAthleteByOwner(viewer.ownerSub);
  if (!athlete) {
    return jsonPrivate({ error: "Complete onboarding before logging sessions." }, 400);
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = createSessionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonPrivate({ error: "Invalid session log", details: parsed.error.flatten() }, 400);
  }

  const d = parsed.data;
  const sessionLoad = typeof d.sessionRpe === "number" ? d.sessionRpe * d.durationMin : null;

  const db = await getDb();
  const id = `ses_${crypto.randomUUID()}`;
  await db.insert(sessionLogs).values({
    id,
    athleteId: athlete.id,
    ownerSub: viewer.ownerSub,
    date: d.date,
    sport: d.sport,
    durationMin: d.durationMin,
    intensityTag: d.intensityTag, // P4: stored verbatim as declared by athlete
    isKeySession: d.isKeySession,
    sessionRpe: d.sessionRpe ?? null,
    sessionLoad,
    rpeHigherThanExpected: d.rpeHigherThanExpected ?? false,
    sleepHours: d.sleepHours ?? null,
    sleepQuality: d.sleepQuality ?? null,
    perceivedFatigue: d.perceivedFatigue ?? null,
    avgHrBpm: d.avgHrBpm ?? null,
    hrZoneMinutes: null,
    symptoms: d.symptoms,
    sportPayload: {
      swim: d.swim,
      erg: d.erg,
      squash: d.squash,
      track: d.track,
      gym: d.gym,
    },
    notes: d.notes ?? null,
  });

  const state = await getFullDashboardState(viewer.ownerSub);
  return jsonPrivate({ createdId: id, ...state }, 201);
}
