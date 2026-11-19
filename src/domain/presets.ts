import { addDays, getIsoWeekStart } from "./ledger";
import {
  createDefaultConsentSettings,
  deriveGymModality,
  type BodyRegion,
  type MainSport,
  type SessionLog,
  type TrackBranch,
} from "./types";

export type SandboxScenario =
  | "baseline"
  | "green"
  | "amber_spike"
  | "amber_symptom"
  | "red_clinical";

export interface SandboxSeedBundle {
  displayName: string;
  mainSport: MainSport;
  trackBranch: TrackBranch;
  phase: "baseline" | "active";
  baselineStartDate: string;
  baselineWeeksCompleted: number;
  weeklyHardBudgetCap: number | null;
  injuryHistoryRegions: BodyRegion[];
  sessions: Array<Omit<SessionLog, "id" | "athleteId" | "createdAt">>;
  benchmarks: Array<{
    sport: MainSport | "track";
    metricLabel: string;
    valueText: string;
    recordedDate: string;
    notes?: string;
  }>;
  consent: ReturnType<typeof createDefaultConsentSettings>;
}

/**
 * Generates realistic multi-week training data for ANY combination of:
 *   {swim, erg, squash} x {sprint_track, mdlong_track} x {baseline, green, amber_spike, amber_symptom, red_clinical}
 *
 * Uses dates anchored to the current ISO Monday so the live dashboard always inspects "this week"
 * against 3 prior baseline weeks!
 */
