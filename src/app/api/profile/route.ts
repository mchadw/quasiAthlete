import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { createAthleteProfile, getAthleteByOwner, getFullDashboardState } from "@/db/queries";
import { athletes } from "@/db/schema";
import { onboardingInputSchema, profileUpdateSchema } from "@/domain/schemas";
import { deriveGymModality } from "@/domain/types";
import { jsonPrivate, requireViewer } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const viewer = await requireViewer(request, { mutating: true });
  if (viewer instanceof Response) return viewer;

  const rawBody = await request.json().catch(() => null);
  const parsed = onboardingInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonPrivate({ error: "Invalid onboarding input", details: parsed.error.flatten() }, 400);
  }

  await createAthleteProfile({
    ownerSub: viewer.ownerSub,
    displayName: parsed.data.displayName,
    mainSport: parsed.data.mainSport,
    trackBranch: parsed.data.trackBranch,
    phase: parsed.data.phase,
    weeklyHardBudgetCap: parsed.data.weeklyHardBudgetCap ?? null,
    injuryHistoryRegions: parsed.data.injuryHistoryRegions,
    consentOverrides: parsed.data.consentOverrides,
  });

  const state = await getFullDashboardState(viewer.ownerSub);
  return jsonPrivate(state, 201);
}

export async function PATCH(request: Request) {
  const viewer = await requireViewer(request, { mutating: true });
  if (viewer instanceof Response) return viewer;

  const existing = await getAthleteByOwner(viewer.ownerSub);
  if (!existing) {
    return jsonPrivate({ error: "No athlete profile found. Complete onboarding first." }, 404);
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = profileUpdateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonPrivate({ error: "Invalid profile update", details: parsed.error.flatten() }, 400);
  }

  const nextTrackBranch = parsed.data.trackBranch ?? existing.trackBranch;
  const db = await getDb();
  await db
    .update(athletes)
    .set({
      displayName: parsed.data.displayName ?? existing.displayName,
      mainSport: parsed.data.mainSport ?? existing.mainSport,
      trackBranch: nextTrackBranch,
      gymModality: deriveGymModality(nextTrackBranch),
      phase: parsed.data.phase ?? existing.phase,
      weeklyHardBudgetCap:
        parsed.data.weeklyHardBudgetCap !== undefined
          ? parsed.data.weeklyHardBudgetCap
          : existing.weeklyHardBudgetCap,
      injuryHistoryRegions: parsed.data.injuryHistoryRegions ?? existing.injuryHistoryRegions,
      updatedAt: new Date(),
    })
    .where(eq(athletes.id, existing.id));

  const state = await getFullDashboardState(viewer.ownerSub);
  return jsonPrivate(state);
}
