import { describe, expect, it } from "vitest";
import {
  loadAllWeeklyTemplates,
  loadF1RulesConfig,
  loadWeeklyTemplate,
} from "@/domain/config-loader";
import { evaluateWeeklyReview } from "@/domain/evaluator";
import { buildWeeklyLedgers } from "@/domain/ledger";
import { buildSandboxPreset, type SandboxScenario } from "@/domain/presets";
import { renderWeeklyTemplate } from "@/domain/templates";
import {
  deriveGymModality,
  type AthleteProfile,
  type MainSport,
  type SessionLog,
  type TrackBranch,
} from "@/domain/types";

const rules = loadF1RulesConfig();

function toAthleteAndSessions(
  mainSport: MainSport,
  trackBranch: TrackBranch,
  scenario: SandboxScenario,
) {
  const preset = buildSandboxPreset({
    mainSport,
    trackBranch,
    scenario,
    referenceDate: "2026-11-19",
  });
  const athlete: AthleteProfile = {
    id: "ath_test",
    ownerSub: "user:test",
    displayName: preset.displayName,
    createdAt: "2026-10-01T00:00:00Z",
    mainSport: preset.mainSport,
    trackBranch: preset.trackBranch,
    gymModality: deriveGymModality(preset.trackBranch),
    phase: preset.phase,
    baselineStartDate: preset.baselineStartDate,
    baselineWeeksCompleted: preset.baselineWeeksCompleted,
    weeklyHardBudgetCap: preset.weeklyHardBudgetCap,
    injuryHistoryRegions: preset.injuryHistoryRegions,
    upcomingCompetitions: [],
    consent: preset.consent,
  };
  const sessions: SessionLog[] = preset.sessions.map((s, idx) => ({
    ...s,
    id: `ses_${idx}`,
    athleteId: athlete.id,
  }));
  return { athlete, sessions };
}

describe("Config loading & P10 archetype templates", () => {
  it("loads all 6 weekly templates with stark sprint_force vs distance_prehab split", () => {
    const templates = loadAllWeeklyTemplates();
    expect(templates).toHaveLength(6);

    for (const tpl of templates) {
      expect(tpl.days).toHaveLength(7);
      if (tpl.trackBranch === "sprint_track") {
        expect(tpl.gymModality).toBe("sprint_force");
        expect(tpl.gymModule.modality).toBe("sprint_force");
      } else {
        expect(tpl.gymModality).toBe("distance_prehab");
        expect(tpl.gymModule.modality).toBe("distance_prehab");
      }
    }
  });
});

describe("P9 Red-Line precedence (evaluates BEFORE P5 Baseline!)", () => {
  it("triggers Red during baseline phase when focal rib pain >= 2/10 is logged", () => {
    const { athlete, sessions } = toAthleteAndSessions("erg", "sprint_track", "baseline");
    expect(athlete.phase).toBe("baseline");

    sessions.push({
      id: "ses_rib",
      athleteId: athlete.id,
      date: "2026-11-19",
      sport: "erg",
      durationMin: 30,
      intensityTag: "moderate",
      isKeySession: false,
      symptoms: [{ region: "rib_chest_wall", painDuring: 2, painAfter: 2, painNextMorning: 2 }],
      erg: { ergMinutes: 30, longestContinuousBoutMin: 20, hasHardIntervals: false },
    });

    const ledgers = buildWeeklyLedgers(sessions, athlete, rules, "2026-11-16");
    const result = evaluateWeeklyReview({
      athlete,
      currentLedger: ledgers[ledgers.length - 1],
      priorLedgers: ledgers.slice(0, -1),
      rules,
    });

    expect(result.review.status).toBe("red");
    expect(result.review.templateDirective.mode).toBe("red_recovery_only");
    expect(result.review.triggers.some((t) => t.code === "RED_RIB_CHEST_WALL")).toBe(true);
    expect(result.review.templateDirective.clinicalGuidance).toContain("rib");
  });

  it("triggers Red on worsening shoulder pain >= 4/10 over 2 consecutive weeks", () => {
    const { athlete, sessions } = toAthleteAndSessions("swim", "mdlong_track", "green");
    // Prior week (week of 2026-11-09) shoulder pain = 4/10
    sessions.push({
      id: "ses_sh_prev",
      athleteId: athlete.id,
      date: "2026-11-11",
      sport: "swim",
      durationMin: 40,
      intensityTag: "easy",
      isKeySession: false,
      symptoms: [{ region: "shoulder_right", painDuring: 4, painAfter: 4, painNextMorning: 3 }],
      swim: {
        distanceM: 1800,
        strokePrimary: "freestyle",
        setType: "aerobic",
        usedPaddles: false,
        usedPullBuoy: false,
      },
    });
    // Current week (week of 2026-11-16) shoulder pain worsens to 5/10
    sessions.push({
      id: "ses_sh_curr",
      athleteId: athlete.id,
      date: "2026-11-18",
      sport: "swim",
      durationMin: 40,
      intensityTag: "easy",
      isKeySession: false,
      symptoms: [{ region: "shoulder_right", painDuring: 5, painAfter: 5, painNextMorning: 4 }],
      swim: {
        distanceM: 1800,
        strokePrimary: "freestyle",
        setType: "aerobic",
        usedPaddles: false,
        usedPullBuoy: false,
      },
    });

    const ledgers = buildWeeklyLedgers(sessions, athlete, rules, "2026-11-16");
    const result = evaluateWeeklyReview({
      athlete,
      currentLedger: ledgers[ledgers.length - 1],
      priorLedgers: ledgers.slice(0, -1),
      rules,
    });

    expect(result.review.status).toBe("red");
    expect(result.review.triggers.some((t) => t.code === "RED_WORSENING_SHOULDER_OR_BACK")).toBe(
      true,
    );
  });
});

