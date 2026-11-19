/**
 * Core domain types for quasiAthlete v1 (F1 Load Ledger + Thin F2 Weekly Templates).
 * Mirrors docs/f1-f2-hybrid-spec.md 1:1 for clean mapping across Zod, Drizzle, and JSON configs.
 */

export type MainSport = "swim" | "erg" | "squash";
export type TrackBranch = "sprint_track" | "mdlong_track";
export type GymModality = "sprint_force" | "distance_prehab";
export type SessionSport = MainSport | "track" | "gym" | "other";
export type IntensityTag = "easy" | "moderate" | "hard"; // P4: user-declared only, NEVER derived from RPE/HR
export type ReviewStatus = "baseline" | "green" | "amber" | "red";
export type PrincipleId = "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P9" | "P10";

export type BodyRegion =
  | "shoulder_left"
  | "shoulder_right"
  | "lumbar"
  | "rib_chest_wall"
  | "ankle"
  | "calf_achilles"
  | "knee"
  | "groin_adductor"
  | "hamstring"
  | "shin_foot_bone";

export type RedFlagCode =
  | "focal_bone_pain"
  | "pain_on_weight_bearing"
  | "swelling"
  | "altered_gait_or_technique"
  | "rib_pain_breathing_or_coughing"
  | "chest_pain"
  | "fainting_dizziness"
  | "heat_illness_symptoms";

export type ProvokingDomain =
  | "swim"
  | "erg"
  | "squash"
  | "track"
  | "gym_upper"
  | "gym_lower";

export type SquashSessionType =
  | "group"
  | "feeding"
  | "ghosting"
  | "matchplay"
  | "conditioning"
  | "solo_drills";

export type ConsentTierKey =
  | "R1_benchmarks"
  | "R2_regionalSymptoms"
  | "R2_researchExport"
  | "R3_stackFingerprintExport"
  | "R4_sleepManual"
  | "R4_sleepWearable"
  | "R5_heartRateManual"
  | "R5_heartRateWearable";

export interface TierConsent {
  enabled: boolean;
  source?: "manual" | "wearable_oauth";
  purposeVersion: string;
  grantedAt?: string;
  revokedAt?: string;
  oauthProvider?: "apple_health" | "garmin" | "oura" | "polar" | "none";
  oauthScopes?: string[];
}

export interface ConsentSettings {
  consentVersion: string;
  updatedAt: string;
  isAdultConfirmed: boolean;
  tiers: Record<ConsentTierKey, TierConsent>;
  lastExportedAt?: string;
}

export interface CompetitionItem {
  date: string; // YYYY-MM-DD
  sport: MainSport | "track";
  priority: "A" | "B" | "C";
  label: string;
}

export interface AthleteProfile {
  id: string;
  ownerSub: string;
  displayName: string;
  createdAt: string;
  mainSport: MainSport;
  trackBranch: TrackBranch;
  gymModality: GymModality;
  phase: "baseline" | "active";
  baselineStartDate: string; // YYYY-MM-DD
  baselineWeeksCompleted: number;
  weeklyHardBudgetCap: number | null;
  injuryHistoryRegions: BodyRegion[];
  upcomingCompetitions: CompetitionItem[];
  consent: ConsentSettings;
}

export interface RegionalSymptomEntry {
  region: BodyRegion;
  painDuring: number; // 0-10
  painAfter: number; // 0-10
  painNextMorning?: number; // 0-10
  redFlags?: RedFlagCode[];
}

export interface SwimFields {
  distanceM: number;
  strokePrimary: "freestyle" | "backstroke" | "breaststroke" | "butterfly" | "im" | "mixed";
  setType: "technique" | "aerobic" | "threshold" | "sprint" | "mixed";
  usedPaddles: boolean;
  usedPullBuoy: boolean;
  hardSetsCount?: number;
}

export interface ErgFields {
  // Rowing is erg-only in v1 (no on-water logging)
  ergMinutes: number;
  distanceM?: number;
  longestContinuousBoutMin: number; // >30 min is a key lumbar trigger
  hasHardIntervals: boolean;
  avgSplitSecPer500m?: number;
  avgWatts?: number;
  ergType?: "static" | "dynamic";
}

export interface SquashFields {
  sessionType: SquashSessionType; // Matchplay is NOT assumed hardest
  courtMinutes: number;
  codDensityRating?: 1 | 2 | 3 | 4 | 5;
  heatStrainNoted?: boolean;
}

