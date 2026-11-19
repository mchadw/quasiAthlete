import { getTemplateId } from "./config-loader";
import { computeRollingBaseline } from "./ledger";
import {
  BODY_REGION_LABELS,
  RED_FLAG_LABELS,
  type AthleteProfile,
  type BodyRegion,
  type F1RulesConfig,
  type ProvokingDomain,
  type RedFlagCode,
  type ReviewResult,
  type ReviewStatus,
  type ReviewTrigger,
  type RollingBaseline,
  type RuleTraceStep,
  type WeeklyLedger,
} from "./types";

export interface WeeklyEvaluationOutput {
  review: ReviewResult;
  baseline: RollingBaseline;
  ruleTrace: RuleTraceStep[];
}

function buildClinicalGuidance(redTriggers: ReviewTrigger[]): string {
  const codes = new Set(redTriggers.map((t) => t.code));
  const messages: string[] = [];

  if (codes.has("RED_URGENT_MEDICAL_FLAG")) {
    messages.push(
      "Cardiorespiratory or heat red flag reported: stop all exercise immediately and seek urgent medical evaluation.",
    );
  }
  if (codes.has("RED_RIB_CHEST_WALL") || codes.has("RED_RIB_BREATHING_FLAG")) {
    messages.push(
      "Focal rib/chest-wall pain: stop all erg rowing, heavy trunk, and upper-body loading immediately. Arrange sports-medicine assessment to rule out a rib stress injury.",
    );
  }
  if (codes.has("RED_BONE_OR_GAIT_FLAG")) {
    messages.push(
      "Bone-stress, swelling, or altered-gait red flag: stop all impact running, plyometrics, and court sessions immediately and seek clinical sports-medicine assessment.",
    );
  }
  if (codes.has("RED_SEVERE_PAIN") || codes.has("RED_WORSENING_SHOULDER_OR_BACK")) {
    messages.push(
      "Severe or persistently worsening regional pain: withhold progression and stop sessions that load the symptomatic region until assessed by a qualified sports clinician.",
    );
  }

  if (messages.length === 0) {
    messages.push(
      "Red-line clinical threshold triggered: stop provoking training, log symptoms only, and seek appropriate medical assessment before resuming progression.",
    );
  }

  return messages.join(" ");
}

function buildSubstitutionWarning(symptomRegions: BodyRegion[]): string | undefined {
  if (symptomRegions.length === 0) return undefined;

  const hasLowerLimb = symptomRegions.some((r) =>
    ["ankle", "calf_achilles", "knee", "groin_adductor", "hamstring", "shin_foot_bone"].includes(r),
  );
  const hasShoulder = symptomRegions.some((r) => r === "shoulder_left" || r === "shoulder_right");
  const hasLumbar = symptomRegions.includes("lumbar");

  const parts: string[] = [
    "Substitution warning (P6): switching disciplines does not automatically unload symptomatic tissue.",
  ];
  if (hasLowerLimb) {
    parts.push(
      "Track running, squash court movement, and lower-body gym share calf/Achilles, knee, hamstring, and groin/adductor stress.",
    );
  }
  if (hasShoulder) {
    parts.push(
      "Swimming (especially paddles/sprints) and upper-body gym pushing/pulling share repetitive shoulder stress.",
    );
  }
  if (hasLumbar) {
    parts.push(
      "Erg rowing (especially >30 min bouts), track impact, and heavy lower-body hinges share lumbar load.",
    );
  }

  return parts.join(" ");
}

/**
 * Pure F1 Weekly Review Engine.
 *
 * Evaluation precedence (safety first!):
 *   1. P9 Red-Line Clinical Escalations (ALWAYS evaluated first — even during Baseline!)
 *   2. P5 Baseline Phase Gate (log-only during baseline unless Red fired)
 *   3. P6 Symptoms & Recovery Overrides (override numerically green workload)
 *   4. P4 User-Declared Hard-Session Budget & Consecutive Hard-Day Clustering
 *   5. P1/P2 Per-Discipline Spike Detectors (non-fungible)
 *   6. P3 Multi-Domain Stacking & High-Risk Combos
 *   7. Green (allow at most 1 small progression in 1 dimension)
 */