export function buildSandboxPreset(params: {
  mainSport: MainSport;
  trackBranch: TrackBranch;
  scenario: SandboxScenario;
  referenceDate?: string; // YYYY-MM-DD, defaults to today UTC
}): SandboxSeedBundle {
  const { mainSport, trackBranch, scenario } = params;
  const today = params.referenceDate ?? new Date().toISOString().slice(0, 10);
  const currentMonday = getIsoWeekStart(today);
  const gymModality = deriveGymModality(trackBranch);

  const consent = createDefaultConsentSettings();
  consent.tiers.R4_sleepManual.enabled = true;
  consent.tiers.R4_sleepManual.grantedAt = consent.updatedAt;
  consent.tiers.R1_benchmarks.enabled = true;
  consent.tiers.R1_benchmarks.grantedAt = consent.updatedAt;

  const sessions: Array<Omit<SessionLog, "id" | "athleteId" | "createdAt">> = [];

  const pushWeek = (
    weekOffsetFromCurrent: number, // -3, -2, -1, 0
    mode: "normal" | "amber_spike" | "amber_symptom" | "red_clinical",
  ) => {
    const mon = addDays(currentMonday, weekOffsetFromCurrent * 7);
    const tue = addDays(mon, 1);
    const wed = addDays(mon, 2);
    const thu = addDays(mon, 3);
    const fri = addDays(mon, 4);
    const sat = addDays(mon, 5);

    const isSpike = mode === "amber_spike";
    const isSym = mode === "amber_symptom";
    const isRed = mode === "red_clinical";

    // ----- Main Sport Sessions (Mon, Tue [Hard], Sat [Hard]) -----
    if (mainSport === "swim") {
      sessions.push({
        date: mon,
        sport: "swim",
        durationMin: 45,
        intensityTag: "easy",
        isKeySession: false,
        sessionRpe: 3,
        sessionLoad: 135,
        sleepHours: 7.5,
        sleepQuality: 4,
        perceivedFatigue: 3,
        symptoms: isSym
          ? [{ region: "shoulder_right", painDuring: 3, painAfter: 3, painNextMorning: 3 }]
          : [],
        swim: {
          distanceM: isSpike ? 2800 : 2000,
          strokePrimary: "freestyle",
          setType: "technique",
          usedPaddles: isSpike,
          usedPullBuoy: false,
        },
        notes: isSpike ? "Added paddles early in week" : "Relaxed stroke mechanics",
      });
      sessions.push({
        date: tue,
        sport: "swim",
        durationMin: isSpike ? 70 : 55,
        intensityTag: "hard",
        isKeySession: true,
        sessionRpe: 7,
        sessionLoad: (isSpike ? 70 : 55) * 7,
        sleepHours: 7.4,
        sleepQuality: 4,
        perceivedFatigue: 4,
        symptoms: isSym
          ? [{ region: "shoulder_right", painDuring: 4, painAfter: 4, painNextMorning: 3 }]
          : isRed
            ? [
                {
                  region: "shoulder_right",
                  painDuring: 7,
                  painAfter: 8,
                  painNextMorning: 7,
                  redFlags: ["altered_gait_or_technique"],
                },
              ]
            : [],
        swim: {
          distanceM: isSpike ? 3800 : 2400,
          strokePrimary: "freestyle",
          setType: trackBranch === "sprint_track" ? "sprint" : "threshold",
          usedPaddles: isSpike,
          usedPullBuoy: true,
          hardSetsCount: isSpike ? 8 : 5,
        },
        notes: isRed
          ? "Sharp catching right shoulder pain forced altered stroke mechanics"
          : "Primary quality pool session",
      });
      sessions.push({
        date: sat,
        sport: "swim",
        durationMin: isSpike ? 75 : 60,
        intensityTag: "hard",
        isKeySession: true,
        sessionRpe: 7,
        sessionLoad: (isSpike ? 75 : 60) * 7,
        sleepHours: 7.6,
        sleepQuality: 4,
        perceivedFatigue: 4,
        symptoms: [],
        swim: {
          distanceM: isSpike ? 3900 : 2500,
          strokePrimary: "freestyle",
          setType: "threshold",
          usedPaddles: isSpike,
          usedPullBuoy: false,
          hardSetsCount: 6,
        },
        notes: "Weekend main endurance/threshold anchor",
      });
    } else if (mainSport === "erg") {
      sessions.push({
        date: mon,
        sport: "erg",
        durationMin: isSpike ? 60 : 40,
        intensityTag: "easy",
        isKeySession: false,
        sessionRpe: 4,
        sessionLoad: (isSpike ? 60 : 40) * 4,
        sleepHours: 7.5,
        sleepQuality: 4,
        perceivedFatigue: 3,
        symptoms: isSym
          ? [{ region: "lumbar", painDuring: 3, painAfter: 4, painNextMorning: 3 }]
          : [],
        erg: {
          ergMinutes: isSpike ? 60 : 40,
          distanceM: isSpike ? 14500 : 9600,
          longestContinuousBoutMin: isSpike ? 45 : 20,
          hasHardIntervals: false,
          avgSplitSecPer500m: 124,
          avgWatts: 185,
          ergType: "static",
        },
        notes: isSpike ? "Continuous 45-min erg without break" : "2x20 min steady state with 3 min standing break",
      });
      sessions.push({
        date: tue,
        sport: "erg",
        durationMin: isSpike ? 60 : 45,
        intensityTag: "hard",
        isKeySession: true,
        sessionRpe: 8,
        sessionLoad: (isSpike ? 60 : 45) * 8,
        sleepHours: 7.3,
        sleepQuality: 4,
        perceivedFatigue: 4,
        symptoms: isSym
          ? [{ region: "lumbar", painDuring: 4, painAfter: 4, painNextMorning: 4 }]
          : isRed
            ? [
                {
                  region: "rib_chest_wall",
                  painDuring: 4,
                  painAfter: 5,
                  painNextMorning: 4,
                  redFlags: ["rib_pain_breathing_or_coughing"],
                },
              ]
            : [],
        erg: {
          ergMinutes: isSpike ? 60 : 45,
          distanceM: isSpike ? 15000 : 11200,
          longestContinuousBoutMin: isSpike ? 40 : 22,
          hasHardIntervals: true,
          avgSplitSecPer500m: 112,
          avgWatts: 252,
          ergType: "static",
        },
        notes: isRed
          ? "Focal left rib pain noticed on hard drive and when breathing deeply afterward"
          : "6x1000m threshold/race-pace intervals",
      });
      sessions.push({
        date: sat,
        sport: "erg",
        durationMin: isSpike ? 55 : 40,
        intensityTag: "hard",
        isKeySession: true,
        sessionRpe: 7,
        sessionLoad: (isSpike ? 55 : 40) * 7,
        sleepHours: 7.7,
        sleepQuality: 4,
        perceivedFatigue: 4,
        symptoms: [],
        erg: {
          ergMinutes: isSpike ? 55 : 40,
          distanceM: isSpike ? 13600 : 9800,
          longestContinuousBoutMin: isSpike ? 38 : 20,
          hasHardIntervals: true,
          avgSplitSecPer500m: 116,
          avgWatts: 225,
          ergType: "static",
        },
        notes: "Erg tempo blocks",
      });
    } else {
      // squash
      sessions.push({
        date: mon,
        sport: "squash",
        durationMin: 40,
        intensityTag: "easy",
        isKeySession: false,
        sessionRpe: 4,
        sessionLoad: 160,
        sleepHours: 7.6,
        sleepQuality: 4,
        perceivedFatigue: 3,
        symptoms: isSym
          ? [{ region: "calf_achilles", painDuring: 3, painAfter: 4, painNextMorning: 3 }]
          : [],
        squash: {
          sessionType: isSpike ? "conditioning" : "solo_drills",
          courtMinutes: isSpike ? 55 : 40,
          codDensityRating: isSpike ? 5 : 2,
          heatStrainNoted: false,
        },
        notes: isSpike ? "Added intense court conditioning" : "Controlled length & T-recovery drills",
      });
      sessions.push({
        date: tue,
        sport: "squash",
        durationMin: isSpike ? 65 : 50,
        intensityTag: "hard",
        isKeySession: true,
        sessionRpe: 8,
        sessionLoad: (isSpike ? 65 : 50) * 8,
        sleepHours: 7.2,
        sleepQuality: 4,
        perceivedFatigue: 5,
        symptoms: isSym
          ? [{ region: "calf_achilles", painDuring: 4, painAfter: 4, painNextMorning: 4 }]
          : isRed
            ? [
                {
                  region: "shin_foot_bone",
                  painDuring: 6,
                  painAfter: 6,
                  painNextMorning: 5,
                  redFlags: ["focal_bone_pain", "pain_on_weight_bearing"],
                },
              ]
            : [],
        squash: {
          sessionType: "group",
          courtMinutes: isSpike ? 65 : 50,
          codDensityRating: 4,
          heatStrainNoted: false,
        },
        notes: isRed
          ? "Pinpoint tenderness on distal tibia during lunges; hurts when walking after"
          : "High-density group boast-drive & conditioned games",
      });
      sessions.push({
        date: sat,
        sport: "squash",
        durationMin: isSpike ? 65 : 45,
        intensityTag: "hard",
        isKeySession: true,
        sessionRpe: 7,
        sessionLoad: (isSpike ? 65 : 45) * 7,
        sleepHours: 7.6,
        sleepQuality: 4,
        perceivedFatigue: 4,
        symptoms: [],
        squash: {
          sessionType: isSpike ? "conditioning" : "matchplay",
          courtMinutes: isSpike ? 65 : 45,
          codDensityRating: isSpike ? 5 : 3,
          heatStrainNoted: false,
        },
        notes: "Weekend matchplay / ghosting",
      });
    }

    // ----- Gym Session (Wed) — Stark branch split (sprint_force vs distance_prehab) -----
    sessions.push({
      date: wed,
      sport: "gym",
      durationMin: isSpike ? 60 : 45,
      intensityTag: isSpike ? "hard" : "moderate", // On spike, adds an extra hard day + 3 consecutive hard days!
      isKeySession: false,
      sessionRpe: isSpike ? 8 : 6,
      sessionLoad: isSpike ? 480 : 270,
      sleepHours: 7.4,
      sleepQuality: 4,
      perceivedFatigue: 4,
      symptoms: [],
      gym:
        gymModality === "sprint_force"
          ? {
              modality: "sprint_force",
              lowerBodyHardSets: isSpike ? 14 : 7,
              upperBodyHardSets: isSpike ? 12 : 6,
              blocks: [
                { pattern: "squat", sets: isSpike ? 6 : 4, reps: 4, loadKg: 115, isHeavyLower: true },
                { pattern: "hinge", sets: isSpike ? 5 : 3, reps: 4, loadKg: 130, isHeavyLower: true },
                { pattern: "upper_pull", sets: isSpike ? 6 : 3, reps: 5, loadKg: 80, isHeavyUpper: true },
                { pattern: "plyo_power", sets: 3, reps: 4, isHeavyLower: true },
              ],
            }
          : {
              modality: "distance_prehab",
              lowerBodyHardSets: isSpike ? 14 : 6,
              upperBodyHardSets: isSpike ? 11 : 4,
              blocks: [
                { pattern: "calf_soleus", sets: 3, reps: 15, loadKg: 24 },
                { pattern: "hamstring_eccentric", sets: 3, reps: 8 },
                { pattern: "unilateral_lower", sets: isSpike ? 6 : 3, reps: 12, loadKg: 16 },
                { pattern: "scapular", sets: 3, reps: 12 },
                { pattern: "trunk", sets: 3, reps: 12 },
              ],
            },
      notes:
        gymModality === "sprint_force"
          ? "Heavy low-rep force lifts (3-5 reps, full rest)"
          : "Tendon capacity & eccentric prehab (8-15 reps, low soreness)",
    });

    // ----- Track Session (Fri [Hard], plus optional Thu on Spike) -----
    sessions.push({
      date: fri,
      sport: "track",
      durationMin: isSpike ? 55 : 38,
      intensityTag: "hard",
      isKeySession: true,
      sessionRpe: 8,
      sessionLoad: (isSpike ? 55 : 38) * 8,
      sleepHours: 7.5,
      sleepQuality: 4,
      perceivedFatigue: 4,
      symptoms: [],
      track:
        trackBranch === "sprint_track"
          ? {
              trackBranch: "sprint_track",
              sessionType: "speed",
              distanceKm: isSpike ? 3.5 : 2.2,
              surface: "track",
              speedSessionFlag: true,
              hillsFlag: isSpike,
              plyoContacts: isSpike ? 110 : 45,
            }
          : {
              trackBranch: "mdlong_track",
              sessionType: "intervals",
              distanceKm: isSpike ? 11.5 : 7.5,
              surface: "track",
              speedSessionFlag: isSpike,
              hillsFlag: isSpike,
              plyoContacts: 0,
            },
      notes:
        trackBranch === "sprint_track"
          ? "Short acceleration & max-velocity flys + low-volume plyos"
          : "Threshold / VO2 track intervals",
    });

    // Extra Thu hard track session during amber_spike to demonstrate P3 stack + P4 hard-budget jump
    if (isSpike) {
      sessions.push({
        date: thu,
        sport: "track",
        durationMin: 35,
        intensityTag: "hard",
        isKeySession: false,
        sessionRpe: 8,
        sessionLoad: 280,
        sleepHours: 6.4,
        sleepQuality: 3,
        perceivedFatigue: 6,
        symptoms: [],
        track: {
          trackBranch,
          sessionType: "hills",
          distanceKm: 4.5,
          surface: "road",
          speedSessionFlag: true,
          hillsFlag: true,
          plyoContacts: trackBranch === "sprint_track" ? 40 : 0,
        },
        notes: "Added extra hill session mid-week (triggers P3 stack + P4 consecutive hard days)",
      });
    }
  };

  // Build history depending on scenario
  if (scenario === "baseline") {
    // Only 1 prior week + current week -> still in 2-4 week baseline phase!
    pushWeek(-1, "normal");
    pushWeek(0, "normal");
  } else {
    // 3 stable prior weeks so rolling baseline is solid, then apply target scenario in week 0
    pushWeek(-3, "normal");
    pushWeek(-2, "normal");
    pushWeek(-1, "normal");
    pushWeek(0, scenario === "green" ? "normal" : scenario);
  }

  const sampleBenchmarks: SandboxSeedBundle["benchmarks"] = [
    mainSport === "swim"
      ? {
          sport: "swim",
          metricLabel: "100m Freestyle Time Trial",
          valueText: "1:04.8",
          recordedDate: addDays(currentMonday, -14),
          notes: "25m pool, push start",
        }
      : mainSport === "erg"
        ? {
            sport: "erg",
            metricLabel: "2,000m Concept2 Erg Test",
            valueText: "6:54.2 (1:43.5 /500m)",
            recordedDate: addDays(currentMonday, -14),
            notes: "Drag factor 125",
          }
        : {
            sport: "squash",
            metricLabel: "6-Corner Ghosting Test (3x45s)",
            valueText: "18.5 corners/set",
            recordedDate: addDays(currentMonday, -14),
            notes: "Clean split-step & lunge recovery",
          },
    trackBranch === "sprint_track"
      ? {
          sport: "track",
          metricLabel: "Flying 30m Sprint",
          valueText: "3.42 s",
          recordedDate: addDays(currentMonday, -10),
          notes: "Spikes on synthetic track",
        }
      : {
          sport: "track",
          metricLabel: "3,000m Track Time Trial",
          valueText: "10:42",
          recordedDate: addDays(currentMonday, -10),
          notes: "Even splits",
        },
  ];

  const scenarioLabel: Record<SandboxScenario, string> = {
    baseline: "Baseline Demo",
    green: "Green Week",
    amber_spike: "Amber Spike",
    amber_symptom: "Amber Symptom",
    red_clinical: "Red Clinical",
  };

  return {
    displayName: `Athlete (${scenarioLabel[scenario]})`,
    mainSport,
    trackBranch,
    phase: scenario === "baseline" ? "baseline" : "active",
    baselineStartDate: addDays(currentMonday, scenario === "baseline" ? -7 : -28),
    baselineWeeksCompleted: scenario === "baseline" ? 1 : 3,
    weeklyHardBudgetCap: 3,
    injuryHistoryRegions:
      mainSport === "swim"
        ? ["shoulder_right"]
        : mainSport === "erg"
          ? ["lumbar"]
          : ["calf_achilles"],
    sessions,
    benchmarks: sampleBenchmarks,
    consent,
  };
}