export interface TrackFields {
  trackBranch: TrackBranch;
  sessionType:
    | "speed"
    | "hills"
    | "plyo"
    | "intervals"
    | "tempo"
    | "easy_run"
    | "long_run"
    | "drills";
  distanceKm?: number;
  surface: "track" | "road" | "grass" | "trail" | "treadmill" | "indoor";
  speedSessionFlag: boolean;
  hillsFlag: boolean;
  plyoContacts?: number;
}

export interface GymExerciseBlock {
  pattern:
    | "squat"
    | "hinge"
    | "unilateral_lower"
    | "calf_soleus"
    | "hamstring_eccentric"
    | "adductor_hip"
    | "upper_push"
    | "upper_pull"
    | "scapular"
    | "trunk"
    | "plyo_power";
  sets: number;
  reps: number;
  loadKg?: number;
  isHeavyLower?: boolean;
  isHeavyUpper?: boolean;
}

export interface GymFields {
  modality: GymModality;
  blocks: GymExerciseBlock[];
  lowerBodyHardSets: number;
  upperBodyHardSets: number;
}

export interface SessionLog {
  id: string;
  athleteId: string;
  date: string; // YYYY-MM-DD
  sport: SessionSport;
  durationMin: number;
  intensityTag: IntensityTag; // P4: strictly user-declared
  isKeySession: boolean;
  sessionRpe?: number; // 0-10
  sessionLoad?: number; // Optional informational trend: sessionRpe * durationMin
  rpeHigherThanExpected?: boolean;
  sleepHours?: number;
  sleepQuality?: 1 | 2 | 3 | 4 | 5;
  perceivedFatigue?: number; // 1-10
  avgHrBpm?: number;
  hrZoneMinutes?: { z1: number; z2: number; z3: number; z4: number; z5: number };
  symptoms: RegionalSymptomEntry[];
  swim?: SwimFields;
  erg?: ErgFields;
  squash?: SquashFields;
  track?: TrackFields;
  gym?: GymFields;
  notes?: string;
  createdAt?: string;
}

export interface RegionWeeklySummary {
  maxPainDuring: number;
  maxPainAfter: number;
  maxPainNextMorning: number;
  maxPainAny: number;
  symptomaticSessions: number;
  consecutiveWeeksElevated: number;
  priorWeekMaxPain: number;
  redFlagsTriggered: RedFlagCode[];
}

export interface WeeklyLedger {
  weekStartDate: string; // ISO Monday YYYY-MM-DD
  athleteId: string;
  isBaselineWeek: boolean;
  sessionCount: number;
  global: {
    totalMinutes: number;
    totalSessionLoad: number;
    declaredHardSessions: number; // P4 strictly from intensityTag === 'hard'
    hardSessionDates: string[];
    maxConsecutiveHardDays: number;
    unusualRpeSessions: number;
    avgSleepHours?: number;
    avgFatigue?: number;
  };
  swim: {
    sessions: number;
    minutes: number;
    distanceM: number;
    paddleSessions: number;
    sprintSetSessions: number;
  };
  erg: {
    sessions: number;
    minutes: number;
    longBoutsOver30m: number;
    maxContinuousBoutMin: number;
    hardIntervalSessions: number;
  };
  squash: {
    sessions: number;
    courtMinutes: number;
    sessionsByType: Partial<Record<SquashSessionType, number>>;
    highDensitySessions: number;
  };
  track: {
    sessions: number;
    minutes: number;
    distanceKm: number;
    speedSessions: number;
    hillSessions: number;
    totalPlyoContacts: number;
    hardTrackSessions: number;
  };
  gym: {
    sessions: number;
    sprintForceSessions: number;
    distancePrehabSessions: number;
    heavyLowerSessions: number;
    lowerBodyHardSets: number;
    upperBodyHardSets: number;
  };
  symptomsByRegion: Partial<Record<BodyRegion, RegionWeeklySummary>>;
}

export interface RollingBaseline {
  weeksIncluded: number;
  totalSessions: number;
  hasSufficientData: boolean;
  globalSessionLoad: number;
  declaredHardSessions: number;
  avgSleepHours?: number;
  swimDistanceM: number;
  swimPaddleSessions: number;
  ergMinutes: number;
  ergLongBoutsOver30m: number;
  squashMinutes: number;
  squashHighDensitySessions: number;
  trackMinutes: number;
  trackSpeedSessions: number;
  trackPlyoContacts: number;
  gymLowerHardSets: number;
  gymUpperHardSets: number;
}

