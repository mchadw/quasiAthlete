"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import {
  BODY_REGION_LABELS,
  MAIN_SPORT_META,
  RED_FLAG_LABELS,
  type AthleteProfile,
  type BodyRegion,
  type IntensityTag,
  type RedFlagCode,
  type RegionalSymptomEntry,
  type SessionSport,
  type SquashSessionType,
} from "@/domain/types";

interface LogSessionFormProps {
  athlete: AthleteProfile;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}

export function LogSessionForm({ athlete, onSubmit, busy }: LogSessionFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [sport, setSport] = useState<SessionSport>(athlete.mainSport);
  const [durationMin, setDurationMin] = useState(45);
  const [intensityTag, setIntensityTag] = useState<IntensityTag>("easy");
  const [isKeySession, setIsKeySession] = useState(false);
  const [sessionRpe, setSessionRpe] = useState<string>("5");
  const [rpeHigherThanExpected, setRpeHigherThanExpected] = useState(false);
  const [notes, setNotes] = useState("");

  // Optional R4/R5 consent-gated fields
  const [sleepHours, setSleepHours] = useState<string>("");
  const [perceivedFatigue, setPerceivedFatigue] = useState<string>("");
  const [avgHrBpm, setAvgHrBpm] = useState<string>("");

  // Swim fields
  const [swimDistanceM, setSwimDistanceM] = useState(2400);
  const [swimStroke, setSwimStroke] = useState<"freestyle" | "backstroke" | "breaststroke" | "butterfly" | "im" | "mixed">("freestyle");
  const [swimSetType, setSwimSetType] = useState<"technique" | "aerobic" | "threshold" | "sprint" | "mixed">("aerobic");
  const [swimPaddles, setSwimPaddles] = useState(false);
  const [swimPullBuoy, setSwimPullBuoy] = useState(false);

  // Erg fields (rowing is erg-only!)
  const [ergBoutMin, setErgBoutMin] = useState(25);
  const [ergDistanceM, setErgDistanceM] = useState(10000);
  const [ergHardIntervals, setErgHardIntervals] = useState(false);
  const [ergAvgWatts, setErgAvgWatts] = useState<string>("195");
  const [ergType, setErgType] = useState<"static" | "dynamic">("static");

  // Squash fields
  const [squashType, setSquashType] = useState<SquashSessionType>("solo_drills");
  const [squashCod, setSquashCod] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [squashHeat, setSquashHeat] = useState(false);

  // Track fields
  const [trackSessionType, setTrackSessionType] = useState<
    "speed" | "hills" | "plyo" | "intervals" | "tempo" | "easy_run" | "long_run" | "drills"
  >(athlete.trackBranch === "sprint_track" ? "speed" : "easy_run");
  const [trackDistanceKm, setTrackDistanceKm] = useState<string>(
    athlete.trackBranch === "sprint_track" ? "2.5" : "7.0",
  );
  const [trackSurface, setTrackSurface] = useState<
    "track" | "road" | "grass" | "trail" | "treadmill" | "indoor"
  >("track");
  const [trackSpeedFlag, setTrackSpeedFlag] = useState(athlete.trackBranch === "sprint_track");
  const [trackHillsFlag, setTrackHillsFlag] = useState(false);
  const [trackPlyoContacts, setTrackPlyoContacts] = useState<string>(
    athlete.trackBranch === "sprint_track" ? "40" : "0",
  );

  // Gym fields
  const [gymLowerSets, setGymLowerSets] = useState(6);
  const [gymUpperSets, setGymUpperSets] = useState(4);

  // Regional Symptoms (R2 / P6 / P9)
  const [symptoms, setSymptoms] = useState<RegionalSymptomEntry[]>([]);
  const [savedBanner, setSavedBanner] = useState(false);

  const r2Enabled = athlete.consent.tiers.R2_regionalSymptoms?.enabled ?? true;
  const r4Enabled =
    athlete.consent.tiers.R4_sleepManual?.enabled ||
    athlete.consent.tiers.R4_sleepWearable?.enabled;
  const r5Enabled =
    athlete.consent.tiers.R5_heartRateManual?.enabled ||
    athlete.consent.tiers.R5_heartRateWearable?.enabled;

  const suggestedRegions: BodyRegion[] = Array.from(
    new Set([
      ...MAIN_SPORT_META[athlete.mainSport].primaryRegions,
      "calf_achilles",
      "hamstring",
      "shin_foot_bone",
    ]),
  );

  function addSymptom(region: BodyRegion) {
    if (symptoms.some((s) => s.region === region)) return;
    setSymptoms((prev) => [
      ...prev,
      { region, painDuring: 2, painAfter: 2, painNextMorning: 0, redFlags: [] },
    ]);
  }

  function updateSymptom(idx: number, patch: Partial<RegionalSymptomEntry>) {
    setSymptoms((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function toggleRedFlag(idx: number, flag: RedFlagCode) {
    setSymptoms((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        const curr = new Set(s.redFlags ?? []);
        if (curr.has(flag)) curr.delete(flag);
        else curr.add(flag);
        return { ...s, redFlags: Array.from(curr) };
      }),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavedBanner(false);

    const payload: Record<string, unknown> = {
      date,
      sport,
      durationMin: Number(durationMin),
      intensityTag, // P4: strictly user-declared!
      isKeySession,
      sessionRpe: sessionRpe === "" ? undefined : Number(sessionRpe),
      rpeHigherThanExpected,
      sleepHours: r4Enabled && sleepHours !== "" ? Number(sleepHours) : undefined,
      perceivedFatigue:
        r4Enabled && perceivedFatigue !== "" ? Number(perceivedFatigue) : undefined,
      avgHrBpm: r5Enabled && avgHrBpm !== "" ? Number(avgHrBpm) : undefined,
      symptoms: r2Enabled ? symptoms : [],
      notes: notes.trim() || undefined,
    };

    if (sport === "swim") {
      payload.swim = {
        distanceM: Number(swimDistanceM),
        strokePrimary: swimStroke,
        setType: swimSetType,
        usedPaddles: swimPaddles,
        usedPullBuoy: swimPullBuoy,
      };
    } else if (sport === "erg") {
      payload.erg = {
        ergMinutes: Number(durationMin),
        distanceM: Number(ergDistanceM) || undefined,
        longestContinuousBoutMin: Number(ergBoutMin),
        hasHardIntervals: ergHardIntervals,
        avgWatts: ergAvgWatts === "" ? undefined : Number(ergAvgWatts),
        ergType,
      };
    } else if (sport === "squash") {
      payload.squash = {
        sessionType: squashType,
        courtMinutes: Number(durationMin),
        codDensityRating: squashCod,
        heatStrainNoted: squashHeat,
      };
    } else if (sport === "track") {
      payload.track = {
        trackBranch: athlete.trackBranch,
        sessionType: trackSessionType,
        distanceKm: trackDistanceKm === "" ? undefined : Number(trackDistanceKm),
        surface: trackSurface,
        speedSessionFlag: trackSpeedFlag,
        hillsFlag: trackHillsFlag,
        plyoContacts: trackPlyoContacts === "" ? 0 : Number(trackPlyoContacts),
      };
    } else if (sport === "gym") {
      payload.gym = {
        modality: athlete.gymModality,
        lowerBodyHardSets: Number(gymLowerSets),
        upperBodyHardSets: Number(gymUpperSets),
        blocks:
          athlete.gymModality === "sprint_force"
            ? [
                {
                  pattern: "squat",
                  sets: Math.max(1, Math.round(Number(gymLowerSets) / 2)),
                  reps: 4,
                  isHeavyLower: true,
                },
                {
                  pattern: "upper_pull",
                  sets: Math.max(1, Number(gymUpperSets)),
                  reps: 5,
                  isHeavyUpper: Number(gymUpperSets) > 0,
                },
              ]
            : [
                { pattern: "calf_soleus", sets: 3, reps: 15 },
                { pattern: "hamstring_eccentric", sets: 3, reps: 8 },
              ],
      };
    }

    await onSubmit(payload);
    setSymptoms([]);
    setNotes("");
    setSavedBanner(true);
  }

  const rpePreviewLoad =
    sessionRpe !== "" && !Number.isNaN(Number(sessionRpe))
      ? Math.round(Number(sessionRpe) * Number(durationMin))
      : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Log Training Session</h2>
          <p className="text-xs text-slate-500">
            Fields adapt to your discipline (P10). Hard-session budget is counted strictly from your
            Easy / Moderate / Hard tag below (P4).
          </p>
        </div>
        {savedBanner && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Session logged &amp; F1 review updated
          </span>
        )}
      </div>

      {/* Universal Fields */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">Discipline (P2)</label>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value as SessionSport)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value={athlete.mainSport}>
              Main: {MAIN_SPORT_META[athlete.mainSport].label}
            </option>
            <option value="track">
              Track ({athlete.trackBranch === "sprint_track" ? "Sprint 60–400m" : "Md–Long 800m–5km"})
            </option>
            <option value="gym">Gym ({athlete.gymModality})</option>
            <option value="other">Other / Mobility</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">Duration (min)</label>
          <input
            type="number"
            min={1}
            max={480}
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Session RPE (0–10, Optional)
          </label>
          <input
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={sessionRpe}
            onChange={(e) => setSessionRpe(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {rpePreviewLoad !== null && (
            <div className="mt-0.5 text-[11px] text-slate-500">
              Informational load: <strong>{rpePreviewLoad} AU</strong>
            </div>
          )}
        </div>
      </div>

      {/* P4 User-Declared Intensity Tag */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-700">
              P4 User-Declared Intensity Tag (Drives Weekly Hard Budget)
            </div>
            <p className="text-[11px] text-slate-500">
              Never auto-derived from RPE, heart rate, or wearables — you decide whether this counts
              as a hard session.
            </p>
          </div>
          <div className="flex gap-2">
            {(["easy", "moderate", "hard"] as IntensityTag[]).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setIntensityTag(tag)}
                className={`rounded-lg border px-4 py-1.5 text-xs font-bold uppercase transition ${
                  intensityTag === tag
                    ? tag === "hard"
                      ? "border-rose-600 bg-rose-600 text-white"
                      : tag === "moderate"
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-5 text-xs text-slate-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isKeySession}
              onChange={(e) => setIsKeySession(e.target.checked)}
            />
            Key quality session
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rpeHigherThanExpected}
              onChange={(e) => setRpeHigherThanExpected(e.target.checked)}
            />
            RPE felt unusually high at normal output (P6 fatigue flag)
          </label>
        </div>
      </div>

      {/* Sport-Specific Regional Exposure Fields (P1 / P2 / P10) */}
      {sport === "swim" && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wide text-indigo-900">
            Swimming Exposure Fields (P1/P2)
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Distance (metres)</label>
              <input
                type="number"
                min={0}
                max={25000}
                step={100}
                value={swimDistanceM}
                onChange={(e) => setSwimDistanceM(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Primary Stroke</label>
              <select
                value={swimStroke}
                onChange={(e) => setSwimStroke(e.target.value as typeof swimStroke)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="freestyle">Freestyle</option>
                <option value="backstroke">Backstroke</option>
                <option value="breaststroke">Breaststroke</option>
                <option value="butterfly">Butterfly</option>
                <option value="im">IM</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Set Type</label>
              <select
                value={swimSetType}
                onChange={(e) => setSwimSetType(e.target.value as typeof swimSetType)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="technique">Technique</option>
                <option value="aerobic">Aerobic</option>
                <option value="threshold">Threshold</option>
                <option value="sprint">Sprint</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-5 text-xs text-slate-800">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={swimPaddles}
                onChange={(e) => setSwimPaddles(e.target.checked)}
              />
              Used hand paddles (shoulder stack tracker)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={swimPullBuoy}
                onChange={(e) => setSwimPullBuoy(e.target.checked)}
              />
              Used pull buoy
            </label>
          </div>
        </div>
      )}

      {sport === "erg" && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wide text-indigo-900">
            Erg Rowing Exposure Fields (Erg Only — Lumbar &amp; Rib Surveillance)
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Longest Continuous Bout (min)
              </label>
              <input
                type="number"
                min={1}
                max={300}
                value={ergBoutMin}
                onChange={(e) => setErgBoutMin(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              />
              {ergBoutMin > 30 && (
                <div className="mt-0.5 text-[11px] font-semibold text-amber-700">
                  &gt;30 min continuous bout flagged for lumbar review
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Distance (m, opt)</label>
              <input
                type="number"
                min={0}
                value={ergDistanceM}
                onChange={(e) => setErgDistanceM(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Avg Watts (opt)</label>
              <input
                type="number"
                value={ergAvgWatts}
                onChange={(e) => setErgAvgWatts(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Erg Type</label>
              <select
                value={ergType}
                onChange={(e) => setErgType(e.target.value as "static" | "dynamic")}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="static">Static Erg</option>
                <option value="dynamic">Dynamic Erg</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-800">
            <input
              type="checkbox"
              checked={ergHardIntervals}
              onChange={(e) => setErgHardIntervals(e.target.checked)}
            />
            Included hard intervals / race-pace pieces
          </label>
        </div>
      )}

      {sport === "squash" && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wide text-indigo-900">
            Squash Exposure Fields (Matchplay Is Not Assumed Hardest)
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Session Type</label>
              <select
                value={squashType}
                onChange={(e) => setSquashType(e.target.value as SquashSessionType)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="solo_drills">Solo Drills</option>
                <option value="feeding">Feeding</option>
                <option value="ghosting">Ghosting</option>
                <option value="matchplay">Matchplay</option>
                <option value="group">Group Drills (often highest load)</option>
                <option value="conditioning">Court Conditioning (high COD)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Hard-Rally / COD Density (1–5)
              </label>
              <select
                value={squashCod}
                onChange={(e) => setSquashCod(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value={1}>1 — Very low (drills/walkthrough)</option>
                <option value={2}>2 — Controlled movement</option>
                <option value={3}>3 — Moderate rallies</option>
                <option value={4}>4 — High COD / braking density</option>
                <option value={5}>5 — Maximal density / intense conditioning</option>
              </select>
            </div>
            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 text-xs text-slate-800">
                <input
                  type="checkbox"
                  checked={squashHeat}
                  onChange={(e) => setSquashHeat(e.target.checked)}
                />
                Notable indoor heat / hydration strain
              </label>
            </div>
          </div>
        </div>
      )}

      {sport === "track" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wide text-emerald-900">
            Track Impact Ledger ({athlete.trackBranch === "sprint_track" ? "Sprint 60–400m" : "Md–Long 800m–5km"})
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">Session Type</label>
              <select
                value={trackSessionType}
                onChange={(e) => setTrackSessionType(e.target.value as typeof trackSessionType)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="speed">Speed / Acceleration</option>
                <option value="hills">Hills</option>
                <option value="plyo">Plyometrics</option>
                <option value="intervals">Intervals</option>
                <option value="tempo">Tempo / Threshold</option>
                <option value="easy_run">Easy Run</option>
                <option value="long_run">Long Run</option>
                <option value="drills">Drills</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Distance (km)</label>
              <input
                type="number"
                step={0.1}
                min={0}
                value={trackDistanceKm}
                onChange={(e) => setTrackDistanceKm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Surface</label>
              <select
                value={trackSurface}
                onChange={(e) => setTrackSurface(e.target.value as typeof trackSurface)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="track">Synthetic Track</option>
                <option value="road">Road</option>
                <option value="grass">Grass</option>
                <option value="trail">Trail</option>
                <option value="treadmill">Treadmill</option>
                <option value="indoor">Indoor</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Plyo Contacts</label>
              <input
                type="number"
                min={0}
                max={500}
                value={trackPlyoContacts}
                onChange={(e) => setTrackPlyoContacts(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-5 text-xs text-slate-800">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={trackSpeedFlag}
                onChange={(e) => setTrackSpeedFlag(e.target.checked)}
              />
              Speed / sprint neuromuscular session
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={trackHillsFlag}
                onChange={(e) => setTrackHillsFlag(e.target.checked)}
              />
              Includes hills
            </label>
          </div>
        </div>
      )}

      {sport === "gym" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-800">
              Gym Dose by Pattern · Modality: <span className="font-mono">{athlete.gymModality}</span>
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Lower-Body Hard Sets
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={gymLowerSets}
                onChange={(e) => setGymLowerSets(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Upper-Body Hard Sets
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={gymUpperSets}
                onChange={(e) => setGymUpperSets(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Optional Consent-Gated R4 Sleep / R5 HR */}
      {(r4Enabled || r5Enabled) && (
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-3">
          {r4Enabled && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Sleep Hours (R4)
                </label>
                <input
                  type="number"
                  step={0.25}
                  min={0}
                  max={24}
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value)}
                  placeholder="e.g. 7.5"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Perceived Fatigue (1–10, R4)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={perceivedFatigue}
                  onChange={(e) => setPerceivedFatigue(e.target.value)}
                  placeholder="e.g. 4"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                />
              </div>
            </>
          )}
          {r5Enabled && (
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Avg Session HR (bpm, R5)
              </label>
              <input
                type="number"
                min={30}
                max={230}
                value={avgHrBpm}
                onChange={(e) => setAvgHrBpm(e.target.value)}
                placeholder="e.g. 152 (never overwrites P4 tag)"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              />
            </div>
          )}
        </div>
      )}

      {/* Regional Symptoms & Red Flags (R2 / P6 / P9) */}
      {r2Enabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-800">
                Regional Symptoms &amp; P9 Red Flags (Optional — Leave Empty If Pain-Free)
              </div>
              <p className="text-[11px] text-slate-600">
                Pain &gt;= 3/10 recurring or next-morning triggers Amber (P6). Focal rib pain &gt;=
                2/10, pain &gt;= 7/10, or any clinical red flag triggers immediate Red (P9).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {suggestedRegions.map((region) => (
              <button
                key={region}
                type="button"
                onClick={() => addSymptom(region)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-900"
              >
                <Plus className="h-3 w-3" />
                {BODY_REGION_LABELS[region]}
              </button>
            ))}
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) addSymptom(e.target.value as BodyRegion);
              }}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700"
            >
              <option value="">+ Other body region...</option>
              {(Object.keys(BODY_REGION_LABELS) as BodyRegion[]).map((r) => (
                <option key={r} value={r}>
                  {BODY_REGION_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          {symptoms.map((sym, idx) => (
            <div
              key={sym.region}
              className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">
                  {BODY_REGION_LABELS[sym.region]}
                </span>
                <button
                  type="button"
                  onClick={() => setSymptoms((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-slate-400 hover:text-rose-600"
                  aria-label="Remove symptom"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 text-xs">
                <label>
                  During (0–10): <strong>{sym.painDuring}</strong>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={sym.painDuring}
                    onChange={(e) => updateSymptom(idx, { painDuring: Number(e.target.value) })}
                    className="mt-1 w-full"
                  />
                </label>
                <label>
                  After (0–10): <strong>{sym.painAfter}</strong>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={sym.painAfter}
                    onChange={(e) => updateSymptom(idx, { painAfter: Number(e.target.value) })}
                    className="mt-1 w-full"
                  />
                </label>
                <label>
                  Next Morning (0–10): <strong>{sym.painNextMorning ?? 0}</strong>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={sym.painNextMorning ?? 0}
                    onChange={(e) =>
                      updateSymptom(idx, { painNextMorning: Number(e.target.value) })
                    }
                    className="mt-1 w-full"
                  />
                </label>
              </div>
              <div className="border-t border-slate-100 pt-2">
                <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                  <AlertTriangle className="h-3 w-3" />
                  P9 Clinical Red Flags (check if present):
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {(Object.keys(RED_FLAG_LABELS) as RedFlagCode[]).map((flag) => (
                    <label
                      key={flag}
                      className="flex items-start gap-1.5 text-[11px] text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={sym.redFlags?.includes(flag) ?? false}
                        onChange={() => toggleRedFlag(idx, flag)}
                        className="mt-0.5"
                      />
                      <span>{RED_FLAG_LABELS[flag]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notes + Submit */}
      <div>
        <label className="block text-xs font-semibold text-slate-700">Session Notes</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          placeholder="Optional context (splits, surface, technique feel, heat)"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? "Saving & Evaluating..." : "Save Session & Update Weekly Review"}
        </button>
      </div>
    </form>
  );
}
