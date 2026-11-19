import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { getAthleteByOwner, getFullDashboardState } from "@/db/queries";
import { athletes, consentAuditLogs } from "@/db/schema";
import { consentUpdateSchema } from "@/domain/schemas";
import { CONSENT_TIER_META, CONSENT_VERSION } from "@/domain/types";
import { jsonPrivate, requireViewer } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const viewer = await requireViewer(request, { mutating: true });
  if (viewer instanceof Response) return viewer;

  const athlete = await getAthleteByOwner(viewer.ownerSub);
  if (!athlete) {
    return jsonPrivate({ error: "No athlete profile found." }, 404);
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = consentUpdateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonPrivate({ error: "Invalid consent update", details: parsed.error.flatten() }, 400);
  }

  const { tier, enabled, oauthProvider } = parsed.data;
  const meta = CONSENT_TIER_META[tier];
  const nowIso = new Date().toISOString();

  const updatedConsent = {
    ...athlete.consent,
    consentVersion: CONSENT_VERSION,
    updatedAt: nowIso,
    tiers: {
      ...athlete.consent.tiers,
      [tier]: {
        ...athlete.consent.tiers[tier],
        enabled,
        purposeVersion: meta.purposeVersion,
        grantedAt: enabled ? nowIso : athlete.consent.tiers[tier]?.grantedAt,
        revokedAt: !enabled ? nowIso : undefined,
        oauthProvider: meta.isWearable ? (enabled ? oauthProvider ?? "garmin" : "none") : undefined,
        oauthScopes: meta.isWearable
          ? enabled
            ? [tier === "R4_sleepWearable" ? "sleep:read" : "heart_rate:read"]
            : []
          : undefined,
      },
    },
  };

  const db = await getDb();
  await db
    .update(athletes)
    .set({ consentSettings: updatedConsent, updatedAt: new Date() })
    .where(eq(athletes.id, athlete.id));

  // Append immutable versioned audit log record in Postgres
  await db.insert(consentAuditLogs).values({
    id: `aud_${crypto.randomUUID()}`,
    athleteId: athlete.id,
    ownerSub: viewer.ownerSub,
    tier,
    enabled,
    consentVersion: CONSENT_VERSION,
    purposeVersion: meta.purposeVersion,
    oauthProvider: updatedConsent.tiers[tier].oauthProvider ?? null,
    oauthScopes: updatedConsent.tiers[tier].oauthScopes ?? null,
  });

  const state = await getFullDashboardState(viewer.ownerSub);
  return jsonPrivate(state);
}