export interface ReviewTrigger {
  code: string;
  severity: "info" | "amber" | "red";
  principle: PrincipleId;
  domain: "global" | ProvokingDomain | "symptom" | "recovery";
  metric?: string;
  currentValue?: number;
  baselineValue?: number;
  message: string;
}

export interface RuleTraceStep {
  id: string;
  principle: PrincipleId;
  ruleName: string;
  configPath: string;
  outcome: "pass" | "info" | "amber" | "red" | "skipped";
  currentSummary: string;
  thresholdSummary: string;
  explanation: string;
}

export interface ReviewResult {
  weekStartDate: string;
  evaluatedAt: string;
  rulesVersion: string;
  status: ReviewStatus;
  triggers: ReviewTrigger[];
  provokingDomains: ProvokingDomain[];
  templateDirective: {
    templateId: string;
    mode: "baseline_observe" | "full_template" | "amber_reduced" | "red_recovery_only";
    hardSessionCap: number;
    allowOneProgression: boolean;
    adjustments: string[];
    substitutionWarning?: string;
    clinicalGuidance?: string;
  };
}

export interface F1RulesConfig {
  version: string;
  description: string;
  baseline: {
    minWeeks: number;
    targetWeeks: number;
    rollingWindowWeeks: number;
    minSessionsInWindow: number;
  };
  hardBudget: {
    amberDeltaOverBaseline: number;
    maxConsecutiveHardDays: number;
    fallbackWeeklyCap: number;
  };
  domainSpikes: {
    globalSessionLoad: { ratioAmber: number; advisoryOnly: boolean };
    swim: { distanceRatioAmber: number; minDeltaM: number; paddleSessionsJump: number };
    erg: {
      minutesRatioAmber: number;
      minDeltaMin: number;
      longBoutThresholdMin: number;
      longBoutCountJump: number;
    };
    squash: { minutesRatioAmber: number; minDeltaMin: number; highDensityJump: number };
    track: {
      minutesRatioAmber: number;
      minDeltaMin: number;
      speedSessionsJump: number;
      plyoContactsRatioAmber: number;
      minDeltaContacts: number;
    };
    gym: {
      lowerHardSetsRatioAmber: number;
      minDeltaLowerSets: number;
      upperHardSetsRatioAmber: number;
      minDeltaUpperSets: number;
    };
  };
  stacking: {
    amberOnSimultaneousDomainSpikes: number;
    highRiskCombos: Array<{
      id: string;
      label: string;
      provokers: ProvokingDomain[];
      message: string;
    }>;
  };
  symptomsAndRecovery: {
    amberPainThreshold: number;
    amberSymptomaticSessions: number;
    amberNextMorningPain: number;
    amberUnusualRpeSessions: number;
    amberSleepHoursFloor: number;
    amberSleepDropVsBaselineH: number;
    amberFatigueMeanMin: number;
    regionToProvokerMap: Record<BodyRegion, ProvokingDomain[]>;
  };
  redLines: {
    ribChestWallPainMin: number;
    severePainMin: number;
    worseningShoulderOrBack: {
      minPain: number;
      consecutiveWeeks: number;
      regions: BodyRegion[];
    };
    clinicalFlags: RedFlagCode[];
  };
  amberDomainTrims: Record<
    ProvokingDomain,
    {
      volumeReductionPct: string;
      action: string;
    }
  >;
}

export interface TemplateSessionSlot {
  sport: SessionSport;
  domain: ProvokingDomain | "global";
  title: string;
  isKey: boolean;
  modifiers?: string[];
}

export interface TemplateDayConfig {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  primary: TemplateSessionSlot;
  secondary: TemplateSessionSlot | null;
  plannedTag: IntensityTag;
  focus: string;
}

export interface WeeklyTemplateConfig {
  id: string;
  name: string;
  mainSport: MainSport;
  trackBranch: TrackBranch;
  gymModality: GymModality;
  summary: string;
  priorityRules: string[];
  gymModule: {
    modality: GymModality;
    label: string;
    frequency: string;
    repRange: string;
    focus: string;
  };
  days: TemplateDayConfig[];
}

export interface RenderedDayPlan {
  day: TemplateDayConfig["day"];
  primary: TemplateSessionSlot;
  secondary: TemplateSessionSlot | null;
  plannedTag: IntensityTag;
  originalPlannedTag: IntensityTag;
  focus: string;
  wasModified: boolean;
  modificationNote?: string;
}