export function evaluateWeeklyReview(params: {
  athlete: Pick<
    AthleteProfile,
    "id" | "mainSport" | "trackBranch" | "phase" | "baselineWeeksCompleted" | "weeklyHardBudgetCap"
  >;
  currentLedger: WeeklyLedger;
  priorLedgers: WeeklyLedger[];
  rules: F1RulesConfig;
  nowIso?: string;
}): WeeklyEvaluationOutput {
  const { athlete, currentLedger, priorLedgers, rules } = params;
  const evaluatedAt = params.nowIso ?? new Date().toISOString();
  const baseline = computeRollingBaseline(priorLedgers, rules);

  const triggers: ReviewTrigger[] = [];
  const ruleTrace: RuleTraceStep[] = [];
  const provokerPriority: ProvokingDomain[] = [];
  const addProvoker = (d: ProvokingDomain) => {
    if (!provokerPriority.includes(d)) provokerPriority.push(d);
  };

  // =========================================================================
  // 1. P9 — RED-LINE CLINICAL ESCALATIONS (evaluated BEFORE Baseline!)
  // =========================================================================
  const redTriggers: ReviewTrigger[] = [];
  const redFlagsSet = new Set<RedFlagCode>(rules.redLines.clinicalFlags);
  const flaggedClinicalCodes: RedFlagCode[] = [];
  const ribPainMax = currentLedger.symptomsByRegion.rib_chest_wall?.maxPainAny ?? 0;

  let maxPainOverall = 0;
  let maxPainRegion: BodyRegion | null = null;
  const worseningRegions: Array<{ region: BodyRegion; maxPain: number; prior: number; weeks: number }> =
    [];

  for (const [regionKey, summary] of Object.entries(currentLedger.symptomsByRegion) as Array<
    [BodyRegion, NonNullable<WeeklyLedger["symptomsByRegion"][BodyRegion]>]
  >) {
    if (summary.maxPainAny > maxPainOverall) {
      maxPainOverall = summary.maxPainAny;
      maxPainRegion = regionKey;
    }

    for (const flag of summary.redFlagsTriggered) {
      if (redFlagsSet.has(flag)) {
        flaggedClinicalCodes.push(flag);
      }
    }

    if (
      rules.redLines.worseningShoulderOrBack.regions.includes(regionKey) &&
      summary.maxPainAny >= rules.redLines.worseningShoulderOrBack.minPain &&
      summary.consecutiveWeeksElevated >= rules.redLines.worseningShoulderOrBack.consecutiveWeeks &&
      summary.maxPainAny > summary.priorWeekMaxPain
    ) {
      worseningRegions.push({
        region: regionKey,
        maxPain: summary.maxPainAny,
        prior: summary.priorWeekMaxPain,
        weeks: summary.consecutiveWeeksElevated,
      });
    }
  }

  // 1a. Clinical red-flag checkboxes
  if (flaggedClinicalCodes.length > 0) {
    const uniqueFlags = Array.from(new Set(flaggedClinicalCodes));
    for (const flag of uniqueFlags) {
      let code = "RED_CLINICAL_FLAG";
      if (flag === "chest_pain" || flag === "fainting_dizziness" || flag === "heat_illness_symptoms") {
        code = "RED_URGENT_MEDICAL_FLAG";
      } else if (flag === "rib_pain_breathing_or_coughing") {
        code = "RED_RIB_BREATHING_FLAG";
      } else if (
        flag === "focal_bone_pain" ||
        flag === "pain_on_weight_bearing" ||
        flag === "swelling" ||
        flag === "altered_gait_or_technique"
      ) {
        code = "RED_BONE_OR_GAIT_FLAG";
      }
      redTriggers.push({
        code,
        severity: "red",
        principle: "P9",
        domain: "symptom",
        message: `Clinical red flag logged: ${RED_FLAG_LABELS[flag]}.`,
      });
    }
    ruleTrace.push({
      id: "p9_clinical_flags",
      principle: "P9",
      ruleName: "Clinical Red-Flag Checklist",
      configPath: "redLines.clinicalFlags",
      outcome: "red",
      currentSummary: `${uniqueFlags.length} clinical flag(s): ${uniqueFlags.join(", ")}`,
      thresholdSummary: "0 clinical red flags allowed",
      explanation: "Any checked clinical red flag immediately forces Red (even during baseline).",
    });
  } else {
    ruleTrace.push({
      id: "p9_clinical_flags",
      principle: "P9",
      ruleName: "Clinical Red-Flag Checklist",
      configPath: "redLines.clinicalFlags",
      outcome: "pass",
      currentSummary: "0 clinical flags checked",
      thresholdSummary: "0 clinical red flags allowed",
      explanation: "No bone-stress, swelling, gait, breathing, cardiac, or heat red flags reported.",
    });
  }

  // 1b. Focal rib / chest-wall pain
  if (ribPainMax >= rules.redLines.ribChestWallPainMin) {
    redTriggers.push({
      code: "RED_RIB_CHEST_WALL",
      severity: "red",
      principle: "P9",
      domain: "symptom",
      metric: "rib_chest_wall_pain",
      currentValue: ribPainMax,
      baselineValue: rules.redLines.ribChestWallPainMin,
      message: `Focal rib/chest-wall pain reached ${ribPainMax}/10 (threshold >= ${rules.redLines.ribChestWallPainMin}/10).`,
    });
    for (const d of rules.symptomsAndRecovery.regionToProvokerMap.rib_chest_wall) addProvoker(d);
    ruleTrace.push({
      id: "p9_rib_pain",
      principle: "P9",
      ruleName: "Rib / Chest-Wall Stress Guard",
      configPath: "redLines.ribChestWallPainMin",
      outcome: "red",
      currentSummary: `Rib/chest-wall max pain ${ribPainMax}/10`,
      thresholdSummary: `>= ${rules.redLines.ribChestWallPainMin}/10 triggers Red`,
      explanation: "Focal rib pain in rowing/multisport requires immediate unloading and clinical evaluation.",
    });
  } else {
    ruleTrace.push({
      id: "p9_rib_pain",
      principle: "P9",
      ruleName: "Rib / Chest-Wall Stress Guard",
      configPath: "redLines.ribChestWallPainMin",
      outcome: "pass",
      currentSummary: `Rib/chest-wall max pain ${ribPainMax}/10`,
      thresholdSummary: `>= ${rules.redLines.ribChestWallPainMin}/10 triggers Red`,
      explanation: "No focal rib or chest-wall pain threshold exceeded.",
    });
  }

  // 1c. Severe pain >= 7/10 in any region
  if (maxPainOverall >= rules.redLines.severePainMin && maxPainRegion) {
    redTriggers.push({
      code: "RED_SEVERE_PAIN",
      severity: "red",
      principle: "P9",
      domain: "symptom",
      metric: `${maxPainRegion}_pain`,
      currentValue: maxPainOverall,
      baselineValue: rules.redLines.severePainMin,
      message: `Severe pain (${maxPainOverall}/10) logged in ${BODY_REGION_LABELS[maxPainRegion]}.`,
    });
    for (const d of rules.symptomsAndRecovery.regionToProvokerMap[maxPainRegion]) addProvoker(d);
    ruleTrace.push({
      id: "p9_severe_pain",
      principle: "P9",
      ruleName: "Severe Regional Pain Ceiling",
      configPath: "redLines.severePainMin",
      outcome: "red",
      currentSummary: `${BODY_REGION_LABELS[maxPainRegion]} max ${maxPainOverall}/10`,
      thresholdSummary: `>= ${rules.redLines.severePainMin}/10 triggers Red`,
      explanation: "Severe regional pain overrides all training plans and requires clinical assessment.",
    });
  } else {
    ruleTrace.push({
      id: "p9_severe_pain",
      principle: "P9",
      ruleName: "Severe Regional Pain Ceiling",
      configPath: "redLines.severePainMin",
      outcome: "pass",
      currentSummary: `Peak regional pain ${maxPainOverall}/10`,
      thresholdSummary: `>= ${rules.redLines.severePainMin}/10 triggers Red`,
      explanation: "No region hit severe pain threshold.",
    });
  }

  // 1d. Worsening shoulder or lumbar pain >= 4/10 over >= 2 consecutive weeks
  if (worseningRegions.length > 0) {
    for (const w of worseningRegions) {
      redTriggers.push({
        code: "RED_WORSENING_SHOULDER_OR_BACK",
        severity: "red",
        principle: "P9",
        domain: "symptom",
        metric: `${w.region}_worsening`,
        currentValue: w.maxPain,
        baselineValue: w.prior,
        message: `${BODY_REGION_LABELS[w.region]} pain worsened from ${w.prior}/10 to ${w.maxPain}/10 across ${w.weeks} consecutive weeks.`,
      });
      for (const d of rules.symptomsAndRecovery.regionToProvokerMap[w.region]) addProvoker(d);
    }
    ruleTrace.push({
      id: "p9_worsening_shoulder_back",
      principle: "P9",
      ruleName: "Multi-Week Worsening Shoulder/Back",
      configPath: "redLines.worseningShoulderOrBack",
      outcome: "red",
      currentSummary: worseningRegions
        .map((w) => `${BODY_REGION_LABELS[w.region]} ${w.prior}->${w.maxPain}/10 (${w.weeks} wks)`)
        .join("; "),
      thresholdSummary: `>= ${rules.redLines.worseningShoulderOrBack.minPain}/10 & rising for >= ${rules.redLines.worseningShoulderOrBack.consecutiveWeeks} wks`,
      explanation: "Persistently worsening shoulder or lumbar pain escalates to Red.",
    });
  } else {
    ruleTrace.push({
      id: "p9_worsening_shoulder_back",
      principle: "P9",
      ruleName: "Multi-Week Worsening Shoulder/Back",
      configPath: "redLines.worseningShoulderOrBack",
      outcome: "pass",
      currentSummary: "No 2-week worsening shoulder/lumbar trend",
      thresholdSummary: `>= ${rules.redLines.worseningShoulderOrBack.minPain}/10 & rising for >= ${rules.redLines.worseningShoulderOrBack.consecutiveWeeks} wks`,
      explanation: "Shoulder and lumbar multi-week trajectories are not escalating.",
    });
  }

  triggers.push(...redTriggers);

  const templateId = getTemplateId(athlete.mainSport, athlete.trackBranch);
  const hardSessionCap =
    athlete.weeklyHardBudgetCap ??
    (baseline.hasSufficientData
      ? Math.max(1, Math.round(baseline.declaredHardSessions))
      : rules.hardBudget.fallbackWeeklyCap);

  // If ANY Red trigger fired, return immediately — Red ALWAYS overrides Baseline, Amber, and Green!
  if (redTriggers.length > 0) {
    return {
      baseline,
      ruleTrace,
      review: {
        weekStartDate: currentLedger.weekStartDate,
        evaluatedAt,
        rulesVersion: rules.version,
        status: "red",
        triggers,
        provokingDomains: provokerPriority,
        templateDirective: {
          templateId,
          mode: "red_recovery_only",
          hardSessionCap: 0,
          allowOneProgression: false,
          adjustments: [
            "Withhold standard and amber training templates.",
            "Stop all sessions loading the flagged region and log symptoms only.",
          ],
          clinicalGuidance: buildClinicalGuidance(redTriggers),
        },
      },
    };
  }

  // =========================================================================
  // 2. P5 — BASELINE PHASE GATE (log-only until 2-4 weeks baseline complete)
  // =========================================================================
  const isBaseline = athlete.phase === "baseline";
  if (isBaseline) {
    const completedWeeks = Math.max(athlete.baselineWeeksCompleted, priorLedgers.length);
    const baselineMsg = `Baseline observation mode (week ${Math.min(completedWeeks + 1, rules.baseline.targetWeeks)} of ${rules.baseline.minWeeks}-${rules.baseline.targetWeeks}). Log normal sessions without adding progression until personal baselines stabilize.`;
    triggers.push({
      code: "BASELINE_OBSERVE_MODE",
      severity: "info",
      principle: "P5",
      domain: "global",
      currentValue: completedWeeks,
      baselineValue: rules.baseline.minWeeks,
      message: baselineMsg,
    });
    ruleTrace.push({
      id: "p5_baseline_gate",
      principle: "P5",
      ruleName: "Baseline Before Progression Gate",
      configPath: "baseline.minWeeks",
      outcome: "info",
      currentSummary: `Phase: baseline (${completedWeeks} prior wk(s) logged)`,
      thresholdSummary: `${rules.baseline.minWeeks}-${rules.baseline.targetWeeks} log-only weeks required`,
      explanation: "No Red triggers fired. Spike progression gating stays paused while personal baseline is built.",
    });

    return {
      baseline,
      ruleTrace,
      review: {
        weekStartDate: currentLedger.weekStartDate,
        evaluatedAt,
        rulesVersion: rules.version,
        status: "baseline",
        triggers,
        provokingDomains: [],
        templateDirective: {
          templateId,
          mode: "baseline_observe",
          hardSessionCap,
          allowOneProgression: false,
          adjustments: [
            `Baseline phase (${completedWeeks}/${rules.baseline.minWeeks} minimum weeks complete): observe normal routine; hold all progression directives.`,
          ],
        },
      },
    };
  }

  ruleTrace.push({
    id: "p5_baseline_gate",
    principle: "P5",
    ruleName: "Baseline Before Progression Gate",
    configPath: "baseline.minWeeks",
    outcome: "pass",
    currentSummary: `Phase: active (${baseline.weeksIncluded} prior wk(s), ${baseline.totalSessions} sessions in window)`,
    thresholdSummary: `Active phase & >= ${rules.baseline.minWeeks} wks / ${rules.baseline.minSessionsInWindow} sessions for spike ratios`,
    explanation: baseline.hasSufficientData
      ? "Personal rolling baseline is established; full F1 detectors active."
      : "Active phase enabled with sparse prior baseline; symptom, red-line, and absolute guards remain active.",
  });

  // =========================================================================
  // 3. P6 — REGIONAL SYMPTOMS & RECOVERY (override green load metrics!)
  // =========================================================================
  const symptomAmberRegions: BodyRegion[] = [];

  for (const [regionKey, summary] of Object.entries(currentLedger.symptomsByRegion) as Array<
    [BodyRegion, NonNullable<WeeklyLedger["symptomsByRegion"][BodyRegion]>]
  >) {
    const recurringTriggered =
      summary.symptomaticSessions >= rules.symptomsAndRecovery.amberSymptomaticSessions;
    const nextMorningTriggered =
      summary.maxPainNextMorning >= rules.symptomsAndRecovery.amberNextMorningPain;

    if (recurringTriggered) {
      symptomAmberRegions.push(regionKey);
      triggers.push({
        code: "SYMPTOM_RECURRING_PAIN",
        severity: "amber",
        principle: "P6",
        domain: "symptom",
        metric: `${regionKey}_symptomatic_sessions`,
        currentValue: summary.symptomaticSessions,
        baselineValue: rules.symptomsAndRecovery.amberSymptomaticSessions,
        message: `${BODY_REGION_LABELS[regionKey]} pain >= ${rules.symptomsAndRecovery.amberPainThreshold}/10 occurred in ${summary.symptomaticSessions} sessions this week (overrides green workload).`,
      });
      for (const d of rules.symptomsAndRecovery.regionToProvokerMap[regionKey]) addProvoker(d);
    } else if (nextMorningTriggered) {
      symptomAmberRegions.push(regionKey);
      triggers.push({
        code: "SYMPTOM_NEXT_MORNING_PAIN",
        severity: "amber",
        principle: "P6",
        domain: "symptom",
        metric: `${regionKey}_next_morning_pain`,
        currentValue: summary.maxPainNextMorning,
        baselineValue: rules.symptomsAndRecovery.amberNextMorningPain,
        message: `${BODY_REGION_LABELS[regionKey]} next-morning pain reached ${summary.maxPainNextMorning}/10 (threshold >= ${rules.symptomsAndRecovery.amberNextMorningPain}/10).`,
      });
      for (const d of rules.symptomsAndRecovery.regionToProvokerMap[regionKey]) addProvoker(d);
    }
  }

  ruleTrace.push({
    id: "p6_regional_symptoms",
    principle: "P6",
    ruleName: "Regional Symptom Override",
    configPath: "symptomsAndRecovery.amberPainThreshold",
    outcome: symptomAmberRegions.length > 0 ? "amber" : "pass",
    currentSummary:
      symptomAmberRegions.length > 0
        ? `Elevated: ${symptomAmberRegions.map((r) => BODY_REGION_LABELS[r]).join(", ")}`
        : `Max regional pain ${maxPainOverall}/10, no recurring/next-AM threshold hit`,
    thresholdSummary: `>= ${rules.symptomsAndRecovery.amberSymptomaticSessions} sessions >= ${rules.symptomsAndRecovery.amberPainThreshold}/10 OR next-AM >= ${rules.symptomsAndRecovery.amberNextMorningPain}/10`,
    explanation:
      symptomAmberRegions.length > 0
        ? "Regional pain overrides numerically green load metrics and targets the plausible provoking domain."
        : "Regional symptoms are stable.",
  });

  // Unusual RPE & sleep/fatigue recovery checks
  let recoveryTriggered = false;
  if (currentLedger.global.unusualRpeSessions >= rules.symptomsAndRecovery.amberUnusualRpeSessions) {
    recoveryTriggered = true;
    triggers.push({
      code: "RECOVERY_UNUSUAL_RPE",
      severity: "amber",
      principle: "P6",
      domain: "recovery",
      metric: "unusual_rpe_sessions",
      currentValue: currentLedger.global.unusualRpeSessions,
      baselineValue: rules.symptomsAndRecovery.amberUnusualRpeSessions,
      message: `Unusually high RPE at normal output noted in ${currentLedger.global.unusualRpeSessions} sessions this week.`,
    });
  }

  const avgSleep = currentLedger.global.avgSleepHours;
  const avgFatigue = currentLedger.global.avgFatigue;
  const sleepDropTriggered =
    typeof avgSleep === "number" &&
    typeof baseline.avgSleepHours === "number" &&
    baseline.avgSleepHours - avgSleep >= rules.symptomsAndRecovery.amberSleepDropVsBaselineH;
  const lowSleepFatigueTriggered =
    typeof avgSleep === "number" &&
    avgSleep < rules.symptomsAndRecovery.amberSleepHoursFloor &&
    typeof avgFatigue === "number" &&
    avgFatigue >= 6;
  const highFatigueTriggered =
    typeof avgFatigue === "number" && avgFatigue >= rules.symptomsAndRecovery.amberFatigueMeanMin;

  if (sleepDropTriggered || lowSleepFatigueTriggered || highFatigueTriggered) {
    recoveryTriggered = true;
    triggers.push({
      code: "RECOVERY_SLEEP_FATIGUE",
      severity: "amber",
      principle: "P6",
      domain: "recovery",
      metric: "sleep_fatigue",
      currentValue: avgFatigue ?? avgSleep,
      message: `Recovery trend deteriorated (${typeof avgSleep === "number" ? `avg sleep ${avgSleep}h` : "sleep n/a"}${typeof avgFatigue === "number" ? `, fatigue ${avgFatigue}/10` : ""}).`,
    });
  }

  ruleTrace.push({
    id: "p6_recovery_context",
    principle: "P6",
    ruleName: "Unusual RPE & Sleep/Fatigue Context",
    configPath: "symptomsAndRecovery",
    outcome: recoveryTriggered ? "amber" : "pass",
    currentSummary: `Unusual RPE: ${currentLedger.global.unusualRpeSessions} | Sleep: ${avgSleep ?? "n/a"}h | Fatigue: ${avgFatigue ?? "n/a"}/10`,
    thresholdSummary: `Unusual RPE >= ${rules.symptomsAndRecovery.amberUnusualRpeSessions} OR Fatigue >= ${rules.symptomsAndRecovery.amberFatigueMeanMin}/10 OR Sleep drop >= ${rules.symptomsAndRecovery.amberSleepDropVsBaselineH}h`,
    explanation: recoveryTriggered
      ? "Internal recovery markers signal accumulating fatigue; hold progression."
      : "Perceived recovery markers are within normal range.",
  });

  // =========================================================================
  // 4. P4 — USER-DECLARED HARD-SESSION BUDGET & CLUSTERING
  // =========================================================================
  const baselineHardRounded = baseline.hasSufficientData
    ? Math.round(baseline.declaredHardSessions)
    : rules.hardBudget.fallbackWeeklyCap;
  const hardAmberCeiling = baselineHardRounded + rules.hardBudget.amberDeltaOverBaseline;
  const declaredHard = currentLedger.global.declaredHardSessions;
  const explicitCapExceeded =
    athlete.weeklyHardBudgetCap !== null && declaredHard > athlete.weeklyHardBudgetCap;

  if (declaredHard > hardAmberCeiling || explicitCapExceeded) {
    triggers.push({
      code: "HARD_BUDGET_SPIKE",
      severity: "amber",
      principle: "P4",
      domain: "global",
      metric: "declared_hard_sessions",
      currentValue: declaredHard,
      baselineValue: baselineHardRounded,
      message: `User-declared hard sessions jumped to ${declaredHard} across all sports (baseline ~${baselineHardRounded}, ceiling ${hardAmberCeiling}).`,
    });
    ruleTrace.push({
      id: "p4_hard_budget",
      principle: "P4",
      ruleName: "User-Declared Hard-Session Budget",
      configPath: "hardBudget.amberDeltaOverBaseline",
      outcome: "amber",
      currentSummary: `${declaredHard} user-tagged 'hard' sessions (baseline ${baseline.declaredHardSessions}/wk)`,
      thresholdSummary: `> ${hardAmberCeiling} hard sessions triggers Amber`,
      explanation: "Strictly counts athlete-declared 'hard' tags across all sports (never inferred from RPE).",
    });
  } else {
    ruleTrace.push({
      id: "p4_hard_budget",
      principle: "P4",
      ruleName: "User-Declared Hard-Session Budget",
      configPath: "hardBudget.amberDeltaOverBaseline",
      outcome: "pass",
      currentSummary: `${declaredHard} user-tagged 'hard' sessions (baseline ${baseline.declaredHardSessions}/wk)`,
      thresholdSummary: `<= ${hardAmberCeiling} hard sessions`,
      explanation: "Weekly user-declared hard-session count is within personal budget.",
    });
  }

  if (currentLedger.global.maxConsecutiveHardDays > rules.hardBudget.maxConsecutiveHardDays) {
    triggers.push({
      code: "HARD_CONSECUTIVE_CLUSTER",
      severity: "amber",
      principle: "P4",
      domain: "global",
      metric: "max_consecutive_hard_days",
      currentValue: currentLedger.global.maxConsecutiveHardDays,
      baselineValue: rules.hardBudget.maxConsecutiveHardDays,
      message: `${currentLedger.global.maxConsecutiveHardDays} consecutive days with user-declared 'hard' sessions (limit <= ${rules.hardBudget.maxConsecutiveHardDays} days).`,
    });
    ruleTrace.push({
      id: "p4_hard_clustering",
      principle: "P4",
      ruleName: "Consecutive Hard-Day Clustering",
      configPath: "hardBudget.maxConsecutiveHardDays",
      outcome: "amber",
      currentSummary: `${currentLedger.global.maxConsecutiveHardDays} consecutive hard days`,
      thresholdSummary: `<= ${rules.hardBudget.maxConsecutiveHardDays} consecutive days`,
      explanation: "Clustering 3+ hard sessions back-to-back across disciplines elevates overload risk.",
    });
  } else {
    ruleTrace.push({
      id: "p4_hard_clustering",
      principle: "P4",
      ruleName: "Consecutive Hard-Day Clustering",
      configPath: "hardBudget.maxConsecutiveHardDays",
      outcome: "pass",
      currentSummary: `${currentLedger.global.maxConsecutiveHardDays} consecutive hard days`,
      thresholdSummary: `<= ${rules.hardBudget.maxConsecutiveHardDays} consecutive days`,
      explanation: "Hard days are adequately spaced.",
    });
  }

  // =========================================================================
  // 5. P1 + P2 — PER-DISCIPLINE SPIKE DETECTORS (NON-FUNGIBLE)
  // =========================================================================
  const spikingDomains = new Set<ProvokingDomain>();
  let swimPaddlesJumped = false;

  // Global sRPE*duration load (P1 informational advisory only)
  if (
    baseline.hasSufficientData &&
    baseline.globalSessionLoad > 0 &&
    currentLedger.global.totalSessionLoad >
      baseline.globalSessionLoad * rules.domainSpikes.globalSessionLoad.ratioAmber
  ) {
    const ratio = Number(
      (currentLedger.global.totalSessionLoad / baseline.globalSessionLoad).toFixed(2),
    );
    triggers.push({
      code: "GLOBAL_SRPE_LOAD_INFO",
      severity: rules.domainSpikes.globalSessionLoad.advisoryOnly ? "info" : "amber",
      principle: "P1",
      domain: "global",
      metric: "global_session_load",
      currentValue: currentLedger.global.totalSessionLoad,
      baselineValue: baseline.globalSessionLoad,
      message: `Global sRPE×min load is ${ratio}x baseline (${currentLedger.global.totalSessionLoad} vs ${baseline.globalSessionLoad} AU — informational trend).`,
    });
    ruleTrace.push({
      id: "p1_global_srpe",
      principle: "P1",
      ruleName: "Global sRPE×min Load Trend",
      configPath: "domainSpikes.globalSessionLoad",
      outcome: rules.domainSpikes.globalSessionLoad.advisoryOnly ? "info" : "amber",
      currentSummary: `${currentLedger.global.totalSessionLoad} AU (${ratio}x baseline ${baseline.globalSessionLoad})`,
      thresholdSummary: `>${rules.domainSpikes.globalSessionLoad.ratioAmber}x (advisory only)`,
      explanation: "Global sRPE load tracks systemic stress for charts; regional ledgers drive tissue decisions.",
    });
  } else {
    ruleTrace.push({
      id: "p1_global_srpe",
      principle: "P1",
      ruleName: "Global sRPE×min Load Trend",
      configPath: "domainSpikes.globalSessionLoad",
      outcome: baseline.hasSufficientData ? "pass" : "skipped",
      currentSummary: `${currentLedger.global.totalSessionLoad} AU (baseline ${baseline.globalSessionLoad})`,
      thresholdSummary: `>${rules.domainSpikes.globalSessionLoad.ratioAmber}x (advisory only)`,
      explanation: baseline.hasSufficientData
        ? "Global sRPE×min load is aligned with recent baseline."
        : "Waiting for sufficient rolling baseline sessions.",
    });
  }

  if (baseline.hasSufficientData) {
    // 5a. Swim
    if (athlete.mainSport === "swim" || currentLedger.swim.sessions > 0) {
      const distDelta = currentLedger.swim.distanceM - baseline.swimDistanceM;
      const distSpiked =
        baseline.swimDistanceM > 0 &&
        currentLedger.swim.distanceM >
          baseline.swimDistanceM * rules.domainSpikes.swim.distanceRatioAmber &&
        distDelta >= rules.domainSpikes.swim.minDeltaM;
      const paddleDelta = currentLedger.swim.paddleSessions - baseline.swimPaddleSessions;
      swimPaddlesJumped = paddleDelta >= rules.domainSpikes.swim.paddleSessionsJump;

      if (distSpiked || swimPaddlesJumped) {
        spikingDomains.add("swim");
        addProvoker("swim");
        triggers.push({
          code: swimPaddlesJumped ? "SWIM_PADDLE_SPIKE" : "SWIM_VOLUME_SPIKE",
          severity: "amber",
          principle: "P2",
          domain: "swim",
          metric: swimPaddlesJumped ? "swim_paddle_sessions" : "swim_distance_m",
          currentValue: swimPaddlesJumped
            ? currentLedger.swim.paddleSessions
            : currentLedger.swim.distanceM,
          baselineValue: swimPaddlesJumped ? baseline.swimPaddleSessions : baseline.swimDistanceM,
          message: swimPaddlesJumped
            ? `Swim paddle exposure jumped to ${currentLedger.swim.paddleSessions} sessions (baseline ${baseline.swimPaddleSessions}/wk).`
            : `Weekly swim metres rose to ${currentLedger.swim.distanceM} m vs ${baseline.swimDistanceM} m baseline (+${Math.round(distDelta)} m).`,
        });
      }
      ruleTrace.push({
        id: "p2_swim_spike",
        principle: "P2",
        ruleName: "Swim Volume & Paddle Exposure",
        configPath: "domainSpikes.swim",
        outcome: distSpiked || swimPaddlesJumped ? "amber" : "pass",
        currentSummary: `${currentLedger.swim.distanceM}m (base ${baseline.swimDistanceM}m), paddles ${currentLedger.swim.paddleSessions} (base ${baseline.swimPaddleSessions})`,
        thresholdSummary: `>${rules.domainSpikes.swim.distanceRatioAmber}x & +${rules.domainSpikes.swim.minDeltaM}m OR paddles +${rules.domainSpikes.swim.paddleSessionsJump}`,
        explanation:
          distSpiked || swimPaddlesJumped
            ? "Swimming regional load spiked above personal baseline."
            : "Swimming distance and paddle usage are within personal baseline.",
      });
    }

    // 5b. Erg Rowing (erg only)
    if (athlete.mainSport === "erg" || currentLedger.erg.sessions > 0) {
      const minDelta = currentLedger.erg.minutes - baseline.ergMinutes;
      const minsSpiked =
        baseline.ergMinutes > 0 &&
        currentLedger.erg.minutes > baseline.ergMinutes * rules.domainSpikes.erg.minutesRatioAmber &&
        minDelta >= rules.domainSpikes.erg.minDeltaMin;
      const longBoutDelta = currentLedger.erg.longBoutsOver30m - baseline.ergLongBoutsOver30m;
      const longBoutSpiked = longBoutDelta >= rules.domainSpikes.erg.longBoutCountJump;

      if (minsSpiked || longBoutSpiked) {
        spikingDomains.add("erg");
        addProvoker("erg");
        triggers.push({
          code: longBoutSpiked ? "ERG_LONG_BOUT_SPIKE" : "ERG_MINUTES_SPIKE",
          severity: "amber",
          principle: "P2",
          domain: "erg",
          metric: longBoutSpiked ? "erg_long_bouts_over_30m" : "erg_minutes",
          currentValue: longBoutSpiked
            ? currentLedger.erg.longBoutsOver30m
            : currentLedger.erg.minutes,
          baselineValue: longBoutSpiked ? baseline.ergLongBoutsOver30m : baseline.ergMinutes,
          message: longBoutSpiked
            ? `Continuous erg bouts >${rules.domainSpikes.erg.longBoutThresholdMin} min jumped to ${currentLedger.erg.longBoutsOver30m} (baseline ${baseline.ergLongBoutsOver30m}/wk; max bout ${currentLedger.erg.maxContinuousBoutMin} min).`
            : `Weekly erg minutes jumped to ${currentLedger.erg.minutes} min vs ${baseline.ergMinutes} min baseline (+${Math.round(minDelta)} min).`,
        });
      }
      ruleTrace.push({
        id: "p2_erg_spike",
        principle: "P2",
        ruleName: "Erg Minutes & Continuous Bout >30m Guard",
        configPath: "domainSpikes.erg",
        outcome: minsSpiked || longBoutSpiked ? "amber" : "pass",
        currentSummary: `${currentLedger.erg.minutes}m (base ${baseline.ergMinutes}m), >30m bouts: ${currentLedger.erg.longBoutsOver30m} (base ${baseline.ergLongBoutsOver30m})`,
        thresholdSummary: `>${rules.domainSpikes.erg.minutesRatioAmber}x & +${rules.domainSpikes.erg.minDeltaMin}m OR >${rules.domainSpikes.erg.longBoutThresholdMin}m bouts +${rules.domainSpikes.erg.longBoutCountJump}`,
        explanation:
          minsSpiked || longBoutSpiked
            ? "Erg exposure exceeded personal baseline or added prolonged >30 min lumbar-loading bouts."
            : "Erg volume and continuous bout durations are within baseline.",
      });
    }

    // 5c. Squash
    if (athlete.mainSport === "squash" || currentLedger.squash.sessions > 0) {
      const minDelta = currentLedger.squash.courtMinutes - baseline.squashMinutes;
      const minsSpiked =
        baseline.squashMinutes > 0 &&
        currentLedger.squash.courtMinutes >
          baseline.squashMinutes * rules.domainSpikes.squash.minutesRatioAmber &&
        minDelta >= rules.domainSpikes.squash.minDeltaMin;
      const hdDelta = currentLedger.squash.highDensitySessions - baseline.squashHighDensitySessions;
      const hdSpiked = hdDelta >= rules.domainSpikes.squash.highDensityJump;

      if (minsSpiked || hdSpiked) {
        spikingDomains.add("squash");
        addProvoker("squash");
        triggers.push({
          code: hdSpiked ? "SQUASH_HIGH_DENSITY_SPIKE" : "SQUASH_MINUTES_SPIKE",
          severity: "amber",
          principle: "P2",
          domain: "squash",
          metric: hdSpiked ? "squash_high_density_sessions" : "squash_court_minutes",
          currentValue: hdSpiked
            ? currentLedger.squash.highDensitySessions
            : currentLedger.squash.courtMinutes,
          baselineValue: hdSpiked ? baseline.squashHighDensitySessions : baseline.squashMinutes,
          message: hdSpiked
            ? `High-density squash sessions (group/conditioning/COD>=4) jumped to ${currentLedger.squash.highDensitySessions} vs ${baseline.squashHighDensitySessions} baseline.`
            : `Squash court minutes rose to ${currentLedger.squash.courtMinutes} min vs ${baseline.squashMinutes} min baseline (+${Math.round(minDelta)} min).`,
        });
      }
      ruleTrace.push({
        id: "p2_squash_spike",
        principle: "P2",
        ruleName: "Squash Court Minutes & COD Density",
        configPath: "domainSpikes.squash",
        outcome: minsSpiked || hdSpiked ? "amber" : "pass",
        currentSummary: `${currentLedger.squash.courtMinutes}m (base ${baseline.squashMinutes}m), high-density ${currentLedger.squash.highDensitySessions} (base ${baseline.squashHighDensitySessions})`,
        thresholdSummary: `>${rules.domainSpikes.squash.minutesRatioAmber}x & +${rules.domainSpikes.squash.minDeltaMin}m OR high-density +${rules.domainSpikes.squash.highDensityJump}`,
        explanation:
          minsSpiked || hdSpiked
            ? "Court braking/change-of-direction load spiked above baseline."
            : "Squash court exposure and COD density are within baseline.",
      });
    }

    // 5d. Track (always-on impact ledger!)
    const trackMinDelta = currentLedger.track.minutes - baseline.trackMinutes;
    const trackMinsSpiked =
      baseline.trackMinutes > 0 &&
      currentLedger.track.minutes >
        baseline.trackMinutes * rules.domainSpikes.track.minutesRatioAmber &&
      trackMinDelta >= rules.domainSpikes.track.minDeltaMin;
    const currentSpeedAndHills = currentLedger.track.speedSessions + currentLedger.track.hillSessions;
    const speedJumped =
      currentSpeedAndHills - baseline.trackSpeedSessions >=
      rules.domainSpikes.track.speedSessionsJump;
    const plyoDelta = currentLedger.track.totalPlyoContacts - baseline.trackPlyoContacts;
    const plyoSpiked =
      baseline.trackPlyoContacts > 0 &&
      currentLedger.track.totalPlyoContacts >
        baseline.trackPlyoContacts * rules.domainSpikes.track.plyoContactsRatioAmber &&
      plyoDelta >= rules.domainSpikes.track.minDeltaContacts;

    if (trackMinsSpiked || speedJumped || plyoSpiked) {
      spikingDomains.add("track");
      addProvoker("track");
      const detail = plyoSpiked
        ? `Track plyo contacts jumped to ${currentLedger.track.totalPlyoContacts} vs ${baseline.trackPlyoContacts} baseline.`
        : speedJumped
          ? `Track speed/hill sessions jumped to ${currentSpeedAndHills} vs ${baseline.trackSpeedSessions} baseline.`
          : `Track run minutes jumped to ${currentLedger.track.minutes} min vs ${baseline.trackMinutes} min baseline (+${Math.round(trackMinDelta)} min).`;
      triggers.push({
        code: plyoSpiked
          ? "TRACK_PLYO_SPIKE"
          : speedJumped
            ? "TRACK_SPEED_HILL_SPIKE"
            : "TRACK_MINUTES_SPIKE",
        severity: "amber",
        principle: "P2",
        domain: "track",
        metric: plyoSpiked ? "track_plyo_contacts" : speedJumped ? "track_speed_hills" : "track_minutes",
        currentValue: plyoSpiked
          ? currentLedger.track.totalPlyoContacts
          : speedJumped
            ? currentSpeedAndHills
            : currentLedger.track.minutes,
        baselineValue: plyoSpiked
          ? baseline.trackPlyoContacts
          : speedJumped
            ? baseline.trackSpeedSessions
            : baseline.trackMinutes,
        message: detail,
      });
    }
    ruleTrace.push({
      id: "p2_track_spike",
      principle: "P2",
      ruleName: "Track Lower-Limb Impact Ledger",
      configPath: "domainSpikes.track",
      outcome: trackMinsSpiked || speedJumped || plyoSpiked ? "amber" : "pass",
      currentSummary: `${currentLedger.track.minutes}m (base ${baseline.trackMinutes}m), speed/hills ${currentSpeedAndHills} (base ${baseline.trackSpeedSessions}), plyo ${currentLedger.track.totalPlyoContacts}`,
      thresholdSummary: `>${rules.domainSpikes.track.minutesRatioAmber}x & +${rules.domainSpikes.track.minDeltaMin}m OR speed/hills +${rules.domainSpikes.track.speedSessionsJump} OR plyo >${rules.domainSpikes.track.plyoContactsRatioAmber}x & +${rules.domainSpikes.track.minDeltaContacts}`,
      explanation:
        trackMinsSpiked || speedJumped || plyoSpiked
          ? "Running/impact stress spiked independently of main-sport volume."
          : "Track impact minutes, speed/hills, and plyo contacts are within baseline.",
    });

    // 5e. Gym (lower & upper hard sets separated)
    const lowerDelta = currentLedger.gym.lowerBodyHardSets - baseline.gymLowerHardSets;
    const lowerGymSpiked =
      baseline.gymLowerHardSets > 0 &&
      currentLedger.gym.lowerBodyHardSets >
        baseline.gymLowerHardSets * rules.domainSpikes.gym.lowerHardSetsRatioAmber &&
      lowerDelta >= rules.domainSpikes.gym.minDeltaLowerSets;

    const upperDelta = currentLedger.gym.upperBodyHardSets - baseline.gymUpperHardSets;
    const upperGymSpiked =
      baseline.gymUpperHardSets > 0 &&
      currentLedger.gym.upperBodyHardSets >
        baseline.gymUpperHardSets * rules.domainSpikes.gym.upperHardSetsRatioAmber &&
      upperDelta >= rules.domainSpikes.gym.minDeltaUpperSets;

    if (lowerGymSpiked) {
      spikingDomains.add("gym_lower");
      addProvoker("gym_lower");
      triggers.push({
        code: "GYM_LOWER_SPIKE",
        severity: "amber",
        principle: "P2",
        domain: "gym_lower",
        metric: "gym_lower_hard_sets",
        currentValue: currentLedger.gym.lowerBodyHardSets,
        baselineValue: baseline.gymLowerHardSets,
        message: `Lower-body hard gym sets jumped to ${currentLedger.gym.lowerBodyHardSets} vs ${baseline.gymLowerHardSets} baseline (+${Math.round(lowerDelta)} sets).`,
      });
    }
    if (upperGymSpiked) {
      spikingDomains.add("gym_upper");
      addProvoker("gym_upper");
      triggers.push({
        code: "GYM_UPPER_SPIKE",
        severity: "amber",
        principle: "P2",
        domain: "gym_upper",
        metric: "gym_upper_hard_sets",
        currentValue: currentLedger.gym.upperBodyHardSets,
        baselineValue: baseline.gymUpperHardSets,
        message: `Upper-body hard gym sets jumped to ${currentLedger.gym.upperBodyHardSets} vs ${baseline.gymUpperHardSets} baseline (+${Math.round(upperDelta)} sets).`,
      });
    }
    ruleTrace.push({
      id: "p2_gym_spike",
      principle: "P2",
      ruleName: "Gym Regional Hard-Set Volume",
      configPath: "domainSpikes.gym",
      outcome: lowerGymSpiked || upperGymSpiked ? "amber" : "pass",
      currentSummary: `Lower ${currentLedger.gym.lowerBodyHardSets} sets (base ${baseline.gymLowerHardSets}) | Upper ${currentLedger.gym.upperBodyHardSets} sets (base ${baseline.gymUpperHardSets})`,
      thresholdSummary: `>${rules.domainSpikes.gym.lowerHardSetsRatioAmber}x & +${rules.domainSpikes.gym.minDeltaLowerSets} sets`,
      explanation:
        lowerGymSpiked || upperGymSpiked
          ? "Strength hard-set volume spiked in lower or upper body."
          : "Gym lower and upper hard sets are within baseline.",
    });
  } else {
    ruleTrace.push({
      id: "p2_domain_spikes",
      principle: "P2",
      ruleName: "Per-Discipline Spike Detectors",
      configPath: "domainSpikes",
      outcome: "skipped",
      currentSummary: `${baseline.weeksIncluded} prior wk(s), ${baseline.totalSessions} sessions`,
      thresholdSummary: `>= ${rules.baseline.minWeeks} prior wks & >= ${rules.baseline.minSessionsInWindow} sessions`,
      explanation: "Need more prior-week logs to compute personal per-discipline spike ratios.",
    });
  }

  // =========================================================================
  // 6. P3 — ONE NOVEL STRESSOR AT A TIME (STACKING DETECTOR)
  // =========================================================================
  const spikingList = Array.from(spikingDomains);
  const stackTriggered = spikingList.length >= rules.stacking.amberOnSimultaneousDomainSpikes;

  if (stackTriggered) {
    triggers.push({
      code: "STACK_2PLUS_DOMAINS",
      severity: "amber",
      principle: "P3",
      domain: "global",
      metric: "simultaneous_domain_spikes",
      currentValue: spikingList.length,
      baselineValue: rules.stacking.amberOnSimultaneousDomainSpikes,
      message: `Multiple stressors spiked simultaneously (${spikingList.join(" + ")}). Progress only one domain at a time (P3).`,
    });
  }

  // Sport-specific high-risk combos
  const comboHits: string[] = [];
  for (const combo of rules.stacking.highRiskCombos) {
    let matched = false;
    if (
      combo.id === "swim_shoulder_stack" &&
      spikingDomains.has("swim") &&
      (spikingDomains.has("gym_upper") || swimPaddlesJumped)
    ) {
      matched = true;
    } else if (
      combo.id === "erg_lumbar_stack" &&
      spikingDomains.has("erg") &&
      (spikingDomains.has("track") || spikingDomains.has("gym_lower"))
    ) {
      matched = true;
    } else if (
      combo.id === "squash_lower_limb_stack" &&
      spikingDomains.has("squash") &&
      (spikingDomains.has("track") || spikingDomains.has("gym_lower"))
    ) {
      matched = true;
    }
    if (matched) {
      comboHits.push(combo.label);
      triggers.push({
        code: `STACK_COMBO_${combo.id.toUpperCase()}`,
        severity: "amber",
        principle: "P3",
        domain: "global",
        message: `${combo.label}: ${combo.message}`,
      });
      for (const p of combo.provokers) addProvoker(p);
    }
  }

  ruleTrace.push({
    id: "p3_stacking",
    principle: "P3",
    ruleName: "Multi-Domain Stressor Stacking (P3)",
    configPath: "stacking",
    outcome: stackTriggered || comboHits.length > 0 ? "amber" : "pass",
    currentSummary:
      spikingList.length > 0
        ? `Spiking domains: ${spikingList.join(", ")}${comboHits.length > 0 ? ` | Combos: ${comboHits.join(", ")}` : ""}`
        : "0 domains spiking",
    thresholdSummary: `>= ${rules.stacking.amberOnSimultaneousDomainSpikes} simultaneous domain spikes triggers Amber`,
    explanation:
      stackTriggered || comboHits.length > 0
        ? "Simultaneous spikes across domains suppress all progressions and trim the primary provoker."
        : "No multi-domain stressor stacking detected.",
  });

  // =========================================================================
  // 7. FINAL TRAFFIC LIGHT & DIRECTIVE
  // =========================================================================
  const hasAmber = triggers.some((t) => t.severity === "amber");
  const status: ReviewStatus = hasAmber ? "amber" : "green";

  if (status === "amber") {
    // If Amber came purely from global hard budget/recovery without a specific domain, default to track first
    if (provokerPriority.length === 0) {
      addProvoker("track");
    }

    const adjustments: string[] = [
      "Drop 1 hard session slot this week (secondary/track hard slot cut first unless main sport is the sole provoker).",
      "Freeze all planned progressions across every discipline (P3).",
    ];

    for (const domain of provokerPriority.slice(0, 2)) {
      const trim = rules.amberDomainTrims[domain];
      if (trim) {
        adjustments.push(trim.action);
      }
    }

    return {
      baseline,
      ruleTrace,
      review: {
        weekStartDate: currentLedger.weekStartDate,
        evaluatedAt,
        rulesVersion: rules.version,
        status: "amber",
        triggers,
        provokingDomains: provokerPriority,
        templateDirective: {
          templateId,
          mode: "amber_reduced",
          hardSessionCap: Math.max(1, hardSessionCap - 1),
          allowOneProgression: false,
          adjustments,
          substitutionWarning: buildSubstitutionWarning(symptomAmberRegions),
        },
      },
    };
  }

  // GREEN!
  return {
    baseline,
    ruleTrace,
    review: {
      weekStartDate: currentLedger.weekStartDate,
      evaluatedAt,
      rulesVersion: rules.version,
      status: "green",
      triggers,
      provokingDomains: [],
      templateDirective: {
        templateId,
        mode: "full_template",
        hardSessionCap,
        allowOneProgression: true,
        adjustments: [
          "Symptoms stable, recovery normal, and no multi-domain spikes: publish full weekly template.",
          "P3 guardrail: permit at most ONE small progression in ONE dimension this week.",
        ],
      },
    },
  };
}
