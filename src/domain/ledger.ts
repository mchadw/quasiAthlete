import type {
  AthleteProfile,
  BodyRegion,
  F1RulesConfig,
  RedFlagCode,
  RegionWeeklySummary,
  RollingBaseline,
  SessionLog,
  WeeklyLedger,
} from "./types";

/**
 * Pure date helper: returns the ISO Monday (YYYY-MM-DD) for any YYYY-MM-DD date string in UTC.
 */
export function getIsoWeekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = dt.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  dt.setUTCDate(dt.getUTCDate() + diffToMonday);
  return dt.toISOString().slice(0, 10);
}

/**
 * Adds a signed number of days to a YYYY-MM-DD string in UTC.
 */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Computes longest consecutive calendar-day streak from a list of YYYY-MM-DD strings.
 */
export function computeMaxConsecutiveDays(dates: string[]): number {
  const unique = Array.from(new Set(dates)).sort();
  if (unique.length === 0) return 0;

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < unique.length; i++) {
    const prev = Date.parse(`${unique[i - 1]}T00:00:00Z`);
    const curr = Date.parse(`${unique[i]}T00:00:00Z`);
    const diffDays = Math.round((curr - prev) / 86_400_000);
    if (diffDays === 1) {
      currentStreak += 1;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 1;
    }
  }
  return maxStreak;
}

/**
 * Builds an empty WeeklyLedger for a given weekStartDate (ISO Monday).
 */
export function createEmptyWeeklyLedger(
  weekStartDate: string,
  athleteId: string,
  isBaselineWeek: boolean,
): WeeklyLedger {
  return {
    weekStartDate,
    athleteId,
    isBaselineWeek,
    sessionCount: 0,
    global: {
      totalMinutes: 0,
      totalSessionLoad: 0,
      declaredHardSessions: 0,
      hardSessionDates: [],
      maxConsecutiveHardDays: 0,
      unusualRpeSessions: 0,
    },
    swim: {
      sessions: 0,
      minutes: 0,
      distanceM: 0,
      paddleSessions: 0,
      sprintSetSessions: 0,
    },
    erg: {
      sessions: 0,
      minutes: 0,
      longBoutsOver30m: 0,
      maxContinuousBoutMin: 0,
      hardIntervalSessions: 0,
    },
    squash: {
      sessions: 0,
      courtMinutes: 0,
      sessionsByType: {},
      highDensitySessions: 0,
    },
    track: {
      sessions: 0,
      minutes: 0,
      distanceKm: 0,
      speedSessions: 0,
      hillSessions: 0,
      totalPlyoContacts: 0,
      hardTrackSessions: 0,
    },
    gym: {
      sessions: 0,
      sprintForceSessions: 0,
      distancePrehabSessions: 0,
      heavyLowerSessions: 0,
      lowerBodyHardSets: 0,
      upperBodyHardSets: 0,
    },
    symptomsByRegion: {},
  };
}

/**
 * Pure rollup engine (P1 Dual Ledger + P2 Non-Fungible Disciplines + P4 User-Declared Hard Budget).
 * Returns ledgers sorted chronologically (oldest week -> newest week).
 */
