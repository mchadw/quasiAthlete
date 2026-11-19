import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./index";
import { athletes, benchmarks, consentAuditLogs, sessionLogs } from "./schema";
import { loadF1RulesConfig, loadWeeklyTemplate } from "@/domain/config-loader";
import { evaluateWeeklyReview } from "@/domain/evaluator";
import { buildWeeklyLedgers, getIsoWeekStart } from "@/domain/ledger";
import { buildSandboxPreset, type SandboxScenario } from "@/domain/presets";
import { renderWeeklyTemplate } from "@/domain/templates";
import {
  CONSENT_TIER_META,
  CONSENT_VERSION,
  createDefaultConsentSettings,
  deriveGymModality,
  type AthleteProfile,
  type BenchmarkRecord,
  type ConsentAuditRecord,
  type ConsentTierKey,
  type MainSport,
  type SessionLog,
  type TrackBranch,
} from "@/domain/types";

function mapAthleteRow(row: typeof athletes.$inferSelect): AthleteProfile {
  return {
    id: row.id,
    ownerSub: row.ownerSub,
    displayName: row.displayName,
    createdAt: row.createdAt.toISOString(),
    mainSport: row.mainSport as MainSport,
    trackBranch: row.trackBranch as TrackBranch,
    gymModality: row.gymModality as AthleteProfile["gymModality"],
    phase: row.phase as AthleteProfile["phase"],
    baselineStartDate: row.baselineStartDate,
    baselineWeeksCompleted: row.baselineWeeksCompleted,
    weeklyHardBudgetCap: row.weeklyHardBudgetCap,
    injuryHistoryRegions: row.injuryHistoryRegions ?? [],
    upcomingCompetitions: row.upcomingCompetitions ?? [],
    consent: row.consentSettings,
  };
}

