import { z } from "zod";

export const mainSportSchema = z.enum(["swim", "erg", "squash"]);
export const trackBranchSchema = z.enum(["sprint_track", "mdlong_track"]);
export const gymModalitySchema = z.enum(["sprint_force", "distance_prehab"]);
export const sessionSportSchema = z.enum(["swim", "erg", "squash", "track", "gym", "other"]);
export const intensityTagSchema = z.enum(["easy", "moderate", "hard"]);

export const bodyRegionSchema = z.enum([
  "shoulder_left",
  "shoulder_right",
  "lumbar",
  "rib_chest_wall",
  "ankle",
  "calf_achilles",
  "knee",
  "groin_adductor",
  "hamstring",
  "shin_foot_bone",
]);

export const redFlagCodeSchema = z.enum([
  "focal_bone_pain",
  "pain_on_weight_bearing",
  "swelling",
  "altered_gait_or_technique",
  "rib_pain_breathing_or_coughing",
  "chest_pain",
  "fainting_dizziness",
  "heat_illness_symptoms",
]);

export const squashSessionTypeSchema = z.enum([
  "group",
  "feeding",
  "ghosting",
  "matchplay",
  "conditioning",
  "solo_drills",
]);

export const consentTierKeySchema = z.enum([
  "R1_benchmarks",
  "R2_regionalSymptoms",
  "R2_researchExport",
  "R3_stackFingerprintExport",
  "R4_sleepManual",
  "R4_sleepWearable",
  "R5_heartRateManual",
  "R5_heartRateWearable",
]);

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const onboardingInputSchema = z.object({
  displayName: z.string().trim().min(1).max(80).default("Athlete"),
  mainSport: mainSportSchema,
  trackBranch: trackBranchSchema,
  phase: z.enum(["baseline", "active"]).default("baseline"),
  weeklyHardBudgetCap: z.number().int().min(1).max(6).nullable().optional(),
  injuryHistoryRegions: z.array(bodyRegionSchema).max(10).default([]),
  isAdultConfirmed: z.literal(true, {
    errorMap: () => ({ message: "Adults (18+) confirmation is required in v1." }),
  }),
  consentOverrides: z.record(consentTierKeySchema, z.boolean()).optional(),
});

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  mainSport: mainSportSchema.optional(),
  trackBranch: trackBranchSchema.optional(),
  phase: z.enum(["baseline", "active"]).optional(),
  weeklyHardBudgetCap: z.number().int().min(1).max(6).nullable().optional(),
  injuryHistoryRegions: z.array(bodyRegionSchema).max(10).optional(),
});

export const symptomEntrySchema = z.object({
  region: bodyRegionSchema,
  painDuring: z.number().min(0).max(10),
  painAfter: z.number().min(0).max(10),
  painNextMorning: z.number().min(0).max(10).optional(),
  redFlags: z.array(redFlagCodeSchema).max(8).optional(),
});

export const swimFieldsSchema = z.object({
  distanceM: z.number().min(0).max(25000),
  strokePrimary: z.enum(["freestyle", "backstroke", "breaststroke", "butterfly", "im", "mixed"]),
  setType: z.enum(["technique", "aerobic", "threshold", "sprint", "mixed"]),
  usedPaddles: z.boolean(),
  usedPullBuoy: z.boolean(),
  hardSetsCount: z.number().int().min(0).max(50).optional(),
});

export const ergFieldsSchema = z.object({
  ergMinutes: z.number().min(1).max(300),
  distanceM: z.number().min(0).max(60000).optional(),
  longestContinuousBoutMin: z.number().min(1).max(300),
  hasHardIntervals: z.boolean(),
  avgSplitSecPer500m: z.number().min(60).max(300).optional(),
  avgWatts: z.number().min(20).max(1000).optional(),
  ergType: z.enum(["static", "dynamic"]).optional(),
});

export const squashFieldsSchema = z.object({
  sessionType: squashSessionTypeSchema,
  courtMinutes: z.number().min(1).max(240),
  codDensityRating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  heatStrainNoted: z.boolean().optional(),
});

export const trackFieldsSchema = z.object({
  trackBranch: trackBranchSchema,
  sessionType: z.enum([
    "speed",
    "hills",
    "plyo",
    "intervals",
    "tempo",
    "easy_run",
    "long_run",
    "drills",
  ]),
  distanceKm: z.number().min(0).max(60).optional(),
  surface: z.enum(["track", "road", "grass", "trail", "treadmill", "indoor"]),
  speedSessionFlag: z.boolean(),
  hillsFlag: z.boolean(),
  plyoContacts: z.number().int().min(0).max(500).optional(),
});

export const gymBlockSchema = z.object({
  pattern: z.enum([
    "squat",
    "hinge",
    "unilateral_lower",
    "calf_soleus",
    "hamstring_eccentric",
    "adductor_hip",
    "upper_push",
    "upper_pull",
    "scapular",
    "trunk",
    "plyo_power",
  ]),
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(50),
  loadKg: z.number().min(0).max(500).optional(),
  isHeavyLower: z.boolean().optional(),
  isHeavyUpper: z.boolean().optional(),
});

export const gymFieldsSchema = z.object({
  modality: gymModalitySchema,
  blocks: z.array(gymBlockSchema).max(20).default([]),
  lowerBodyHardSets: z.number().int().min(0).max(60),
  upperBodyHardSets: z.number().int().min(0).max(60),
});

export const createSessionSchema = z.object({
  date: z.string().regex(isoDateRegex, "Date must be YYYY-MM-DD"),
  sport: sessionSportSchema,
  durationMin: z.number().int().min(1).max(480),
  intensityTag: intensityTagSchema,
  isKeySession: z.boolean().default(false),
  sessionRpe: z.number().min(0).max(10).optional(),
  rpeHigherThanExpected: z.boolean().optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  sleepQuality: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
    .optional(),
  perceivedFatigue: z.number().min(1).max(10).optional(),
  avgHrBpm: z.number().int().min(30).max(230).optional(),
  symptoms: z.array(symptomEntrySchema).max(10).default([]),
  swim: swimFieldsSchema.optional(),
  erg: ergFieldsSchema.optional(),
  squash: squashFieldsSchema.optional(),
  track: trackFieldsSchema.optional(),
  gym: gymFieldsSchema.optional(),
  notes: z.string().max(1000).optional(),
});

export const consentUpdateSchema = z.object({
  tier: consentTierKeySchema,
  enabled: z.boolean(),
  oauthProvider: z.enum(["apple_health", "garmin", "oura", "polar", "none"]).optional(),
});

export const createBenchmarkSchema = z.object({
  sport: z.enum(["swim", "erg", "squash", "track"]),
  metricLabel: z.string().trim().min(1).max(120),
  valueText: z.string().trim().min(1).max(80),
  recordedDate: z.string().regex(isoDateRegex, "Date must be YYYY-MM-DD"),
  notes: z.string().max(400).optional(),
});

export const sandboxSeedSchema = z.object({
  mainSport: mainSportSchema,
  trackBranch: trackBranchSchema,
  scenario: z.enum(["baseline", "green", "amber_spike", "amber_symptom", "red_clinical"]),
});
