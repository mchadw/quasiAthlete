import type {
  AthleteProfile,
  F1RulesConfig,
  ProvokingDomain,
  RenderedDayPlan,
  RenderedWeeklyPlan,
  ReviewResult,
  TemplateSessionSlot,
  WeeklyTemplateConfig,
} from "./types";

function trimSlotForAmber(
  slot: TemplateSessionSlot,
  provokers: Set<ProvokingDomain>,
  gymModality: AthleteProfile["gymModality"],
): { slot: TemplateSessionSlot; changed: boolean; note?: string } {
  if (slot.domain === "global" || !provokers.has(slot.domain)) {
    return { slot, changed: false };
  }

  if (slot.domain === "swim") {
    return {
      slot: {
        ...slot,
        title: "Swim (Amber Trim -25%): Easy technique only (no paddles, no sprint sets)",
        isKey: false,
      },
      changed: true,
      note: "Swim trimmed 20-30%; paddles and sprint sets removed.",
    };
  }

  if (slot.domain === "erg") {
    return {
      slot: {
        ...slot,
        title: "Erg (Amber Trim -25%): Easy segmented bouts <=25 min (2-3 min standing breaks, no hard intervals)",
        isKey: false,
      },
      changed: true,
      note: "Erg trimmed 20-30%; continuous bouts capped <=25 min and hard intervals dropped.",
    };
  }

  if (slot.domain === "squash") {
    const isHighDensity = slot.modifiers?.includes("high_density_cod") || slot.isKey;
    return {
      slot: {
        ...slot,
        title: isHighDensity
          ? "Squash (Amber Swap): Low-density solo drills / controlled footwork or rest (-25%)"
          : "Squash (Amber Trim -25%): Short low-density technical feeding",
        isKey: false,
      },
      changed: true,
      note: "High-density court work swapped to low-density solo drills/rest (-20-30%).",
    };
  }

  if (slot.domain === "track") {
    return {
      slot: {
        ...slot,
        title: "Track (Amber Trim): Short easy aerobic run or full rest (no speed, hills, or plyos)",
        isKey: false,
      },
      changed: true,
      note: "Track speed, hills, and plyometrics dropped to easy run or rest.",
    };
  }

  if (slot.domain === "gym_lower") {
    return {
      slot: {
        ...slot,
        title:
          gymModality === "sprint_force"
            ? "Gym (Amber Trim): Mobility + upper-body/trunk only (heavy lower-body sets dropped)"
            : "Gym (Amber Hold): Light maintenance prehab only (hold volume, zero novel eccentrics)",
        isKey: false,
      },
      changed: true,
      note: "Lower-body gym load reduced per track-branch modality.",
    };
  }

  if (slot.domain === "gym_upper") {
    return {
      slot: {
        ...slot,
        title: "Gym (Amber Trim): Pain-free scapular control / trunk only (heavy upper sets dropped)",
        isKey: false,
      },
      changed: true,
      note: "Heavy upper-body sets dropped to protect shoulder/chest-wall recovery.",
    };
  }

  return { slot, changed: false };
}

/**
 * Pure Thin-F2 Weekly Template Gate.
 * Takes one of the 6 JSON archetype templates and gates it using the F1 ReviewResult.
 */