export interface RenderedWeeklyPlan {
  templateId: string;
  templateName: string;
  summary: string;
  mode: ReviewResult["templateDirective"]["mode"];
  status: ReviewStatus;
  gymModule: WeeklyTemplateConfig["gymModule"];
  priorityRules: string[];
  hardSessionCap: number;
  plannedHardSlots: number;
  allowOneProgression: boolean;
  adjustments: string[];
  substitutionWarning?: string;
  clinicalGuidance?: string;
  days: RenderedDayPlan[];
}

export interface BenchmarkRecord {
  id: string;
  athleteId: string;
  sport: MainSport | "track";
  metricLabel: string;
  valueText: string;
  recordedDate: string;
  notes?: string;
  createdAt: string;
}

export interface ConsentAuditRecord {
  id: string;
  athleteId: string;
  tier: ConsentTierKey;
  enabled: boolean;
  consentVersion: string;
  purposeVersion: string;
  oauthProvider?: string;
  oauthScopes?: string[];
  createdAt: string;
}

/** Shared display metadata for consistent UI & onboarding labels */
export const MAIN_SPORT_META: Record<
  MainSport,
  { label: string; shortLabel: string; regionalFocus: string; primaryRegions: BodyRegion[] }
> = {
  swim: {
    label: "Swimming",
    shortLabel: "Swim",
    regionalFocus: "Pool metres, paddles/pull-buoy, sprint sets & bilateral shoulder pain",
    primaryRegions: ["shoulder_left", "shoulder_right"],
  },
  erg: {
    label: "Rowing (Erg Only)",
    shortLabel: "Erg Rowing",
    regionalFocus: "Erg minutes, continuous bouts >30 min, lumbar & rib/chest-wall symptoms",
    primaryRegions: ["lumbar", "rib_chest_wall"],
  },
  squash: {
    label: "Squash",
    shortLabel: "Squash",
    regionalFocus: "Court minutes by session type, COD density, ankle/calf/knee/groin load",
    primaryRegions: ["ankle", "calf_achilles", "knee", "groin_adductor"],
  },
};

export const TRACK_BRANCH_META: Record<
  TrackBranch,
  {
    label: string;
    shortLabel: string;
    events: string;
    gymModality: GymModality;
    gymLabel: string;
    gymSummary: string;
    impactFocus: string;
  }
> = {
  sprint_track: {
    label: "Sprint Track (60m–400m)",
    shortLabel: "Sprint Track",
    events: "60m–400m",
    gymModality: "sprint_force",
    gymLabel: "sprint_force — Heavy Low-Rep Force",
    gymSummary: "1–2x/wk heavy compound lifts (3–5 reps, full rest) + low-volume power/plyos.",
    impactFocus: "Speed sessions, hills, plyo contacts & surface",
  },
  mdlong_track: {
    label: "Md–Long Track (800m–5km)",
    shortLabel: "Md–Long Track",
    events: "800m–5km",
    gymModality: "distance_prehab",
    gymLabel: "distance_prehab — Tendon & Prehab Capacity",
    gymSummary:
      "2x/wk lighter loads (8–15 reps): calf/soleus, eccentric hamstring, hip/SLS & trunk stability.",
    impactFocus: "Run minutes, intensity distribution & hills",
  },
};

export const BODY_REGION_LABELS: Record<BodyRegion, string> = {
  shoulder_left: "Left Shoulder",
  shoulder_right: "Right Shoulder",
  lumbar: "Lower Back (Lumbar)",
  rib_chest_wall: "Rib / Chest Wall",
  ankle: "Ankle",
  calf_achilles: "Calf / Achilles",
  knee: "Knee",
  groin_adductor: "Groin / Adductor",
  hamstring: "Hamstring",
  shin_foot_bone: "Shin / Foot Bone",
};

export const RED_FLAG_LABELS: Record<RedFlagCode, string> = {
  focal_bone_pain: "Focal / pinpoint bone pain (shin, foot, or stress-fracture site)",
  pain_on_weight_bearing: "Pain when walking or bearing normal weight",
  swelling: "Visible joint or tissue swelling",
  altered_gait_or_technique: "Altered gait, limping, or forced technique compensation",
  rib_pain_breathing_or_coughing: "Rib/chest-wall pain when breathing deeply or coughing",
  chest_pain: "Chest pain or tightness during/after exercise",
  fainting_dizziness: "Fainting, near-fainting, or unexplained dizziness",
  heat_illness_symptoms: "Heat illness symptoms (confusion, chills, nausea, collapse)",
};

export const CONSENT_VERSION = "1.0.0";