describe("P4 Hard-session budget strictly user-declared (never derived from RPE/HR)", () => {
  it("ignores RPE 10 / HR 195 when user marks session easy or moderate", () => {
    const { athlete, sessions } = toAthleteAndSessions("swim", "sprint_track", "green");
    // Override all sessions in current week to easy/moderate with maximal RPE 10 & HR 195
    const currentWeekSessions = sessions.map((s) =>
      s.date >= "2026-11-16"
        ? { ...s, intensityTag: "moderate" as const, sessionRpe: 10, avgHrBpm: 195 }
        : s,
    );

    const ledgers = buildWeeklyLedgers(currentWeekSessions, athlete, rules, "2026-11-16");
    const current = ledgers[ledgers.length - 1];
    expect(current.global.declaredHardSessions).toBe(0);
  });

  it("triggers Amber when 3 consecutive calendar days are user-tagged hard", () => {
    const { athlete, sessions } = toAthleteAndSessions("erg", "mdlong_track", "green");
    // Add a Wed hard session between Tue (hard) and Thu (make Thu hard too -> Tue, Wed, Thu = 3 in a row)
    const modified = sessions.map((s) =>
      s.date === "2026-11-18" ? { ...s, intensityTag: "hard" as const } : s,
    );
    modified.push({
      id: "ses_thu_hard",
      athleteId: athlete.id,
      date: "2026-11-19",
      sport: "other",
      durationMin: 20,
      intensityTag: "hard",
      isKeySession: false,
      symptoms: [],
    });

    const ledgers = buildWeeklyLedgers(modified, athlete, rules, "2026-11-16");
    const result = evaluateWeeklyReview({
      athlete,
      currentLedger: ledgers[ledgers.length - 1],
      priorLedgers: ledgers.slice(0, -1),
      rules,
    });

    expect(result.review.status).toBe("amber");
    expect(result.review.triggers.some((t) => t.code === "HARD_CONSECUTIVE_CLUSTER")).toBe(true);
  });
});

describe("P6 Regional symptoms override numerically Green workload", () => {
  it("turns Green workload into Amber with P6 substitution warning and trims provoker", () => {
    const { athlete, sessions } = toAthleteAndSessions("squash", "sprint_track", "amber_symptom");
    const ledgers = buildWeeklyLedgers(sessions, athlete, rules, "2026-11-16");
    const result = evaluateWeeklyReview({
      athlete,
      currentLedger: ledgers[ledgers.length - 1],
      priorLedgers: ledgers.slice(0, -1),
      rules,
    });

    expect(result.review.status).toBe("amber");
    expect(result.review.triggers.some((t) => t.principle === "P6")).toBe(true);
    expect(result.review.templateDirective.substitutionWarning).toBeDefined();
    expect(result.review.provokingDomains).toContain("track");
    expect(result.review.provokingDomains).toContain("squash");

    const tpl = loadWeeklyTemplate("squash", "sprint_track");
    const rendered = renderWeeklyTemplate({
      template: tpl,
      review: result.review,
      rules,
      athlete,
    });
    expect(rendered.mode).toBe("amber_reduced");
    expect(rendered.allowOneProgression).toBe(false);
    expect(rendered.plannedHardSlots).toBeLessThan(3);
    // Track-primary hard day (Fri) should be dropped before Main-sport primary (Tue)
    const fri = rendered.days.find((d) => d.day === "Fri");
    expect(fri?.plannedTag).toBe("easy");
    expect(fri?.modificationNote).toContain("Hard slot dropped");
  });
});

describe("All 30 Dev Sandbox presets (6 archetypes x 5 scenarios) evaluate accurately", () => {
  const sports: MainSport[] = ["swim", "erg", "squash"];
  const branches: TrackBranch[] = ["sprint_track", "mdlong_track"];
  const scenarios: Array<{ scenario: SandboxScenario; expectedStatus: string }> = [
    { scenario: "baseline", expectedStatus: "baseline" },
    { scenario: "green", expectedStatus: "green" },
    { scenario: "amber_spike", expectedStatus: "amber" },
    { scenario: "amber_symptom", expectedStatus: "amber" },
    { scenario: "red_clinical", expectedStatus: "red" },
  ];

  for (const sport of sports) {
    for (const branch of branches) {
      for (const { scenario, expectedStatus } of scenarios) {
        it(`${sport}__${branch} / ${scenario} -> ${expectedStatus}`, () => {
          const { athlete, sessions } = toAthleteAndSessions(sport, branch, scenario);
          const ledgers = buildWeeklyLedgers(sessions, athlete, rules, "2026-11-16");
          const result = evaluateWeeklyReview({
            athlete,
            currentLedger: ledgers[ledgers.length - 1],
            priorLedgers: ledgers.slice(0, -1),
            rules,
          });

          expect(result.review.status).toBe(expectedStatus);

          const tpl = loadWeeklyTemplate(sport, branch);
          const rendered = renderWeeklyTemplate({
            template: tpl,
            review: result.review,
            rules,
            athlete,
          });

          if (expectedStatus === "red") {
            expect(rendered.mode).toBe("red_recovery_only");
            expect(rendered.plannedHardSlots).toBe(0);
          } else if (expectedStatus === "green") {
            expect(rendered.mode).toBe("full_template");
            expect(rendered.allowOneProgression).toBe(true);
          } else if (expectedStatus === "amber") {
            expect(rendered.mode).toBe("amber_reduced");
            expect(rendered.allowOneProgression).toBe(false);
          } else {
            expect(rendered.mode).toBe("baseline_observe");
            expect(rendered.allowOneProgression).toBe(false);
          }
        });
      }
    }
  }
});