export function renderWeeklyTemplate(params: {
  template: WeeklyTemplateConfig;
  review: ReviewResult;
  rules: F1RulesConfig;
  athlete: Pick<AthleteProfile, "mainSport" | "trackBranch" | "gymModality">;
}): RenderedWeeklyPlan {
  const { template, review, athlete } = params;
  const { mode, hardSessionCap, allowOneProgression, adjustments, substitutionWarning, clinicalGuidance } =
    review.templateDirective;

  // RED: Recovery-only view (withhold standard & amber templates completely)
  if (mode === "red_recovery_only") {
    const recoveryDays: RenderedDayPlan[] = template.days.map((d) => ({
      day: d.day,
      primary: {
        sport: "other",
        domain: "global",
        title: "Recovery Only — Stop provoking load & log symptoms",
        isKey: false,
      },
      secondary: null,
      plannedTag: "easy",
      originalPlannedTag: d.plannedTag,
      focus: "Withhold training progression until clinical assessment clears return to load (P9).",
      wasModified: true,
      modificationNote: "Standard template withheld by P9 Red-Line clinical escalation.",
    }));

    return {
      templateId: template.id,
      templateName: template.name,
      summary: template.summary,
      mode,
      status: review.status,
      gymModule: template.gymModule,
      priorityRules: template.priorityRules,
      hardSessionCap: 0,
      plannedHardSlots: 0,
      allowOneProgression: false,
      adjustments,
      clinicalGuidance,
      days: recoveryDays,
    };
  }

  // BASELINE: Observe-only reference template (no progression directives)
  if (mode === "baseline_observe") {
    const baselineDays: RenderedDayPlan[] = template.days.map((d) => ({
      day: d.day,
      primary: d.primary,
      secondary: d.secondary,
      plannedTag: d.plannedTag,
      originalPlannedTag: d.plannedTag,
      focus: `${d.focus} (Baseline observe-only — log normal effort without adding load.)`,
      wasModified: false,
    }));

    return {
      templateId: template.id,
      templateName: template.name,
      summary: template.summary,
      mode,
      status: review.status,
      gymModule: template.gymModule,
      priorityRules: template.priorityRules,
      hardSessionCap,
      plannedHardSlots: baselineDays.filter((d) => d.plannedTag === "hard").length,
      allowOneProgression: false,
      adjustments,
      days: baselineDays,
    };
  }

  // GREEN: Full template (respecting athlete's hardSessionCap)
  if (mode === "full_template") {
    let hardKept = 0;
    const greenDays: RenderedDayPlan[] = template.days.map((d) => {
      if (d.plannedTag === "hard") {
        hardKept += 1;
        if (hardKept > hardSessionCap) {
          return {
            day: d.day,
            primary: { ...d.primary, title: `${d.primary.title} (capped to moderate per hard budget)`, isKey: false },
            secondary: d.secondary,
            plannedTag: "moderate",
            originalPlannedTag: d.plannedTag,
            focus: `${d.focus} Adjusted to match personal weekly hard cap (${hardSessionCap}).`,
            wasModified: true,
            modificationNote: `Downgraded to moderate to respect weekly hard cap (${hardSessionCap}).`,
          };
        }
      }
      return {
        day: d.day,
        primary: d.primary,
        secondary: d.secondary,
        plannedTag: d.plannedTag,
        originalPlannedTag: d.plannedTag,
        focus: d.focus,
        wasModified: false,
      };
    });

    return {
      templateId: template.id,
      templateName: template.name,
      summary: template.summary,
      mode,
      status: review.status,
      gymModule: template.gymModule,
      priorityRules: template.priorityRules,
      hardSessionCap,
      plannedHardSlots: greenDays.filter((d) => d.plannedTag === "hard").length,
      allowOneProgression,
      adjustments,
      days: greenDays,
    };
  }

  // AMBER: Drop 1 hard slot (secondary/track first unless main sport is sole provoker)
  //        + trim provoking domains by 20-30% and freeze progressions.
  const provokers = new Set<ProvokingDomain>(review.provokingDomains);
  const mainSportIsSoleProvoker =
    provokers.size === 1 && provokers.has(athlete.mainSport);

  // Pick which hard day to drop first (prefer Track-primary hard day before touching Main-Sport primary!)
  let droppedHardDay: RenderedDayPlan["day"] | null = null;
  if (!mainSportIsSoleProvoker) {
    const trackPrimaryHard = template.days.find(
      (d) => d.plannedTag === "hard" && d.primary.sport === "track",
    );
    const trackSecondaryHard = template.days.find(
      (d) => d.plannedTag === "hard" && d.secondary?.sport === "track",
    );
    if (trackPrimaryHard) droppedHardDay = trackPrimaryHard.day;
    else if (trackSecondaryHard) droppedHardDay = trackSecondaryHard.day;
  }
  if (!droppedHardDay) {
    // Drop the last hard day in the week (preserves Tue main-sport anchor)
    const hardDays = template.days.filter((d) => d.plannedTag === "hard");
    if (hardDays.length > 0) {
      droppedHardDay = hardDays[hardDays.length - 1].day;
    }
  }

  const amberDays: RenderedDayPlan[] = template.days.map((d) => {
    const notes: string[] = [];
    let primary = { ...d.primary };
    let secondary = d.secondary ? { ...d.secondary } : null;
    let plannedTag = d.plannedTag;
    let wasModified = false;

    if (d.day === droppedHardDay && plannedTag === "hard") {
      plannedTag = "easy";
      wasModified = true;
      notes.push("Hard slot dropped by Amber F1 gate (-1 hard day).");
      if (primary.sport === "track" && !mainSportIsSoleProvoker) {
        primary = {
          ...primary,
          title: "Track (Hard Slot Dropped): Short easy aerobic run or rest",
          isKey: false,
        };
      } else {
        primary = {
          ...primary,
          title: `${primary.title.split(":")[0]} (Hard Slot Dropped): Easy technical/recovery session`,
          isKey: false,
        };
      }
    }

    const primTrim = trimSlotForAmber(primary, provokers, athlete.gymModality);
    if (primTrim.changed) {
      primary = primTrim.slot;
      wasModified = true;
      if (primTrim.note) notes.push(primTrim.note);
      if (plannedTag === "hard") plannedTag = "moderate";
    }

    if (secondary) {
      const secTrim = trimSlotForAmber(secondary, provokers, athlete.gymModality);
      if (secTrim.changed) {
        secondary = secTrim.slot;
        wasModified = true;
        if (secTrim.note) notes.push(secTrim.note);
      }
    }

    return {
      day: d.day,
      primary,
      secondary,
      plannedTag,
      originalPlannedTag: d.plannedTag,
      focus: wasModified
        ? `${d.focus} [Amber: progressions frozen]`
        : d.focus,
      wasModified,
      modificationNote: notes.length > 0 ? notes.join(" ") : undefined,
    };
  });

  return {
    templateId: template.id,
    templateName: template.name,
    summary: template.summary,
    mode,
    status: review.status,
    gymModule: template.gymModule,
    priorityRules: template.priorityRules,
    hardSessionCap,
    plannedHardSlots: amberDays.filter((d) => d.plannedTag === "hard").length,
    allowOneProgression: false,
    adjustments,
    substitutionWarning,
    days: amberDays,
  };
}
