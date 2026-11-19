import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  createAthleteProfile,
  getConsentAuditForAthlete,
  getFullDashboardState,
  seedSandboxForOwner,
} from "@/db/queries";
import { athletes } from "@/db/schema";

describe("Postgres + Drizzle ORM integration (migrations/001_init.sql)", () => {
  it("creates an athlete profile, writes versioned consent audit rows, seeds presets, and hard-deletes cleanly", async () => {
    const ownerSub = "user:integration-test";

    // 1. Onboarding profile creation + initial R1-R5 consent audit trail
    const athlete = await createAthleteProfile({
      ownerSub,
      displayName: "Integration Tester",
      mainSport: "swim",
      trackBranch: "mdlong_track",
      phase: "baseline",
    });

    expect(athlete.mainSport).toBe("swim");
    expect(athlete.trackBranch).toBe("mdlong_track");
    expect(athlete.gymModality).toBe("distance_prehab");
    expect(athlete.consent.tiers.R2_regionalSymptoms.enabled).toBe(true);
    expect(athlete.consent.tiers.R4_sleepWearable.enabled).toBe(false);
    expect(athlete.consent.tiers.R2_researchExport.enabled).toBe(false);

    const audits = await getConsentAuditForAthlete(athlete.id, ownerSub);
    expect(audits.length).toBe(8);

    // 2. Seed Amber Spike preset via Drizzle queries and verify live evaluation
    const seeded = await seedSandboxForOwner({
      ownerSub,
      mainSport: "erg",
      trackBranch: "sprint_track",
      scenario: "amber_spike",
    });

    expect(seeded.athlete?.mainSport).toBe("erg");
    expect(seeded.athlete?.gymModality).toBe("sprint_force");
    expect(seeded.sessions.length).toBeGreaterThanOrEqual(20);
    expect(seeded.evaluation?.review.status).toBe("amber");
    expect(seeded.renderedPlan?.mode).toBe("amber_reduced");

    // 3. Hard delete cascades cleanly for ownerSub only
    const db = await getDb();
    await db.delete(athletes).where(eq(athletes.ownerSub, ownerSub));

    const afterDelete = await getFullDashboardState(ownerSub);
    expect(afterDelete.athlete).toBeNull();
    expect(afterDelete.sessions).toHaveLength(0);
  });
});