export function buildWeeklyLedgers(
  sessions: SessionLog[],
  athlete: Pick<AthleteProfile, "id" | "phase" | "baselineStartDate">,
  rules: F1RulesConfig,
  ensureWeekStart?: string,
): WeeklyLedger[] {
  const byWeek = new Map<string, SessionLog[]>();

  for (const s of sessions) {
    const weekStart = getIsoWeekStart(s.date);
    const list = byWeek.get(weekStart) ?? [];
    list.push(s);
    byWeek.set(weekStart, list);
  }

  if (ensureWeekStart && !byWeek.has(ensureWeekStart)) {
    byWeek.set(ensureWeekStart, []);
  }

  const weekStarts = Array.from(byWeek.keys()).sort();
  const ledgers: WeeklyLedger[] = [];

  for (let idx = 0; idx < weekStarts.length; idx++) {
    const weekStart = weekStarts[idx];
    const weekSessions = byWeek.get(weekStart) ?? [];
    const priorLedger = idx > 0 ? ledgers[idx - 1] : undefined;
    const isBaselineWeek = athlete.phase === "baseline";

    const ledger = createEmptyWeeklyLedger(weekStart, athlete.id, isBaselineWeek);
    ledger.sessionCount = weekSessions.length;

    let sleepSum = 0;
    let sleepCount = 0;
    let fatigueSum = 0;
    let fatigueCount = 0;

    for (const s of weekSessions) {
      // P1: Global informational ledger (sRPE * duration)
      ledger.global.totalMinutes += s.durationMin;
      const computedLoad =
        typeof s.sessionLoad === "number"
          ? s.sessionLoad
          : typeof s.sessionRpe === "number"
            ? s.sessionRpe * s.durationMin
            : 0;
      ledger.global.totalSessionLoad += computedLoad;

      // P4: Hard-session count is STRICTLY user-declared (never inferred from RPE or HR)
      if (s.intensityTag === "hard") {
        ledger.global.declaredHardSessions += 1;
        ledger.global.hardSessionDates.push(s.date);
      }

      if (s.rpeHigherThanExpected) {
        ledger.global.unusualRpeSessions += 1;
      }

      if (typeof s.sleepHours === "number") {
        sleepSum += s.sleepHours;
        sleepCount += 1;
      }
      if (typeof s.perceivedFatigue === "number") {
        fatigueSum += s.perceivedFatigue;
        fatigueCount += 1;
      }

      // P2: Non-fungible per-discipline rollups
      if (s.sport === "swim") {
        ledger.swim.sessions += 1;
        ledger.swim.minutes += s.durationMin;
        if (s.swim) {
          ledger.swim.distanceM += s.swim.distanceM;
          if (s.swim.usedPaddles) ledger.swim.paddleSessions += 1;
          if (s.swim.setType === "sprint") ledger.swim.sprintSetSessions += 1;
        }
      } else if (s.sport === "erg") {
        ledger.erg.sessions += 1;
        const ergMin = s.erg?.ergMinutes ?? s.durationMin;
        ledger.erg.minutes += ergMin;
        if (s.erg) {
          if (s.erg.longestContinuousBoutMin > rules.domainSpikes.erg.longBoutThresholdMin) {
            ledger.erg.longBoutsOver30m += 1;
          }
          if (s.erg.longestContinuousBoutMin > ledger.erg.maxContinuousBoutMin) {
            ledger.erg.maxContinuousBoutMin = s.erg.longestContinuousBoutMin;
          }
          if (s.erg.hasHardIntervals) {
            ledger.erg.hardIntervalSessions += 1;
          }
        }
      } else if (s.sport === "squash") {
        ledger.squash.sessions += 1;
        const courtMin = s.squash?.courtMinutes ?? s.durationMin;
        ledger.squash.courtMinutes += courtMin;
        if (s.squash) {
          ledger.squash.sessionsByType[s.squash.sessionType] =
            (ledger.squash.sessionsByType[s.squash.sessionType] ?? 0) + 1;
          const isHighDensity =
            s.squash.sessionType === "group" ||
            s.squash.sessionType === "conditioning" ||
            (typeof s.squash.codDensityRating === "number" && s.squash.codDensityRating >= 4);
          if (isHighDensity) {
            ledger.squash.highDensitySessions += 1;
          }
        }
      } else if (s.sport === "track") {
        ledger.track.sessions += 1;
        ledger.track.minutes += s.durationMin;
        if (s.intensityTag === "hard") {
          ledger.track.hardTrackSessions += 1;
        }
        if (s.track) {
          ledger.track.distanceKm += s.track.distanceKm ?? 0;
          if (s.track.speedSessionFlag || s.track.sessionType === "speed") {
            ledger.track.speedSessions += 1;
          }
          if (s.track.hillsFlag || s.track.sessionType === "hills") {
            ledger.track.hillSessions += 1;
          }
          ledger.track.totalPlyoContacts += s.track.plyoContacts ?? 0;
        }
      } else if (s.sport === "gym") {
        ledger.gym.sessions += 1;
        if (s.gym) {
          if (s.gym.modality === "sprint_force") ledger.gym.sprintForceSessions += 1;
          if (s.gym.modality === "distance_prehab") ledger.gym.distancePrehabSessions += 1;
          ledger.gym.lowerBodyHardSets += s.gym.lowerBodyHardSets;
          ledger.gym.upperBodyHardSets += s.gym.upperBodyHardSets;
          const hasHeavyLower =
            s.gym.blocks.some((b) => b.isHeavyLower) ||
            (s.gym.modality === "sprint_force" && s.gym.lowerBodyHardSets > 0);
          if (hasHeavyLower) ledger.gym.heavyLowerSessions += 1;
        }
      }

      // P1 / P6 / P9: Regional symptom rollups
      for (const sym of s.symptoms ?? []) {
        const existing: RegionWeeklySummary = ledger.symptomsByRegion[sym.region] ?? {
          maxPainDuring: 0,
          maxPainAfter: 0,
          maxPainNextMorning: 0,
          maxPainAny: 0,
          symptomaticSessions: 0,
          consecutiveWeeksElevated: 0,
          priorWeekMaxPain: 0,
          redFlagsTriggered: [],
        };

        const painNext = sym.painNextMorning ?? 0;
        const sessionMax = Math.max(sym.painDuring, sym.painAfter, painNext);

        existing.maxPainDuring = Math.max(existing.maxPainDuring, sym.painDuring);
        existing.maxPainAfter = Math.max(existing.maxPainAfter, sym.painAfter);
        existing.maxPainNextMorning = Math.max(existing.maxPainNextMorning, painNext);
        existing.maxPainAny = Math.max(existing.maxPainAny, sessionMax);

        if (sessionMax >= rules.symptomsAndRecovery.amberPainThreshold) {
          existing.symptomaticSessions += 1;
        }

        if (sym.redFlags && sym.redFlags.length > 0) {
          const set = new Set<RedFlagCode>([...existing.redFlagsTriggered, ...sym.redFlags]);
          existing.redFlagsTriggered = Array.from(set);
        }

        ledger.symptomsByRegion[sym.region] = existing;
      }
    }

    ledger.global.maxConsecutiveHardDays = computeMaxConsecutiveDays(
      ledger.global.hardSessionDates,
    );
    if (sleepCount > 0) {
      ledger.global.avgSleepHours = Number((sleepSum / sleepCount).toFixed(2));
    }
    if (fatigueCount > 0) {
      ledger.global.avgFatigue = Number((fatigueSum / fatigueCount).toFixed(2));
    }

    // Track consecutive weeks elevated & prior-week pain for P9 worsening shoulder/back detection
    const painThreshold = rules.symptomsAndRecovery.amberPainThreshold;
    for (const region of Object.keys(ledger.symptomsByRegion) as BodyRegion[]) {
      const currentRegion = ledger.symptomsByRegion[region]!;
      const priorRegion = priorLedger?.symptomsByRegion[region];
      currentRegion.priorWeekMaxPain = priorRegion?.maxPainAny ?? 0;
      if (currentRegion.maxPainAny >= painThreshold) {
        const priorConsecutive =
          priorRegion && priorRegion.maxPainAny >= painThreshold
            ? priorRegion.consecutiveWeeksElevated
            : 0;
        currentRegion.consecutiveWeeksElevated = priorConsecutive + 1;
      } else {
        currentRegion.consecutiveWeeksElevated = 0;
      }
    }

    ledgers.push(ledger);
  }

  return ledgers;
}