function mapSessionRow(row: typeof sessionLogs.$inferSelect): SessionLog {
  const payload = row.sportPayload ?? {};
  return {
    id: row.id,
    athleteId: row.athleteId,
    date: row.date,
    sport: row.sport as SessionLog["sport"],
    durationMin: row.durationMin,
    intensityTag: row.intensityTag as SessionLog["intensityTag"],
    isKeySession: row.isKeySession,
    sessionRpe: row.sessionRpe ?? undefined,
    sessionLoad: row.sessionLoad ?? undefined,
    rpeHigherThanExpected: row.rpeHigherThanExpected,
    sleepHours: row.sleepHours ?? undefined,
    sleepQuality: (row.sleepQuality as SessionLog["sleepQuality"]) ?? undefined,
    perceivedFatigue: row.perceivedFatigue ?? undefined,
    avgHrBpm: row.avgHrBpm ?? undefined,
    hrZoneMinutes: row.hrZoneMinutes ?? undefined,
    symptoms: row.symptoms ?? [],
    swim: payload.swim,
    erg: payload.erg,
    squash: payload.squash,
    track: payload.track,
    gym: payload.gym,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getAthleteByOwner(ownerSub: string): Promise<AthleteProfile | null> {
  const db = await getDb();
  const rows = await db.select().from(athletes).where(eq(athletes.ownerSub, ownerSub)).limit(1);
  if (rows.length === 0) return null;
  return mapAthleteRow(rows[0]);
}

export async function getSessionsForAthlete(
  athleteId: string,
  ownerSub: string,
): Promise<SessionLog[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(sessionLogs)
    .where(and(eq(sessionLogs.athleteId, athleteId), eq(sessionLogs.ownerSub, ownerSub)))
    .orderBy(desc(sessionLogs.date), desc(sessionLogs.createdAt));
  return rows.map(mapSessionRow);
}

export async function getBenchmarksForAthlete(
  athleteId: string,
  ownerSub: string,
): Promise<BenchmarkRecord[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(benchmarks)
    .where(and(eq(benchmarks.athleteId, athleteId), eq(benchmarks.ownerSub, ownerSub)))
    .orderBy(desc(benchmarks.recordedDate), desc(benchmarks.createdAt));
  return rows.map((r) => ({
    id: r.id,
    athleteId: r.athleteId,
    sport: r.sport as BenchmarkRecord["sport"],
    metricLabel: r.metricLabel,
    valueText: r.valueText,
    recordedDate: r.recordedDate,
    notes: r.notes ?? undefined,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getConsentAuditForAthlete(
  athleteId: string,
  ownerSub: string,
): Promise<ConsentAuditRecord[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(consentAuditLogs)
    .where(and(eq(consentAuditLogs.athleteId, athleteId), eq(consentAuditLogs.ownerSub, ownerSub)))
    .orderBy(desc(consentAuditLogs.createdAt))
    .limit(100);
  return rows.map((r) => ({
    id: r.id,
    athleteId: r.athleteId,
    tier: r.tier as ConsentTierKey,
    enabled: r.enabled,
    consentVersion: r.consentVersion,
    purposeVersion: r.purposeVersion,
    oauthProvider: r.oauthProvider ?? undefined,
    oauthScopes: r.oauthScopes ?? undefined,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Loads the complete live dashboard state for the authenticated viewer.
 * Always reads fresh config/rules.json and config/templates/*.json so developer edits show up immediately.
 */
export async function getFullDashboardState(ownerSub: string) {
  const athlete = await getAthleteByOwner(ownerSub);
  const rules = loadF1RulesConfig();

  if (!athlete) {
    return {
      athlete: null,
      sessions: [],
      weeklyLedgers: [],
      currentLedger: null,
      evaluation: null,
      renderedPlan: null,
      benchmarks: [],
      consentAudit: [],
      rulesConfig: rules,
      activeTemplateConfig: null,
    };
  }

  const [sessions, benchmarkRows, auditRows] = await Promise.all([
    getSessionsForAthlete(athlete.id, ownerSub),
    getBenchmarksForAthlete(athlete.id, ownerSub),
    getConsentAuditForAthlete(athlete.id, ownerSub),
  ]);

  const currentWeekStart = getIsoWeekStart(new Date().toISOString().slice(0, 10));
  const ledgers = buildWeeklyLedgers(sessions, athlete, rules, currentWeekStart);
  const currentLedger = ledgers[ledgers.length - 1];
  const priorLedgers = ledgers.slice(0, -1);

  const evaluation = evaluateWeeklyReview({
    athlete,
    currentLedger,
    priorLedgers,
    rules,
  });

  const activeTemplateConfig = loadWeeklyTemplate(athlete.mainSport, athlete.trackBranch);
  const renderedPlan = renderWeeklyTemplate({
    template: activeTemplateConfig,
    review: evaluation.review,
    rules,
    athlete,
  });

  return {
    athlete,
    sessions,
    weeklyLedgers: ledgers,
    currentLedger,
    evaluation,
    renderedPlan,
    benchmarks: benchmarkRows,
    consentAudit: auditRows,
    rulesConfig: rules,
    activeTemplateConfig,
  };
}

/**
 * Creates a brand-new athlete profile (onboarding) and writes initial consent audit records.
 */
export async function createAthleteProfile(params: {
  ownerSub: string;
  displayName: string;
  mainSport: MainSport;
  trackBranch: TrackBranch;
  phase: "baseline" | "active";
  weeklyHardBudgetCap?: number | null;
  injuryHistoryRegions?: AthleteProfile["injuryHistoryRegions"];
  consentOverrides?: Partial<Record<ConsentTierKey, boolean>>;
}): Promise<AthleteProfile> {
  const db = await getDb();
  const nowIso = new Date().toISOString();
  const consent = createDefaultConsentSettings(nowIso);

  if (params.consentOverrides) {
    for (const [tierKey, enabled] of Object.entries(params.consentOverrides) as Array<
      [ConsentTierKey, boolean]
    >) {
      if (consent.tiers[tierKey]) {
        consent.tiers[tierKey].enabled = enabled;
        consent.tiers[tierKey].grantedAt = enabled ? nowIso : undefined;
      }
    }
  }

  // Delete any prior profile for this ownerSub cleanly before creating
  await db.delete(athletes).where(eq(athletes.ownerSub, params.ownerSub));

  const id = `ath_${crypto.randomUUID()}`;
  const gymModality = deriveGymModality(params.trackBranch);
  const today = nowIso.slice(0, 10);

  const [inserted] = await db
    .insert(athletes)
    .values({
      id,
      ownerSub: params.ownerSub,
      displayName: params.displayName,
      mainSport: params.mainSport,
      trackBranch: params.trackBranch,
      gymModality,
      phase: params.phase,
      baselineStartDate: today,
      baselineWeeksCompleted: params.phase === "active" ? 3 : 0,
      weeklyHardBudgetCap: params.weeklyHardBudgetCap ?? null,
      injuryHistoryRegions: params.injuryHistoryRegions ?? [],
      upcomingCompetitions: [],
      consentSettings: consent,
    })
    .returning();

  // Append initial consent audit entries for all tiers
  const auditValues = (Object.keys(consent.tiers) as ConsentTierKey[]).map((tier) => ({
    id: `aud_${crypto.randomUUID()}`,
    athleteId: id,
    ownerSub: params.ownerSub,
    tier,
    enabled: consent.tiers[tier].enabled,
    consentVersion: CONSENT_VERSION,
    purposeVersion: CONSENT_TIER_META[tier].purposeVersion,
    oauthProvider: consent.tiers[tier].oauthProvider ?? null,
    oauthScopes: consent.tiers[tier].oauthScopes ?? null,
  }));

  await db.insert(consentAuditLogs).values(auditValues);

  return mapAthleteRow(inserted);
}

/**
 * Seeds the viewer's account with a Dev Sandbox preset (replaces only the calling viewer's data).
 */
export async function seedSandboxForOwner(params: {
  ownerSub: string;
  mainSport: MainSport;
  trackBranch: TrackBranch;
  scenario: SandboxScenario;
}) {
  const db = await getDb();
  const bundle = buildSandboxPreset({
    mainSport: params.mainSport,
    trackBranch: params.trackBranch,
    scenario: params.scenario,
  });

  // Replace only this viewer's athlete (cascade clears their sessions, benchmarks, consent logs)
  await db.delete(athletes).where(eq(athletes.ownerSub, params.ownerSub));

  const athleteId = `ath_${crypto.randomUUID()}`;
  const gymModality = deriveGymModality(bundle.trackBranch);

  await db.insert(athletes).values({
    id: athleteId,
    ownerSub: params.ownerSub,
    displayName: bundle.displayName,
    mainSport: bundle.mainSport,
    trackBranch: bundle.trackBranch,
    gymModality,
    phase: bundle.phase,
    baselineStartDate: bundle.baselineStartDate,
    baselineWeeksCompleted: bundle.baselineWeeksCompleted,
    weeklyHardBudgetCap: bundle.weeklyHardBudgetCap,
    injuryHistoryRegions: bundle.injuryHistoryRegions,
    upcomingCompetitions: [],
    consentSettings: bundle.consent,
  });

  if (bundle.sessions.length > 0) {
    await db.insert(sessionLogs).values(
      bundle.sessions.map((s) => ({
        id: `ses_${crypto.randomUUID()}`,
        athleteId,
        ownerSub: params.ownerSub,
        date: s.date,
        sport: s.sport,
        durationMin: s.durationMin,
        intensityTag: s.intensityTag,
        isKeySession: s.isKeySession,
        sessionRpe: s.sessionRpe ?? null,
        sessionLoad:
          s.sessionLoad ??
          (typeof s.sessionRpe === "number" ? s.sessionRpe * s.durationMin : null),
        rpeHigherThanExpected: s.rpeHigherThanExpected ?? false,
        sleepHours: s.sleepHours ?? null,
        sleepQuality: s.sleepQuality ?? null,
        perceivedFatigue: s.perceivedFatigue ?? null,
        avgHrBpm: s.avgHrBpm ?? null,
        hrZoneMinutes: s.hrZoneMinutes ?? null,
        symptoms: s.symptoms ?? [],
        sportPayload: {
          swim: s.swim,
          erg: s.erg,
          squash: s.squash,
          track: s.track,
          gym: s.gym,
        },
        notes: s.notes ?? null,
      })),
    );
  }

  if (bundle.benchmarks.length > 0) {
    await db.insert(benchmarks).values(
      bundle.benchmarks.map((b) => ({
        id: `bmk_${crypto.randomUUID()}`,
        athleteId,
        ownerSub: params.ownerSub,
        sport: b.sport,
        metricLabel: b.metricLabel,
        valueText: b.valueText,
        recordedDate: b.recordedDate,
        notes: b.notes ?? null,
      })),
    );
  }

  const auditValues = (Object.keys(bundle.consent.tiers) as ConsentTierKey[]).map((tier) => ({
    id: `aud_${crypto.randomUUID()}`,
    athleteId,
    ownerSub: params.ownerSub,
    tier,
    enabled: bundle.consent.tiers[tier].enabled,
    consentVersion: bundle.consent.consentVersion,
    purposeVersion: CONSENT_TIER_META[tier].purposeVersion,
    oauthProvider: bundle.consent.tiers[tier].oauthProvider ?? null,
    oauthScopes: bundle.consent.tiers[tier].oauthScopes ?? null,
  }));
  await db.insert(consentAuditLogs).values(auditValues);

  return getFullDashboardState(params.ownerSub);
}
