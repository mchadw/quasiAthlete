import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { getFullDashboardState } from "@/db/queries";
import { athletes } from "@/db/schema";
import { jsonPrivate, requireViewer } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;

  const state = await getFullDashboardState(viewer.ownerSub);
  if (!state.athlete) {
    return jsonPrivate({ error: "No athlete data to export." }, 404);
  }

  const exportedAt = new Date().toISOString();
  const db = await getDb();
  const nextConsent = { ...state.athlete.consent, lastExportedAt: exportedAt };
  await db
    .update(athletes)
    .set({ consentSettings: nextConsent, updatedAt: new Date() })
    .where(eq(athletes.id, state.athlete.id));

  const bundle = {
    schema: "quasiAthlete-athlete-export-v1",
    exportedAt,
    athleteProfile: { ...state.athlete, consent: nextConsent },
    sessions: state.sessions,
    weeklyLedgers: state.weeklyLedgers,
    latestReview: state.evaluation?.review ?? null,
    benchmarks: state.benchmarks,
    consentAuditTrail: state.consentAudit,
  };

  return new Response(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="quasiathlete-export-${exportedAt.slice(0, 10)}.json"`,
      "cache-control": "private, no-store",
    },
  });
}