/**
 * Computes a personal rolling baseline from the prior N weeks (default 4).
 * Never uses fixed universal mileage caps or ACWR injury thresholds.
 */
export function computeRollingBaseline(
  priorLedgers: WeeklyLedger[],
  rules: F1RulesConfig,
): RollingBaseline {
  const window = priorLedgers.slice(-rules.baseline.rollingWindowWeeks);
  const weeksIncluded = window.length;
  const totalSessions = window.reduce((sum, w) => sum + w.sessionCount, 0);

  if (weeksIncluded === 0) {
    return {
      weeksIncluded: 0,
      totalSessions: 0,
      hasSufficientData: false,
      globalSessionLoad: 0,
      declaredHardSessions: 0,
      swimDistanceM: 0,
      swimPaddleSessions: 0,
      ergMinutes: 0,
      ergLongBoutsOver30m: 0,
      squashMinutes: 0,
      squashHighDensitySessions: 0,
      trackMinutes: 0,
      trackSpeedSessions: 0,
      trackPlyoContacts: 0,
      gymLowerHardSets: 0,
      gymUpperHardSets: 0,
    };
  }

  const avg = (getter: (w: WeeklyLedger) => number) =>
    Number((window.reduce((acc, w) => acc + getter(w), 0) / weeksIncluded).toFixed(2));

  const sleepWeeks = window.filter((w) => typeof w.global.avgSleepHours === "number");
  const avgSleepHours =
    sleepWeeks.length > 0
      ? Number(
          (
            sleepWeeks.reduce((acc, w) => acc + (w.global.avgSleepHours ?? 0), 0) /
            sleepWeeks.length
          ).toFixed(2),
        )
      : undefined;

  return {
    weeksIncluded,
    totalSessions,
    hasSufficientData:
      weeksIncluded >= rules.baseline.minWeeks &&
      totalSessions >= rules.baseline.minSessionsInWindow,
    globalSessionLoad: avg((w) => w.global.totalSessionLoad),
    declaredHardSessions: avg((w) => w.global.declaredHardSessions),
    avgSleepHours,
    swimDistanceM: avg((w) => w.swim.distanceM),
    swimPaddleSessions: avg((w) => w.swim.paddleSessions),
    ergMinutes: avg((w) => w.erg.minutes),
    ergLongBoutsOver30m: avg((w) => w.erg.longBoutsOver30m),
    squashMinutes: avg((w) => w.squash.courtMinutes),
    squashHighDensitySessions: avg((w) => w.squash.highDensitySessions),
    trackMinutes: avg((w) => w.track.minutes),
    trackSpeedSessions: avg((w) => w.track.speedSessions + w.track.hillSessions),
    trackPlyoContacts: avg((w) => w.track.totalPlyoContacts),
    gymLowerHardSets: avg((w) => w.gym.lowerBodyHardSets),
    gymUpperHardSets: avg((w) => w.gym.upperBodyHardSets),
  };
}