export const CONSENT_TIER_META: Record<
  ConsentTierKey,
  {
    code: string;
    title: string;
    purpose: string;
    sourceLabel: string;
    defaultEnabled: boolean;
    purposeVersion: string;
    isWearable?: boolean;
    isResearchExport?: boolean;
  }
> = {
  R1_benchmarks: {
    code: "R1",
    title: "Standardized Sport Benchmarks",
    purpose:
      "Optionally log repeatable sport tests (swim 100m, erg 2k, squash ghosting, track time trial) to check whether training transfers to sport performance.",
    sourceLabel: "User-entered",
    defaultEnabled: false,
    purposeVersion: "r1-v1",
  },
  R2_regionalSymptoms: {
    code: "R2",
    title: "Regional Symptom Surveillance (Core Monitoring)",
    purpose:
      "Track region-specific pain during, after, and next morning so F1 rules (P6 & P9) can override green load numbers and flag clinical red lines.",
    sourceLabel: "User-entered",
    defaultEnabled: true,
    purposeVersion: "r2-core-v1",
  },
  R2_researchExport: {
    code: "R2-Export",
    title: "Anonymized Regional Symptom Research Export",
    purpose:
      "Opt in to include de-identified regional symptom trajectories in aggregate multisport injury research exports. Never sold to third parties.",
    sourceLabel: "Export opt-in",
    defaultEnabled: false,
    purposeVersion: "r2-export-v1",
    isResearchExport: true,
  },
  R3_stackFingerprintExport: {
    code: "R3-Export",
    title: "Anonymized Multisport Stack Fingerprint Export",
    purpose:
      "Local weekly ledgers always run for your review. Opt in separately to share de-identified weekly discipline minutes, user-hard counts, and modality tags for cohort research.",
    sourceLabel: "Export opt-in",
    defaultEnabled: false,
    purposeVersion: "r3-export-v1",
    isResearchExport: true,
  },
  R4_sleepManual: {
    code: "R4-Manual",
    title: "Sleep Duration & Subjective Quality (Manual Entry)",
    purpose:
      "Log sleep hours and 1-5 quality manually to provide recovery context during weekly reviews without connecting any wearable device.",
    sourceLabel: "User-entered",
    defaultEnabled: false,
    purposeVersion: "r4-manual-v1",
  },
  R4_sleepWearable: {
    code: "R4-Wearable",
    title: "Sleep Sync via Wearable OAuth (Optional)",
    purpose:
      "Authorize read-only sleep duration sync from a wearable provider (Apple Health, Garmin, Oura). Off by default; never triggers automated injury 'readiness' scores.",
    sourceLabel: "Wearable OAuth",
    defaultEnabled: false,
    purposeVersion: "r4-wearable-v1",
    isWearable: true,
  },
  R5_heartRateManual: {
    code: "R5-Manual",
    title: "Session Heart Rate (Manual Entry)",
    purpose:
      "Optionally record average HR or zone minutes on key sessions to compare internal strain against your user-declared easy/moderate/hard tags (never overwrites P4 tags).",
    sourceLabel: "User-entered",
    defaultEnabled: false,
    purposeVersion: "r5-manual-v1",
  },
  R5_heartRateWearable: {
    code: "R5-Wearable",
    title: "Session Heart Rate via Wearable OAuth (Optional)",
    purpose:
      "Authorize read-only session HR import from a wearable provider. Off by default; HR never overrides your user-declared hard-session tags.",
    sourceLabel: "Wearable OAuth",
    defaultEnabled: false,
    purposeVersion: "r5-wearable-v1",
    isWearable: true,
  },
};

export function createDefaultConsentSettings(nowIso = new Date().toISOString()): ConsentSettings {
  const tiers = {} as Record<ConsentTierKey, TierConsent>;
  for (const key of Object.keys(CONSENT_TIER_META) as ConsentTierKey[]) {
    const meta = CONSENT_TIER_META[key];
    tiers[key] = {
      enabled: meta.defaultEnabled,
      source: meta.isWearable ? "wearable_oauth" : "manual",
      purposeVersion: meta.purposeVersion,
      grantedAt: meta.defaultEnabled ? nowIso : undefined,
      oauthProvider: meta.isWearable ? "none" : undefined,
      oauthScopes: meta.isWearable ? [] : undefined,
    };
  }
  return {
    consentVersion: CONSENT_VERSION,
    updatedAt: nowIso,
    isAdultConfirmed: true,
    tiers,
  };
}

export function deriveGymModality(trackBranch: TrackBranch): GymModality {
  return trackBranch === "sprint_track" ? "sprint_force" : "distance_prehab";
}
