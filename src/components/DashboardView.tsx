"use client";

import { useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  Info,
  ShieldAlert,
} from "lucide-react";
import {
  BODY_REGION_LABELS,
  MAIN_SPORT_META,
  TRACK_BRANCH_META,
  type BodyRegion,
  type IntensityTag,
  type ReviewStatus,
} from "@/domain/types";
import type { DashboardPayload } from "./types";

interface DashboardViewProps {
  data: DashboardPayload;
  onOpenLogSession: () => void;
  onOpenSandbox: () => void;
}

const STATUS_STYLES: Record<
  ReviewStatus,
  {
    bg: string;
    border: string;
    badge: string;
    text: string;
    title: string;
    subtitle: string;
  }
> = {
  baseline: {
    bg: "bg-sky-50",
    border: "border-sky-200",
    badge: "bg-sky-600 text-white",
    text: "text-sky-950",
    title: "Baseline Observation Phase (P5)",
    subtitle:
      "Log your normal training for 2–4 weeks without progression directives. Clinical Red-Line checks (P9) remain active immediately.",
  },
  green: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    badge: "bg-emerald-600 text-white",
    text: "text-emerald-950",
    title: "Green — Full Weekly Template Active",
    subtitle:
      "Regional symptoms are stable and discipline loads align with personal baseline. Permit at most ONE small progression in ONE dimension (P3).",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    badge: "bg-amber-500 text-white",
    text: "text-amber-950",
    title: "Amber — Hold Progression & Trim Provoking Load",
    subtitle:
      "One or more spike, hard-budget, stacking, or regional symptom rules fired. Template drops 1 hard slot and trims provoking domain(s) by 20–30%.",
  },
  red: {
    bg: "bg-rose-50",
    border: "border-rose-300",
    badge: "bg-rose-600 text-white",
    text: "text-rose-950",
    title: "Red — Recovery Only & Clinical Assessment (P9)",
    subtitle:
      "A red-line clinical threshold fired. Standard and Amber training templates are withheld. Stop provoking load and seek appropriate assessment.",
  },
};

function tagPillClass(tag: IntensityTag) {
  if (tag === "hard") return "bg-rose-100 text-rose-800 border-rose-200";
  if (tag === "moderate") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
}

export function DashboardView({
  data,
  onOpenLogSession,
  onOpenSandbox,
}: DashboardViewProps) {
  const [traceOpen, setTraceOpen] = useState(true);

  const { athlete, currentLedger, evaluation, renderedPlan } = data;
  if (!athlete || !currentLedger || !evaluation || !renderedPlan) return null;

  const { review, baseline, ruleTrace } = evaluation;
  const style = STATUS_STYLES[review.status];
  const mainMeta = MAIN_SPORT_META[athlete.mainSport];
  const trackMeta = TRACK_BRANCH_META[athlete.trackBranch];

  const symptomEntries = Object.entries(currentLedger.symptomsByRegion) as Array<
    [BodyRegion, NonNullable<typeof currentLedger.symptomsByRegion[BodyRegion]>]
  >;

  return (
    <div className="space-y-6">
      {/* 1. TRAFFIC-LIGHT HERO BANNER */}
      <section className={`rounded-2xl border p-5 shadow-sm ${style.bg} ${style.border}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${style.badge}`}
              >
                {review.status === "green" && <CheckCircle2 className="h-3.5 w-3.5" />}
                {review.status === "amber" && <AlertTriangle className="h-3.5 w-3.5" />}
                {review.status === "red" && <AlertOctagon className="h-3.5 w-3.5" />}
                {review.status === "baseline" && <Clock className="h-3.5 w-3.5" />}
                {review.status.toUpperCase()}
              </span>
              <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
                Week of {currentLedger.weekStartDate}
              </span>
              <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
                Rules v{review.rulesVersion}
              </span>
              <span className="rounded-full bg-white/80 px-2.5 py-0.5 font-mono text-xs text-slate-700 border border-slate-200">
                {renderedPlan.templateId}
              </span>
            </div>
            <h2 className={`text-xl font-bold tracking-tight ${style.text}`}>{style.title}</h2>
            <p className="max-w-3xl text-sm text-slate-700">{style.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenLogSession}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              + Log Session
            </button>
            <button
              type="button"
              onClick={onOpenSandbox}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Switch Scenario / Sandbox
            </button>
          </div>
        </div>

        {/* Clinical Red Guidance Box (P9) */}
        {review.templateDirective.clinicalGuidance && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-300 bg-white p-4 text-sm text-rose-950">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div>
              <div className="font-bold text-rose-800">
                P9 Clinical Assessment Guidance (Stop Provoking Load)
              </div>
              <p className="mt-1 text-slate-800">{review.templateDirective.clinicalGuidance}</p>
            </div>
          </div>
        )}

        {/* P6 Substitution Warning Box */}
        {review.templateDirective.substitutionWarning && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-white p-3.5 text-xs text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <span className="font-bold">Cross-Sport Tissue Sharing Notice: </span>
              {review.templateDirective.substitutionWarning}
            </div>
          </div>
        )}

        {/* Active Triggers List */}
        {review.triggers.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {review.triggers.map((t, idx) => (
              <div
                key={`${t.code}-${idx}`}
                className={`flex items-start gap-2.5 rounded-xl border bg-white/90 px-3.5 py-2.5 text-xs ${
                  t.severity === "red"
                    ? "border-rose-200"
                    : t.severity === "amber"
                      ? "border-amber-200"
                      : "border-sky-200"
                }`}
              >
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                    t.severity === "red"
                      ? "bg-rose-100 text-rose-800"
                      : t.severity === "amber"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-sky-100 text-sky-800"
                  }`}
                >
                  {t.principle}
                </span>
                <div className="text-slate-800">
                  <span className="font-mono text-[11px] font-semibold text-slate-500">
                    {t.code}
                  </span>
                  <p className="mt-0.5">{t.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. DUAL LEDGER SUMMARY (P1 + P2 NON-FUNGIBLE DISCIPLINES + P4 HARD BUDGET) */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              F1 Dual Ledger · Non-Fungible Weekly Exposure (P1, P2, P4)
            </h3>
            <p className="text-xs text-slate-500">
              Each discipline keeps its own native exposure units — never summed into cross-sport km.
            </p>
          </div>
          <span className="text-xs text-slate-500">
            Baseline window: <strong>{baseline.weeksIncluded} prior wk(s)</strong> (
            {baseline.totalSessions} sessions)
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* Card 1: Global + P4 Hard Budget */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Global &amp; Hard Budget (P4)
              </span>
              <Flame className="h-4 w-4 text-rose-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">
                {currentLedger.global.declaredHardSessions}
              </span>
              <span className="text-xs font-medium text-slate-500">
                / {review.templateDirective.hardSessionCap} cap user-hard sessions
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Strictly from user-declared{" "}
              <span className="font-mono font-semibold">hard</span> tags (never derived from RPE).
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
              <div>
                <div className="text-slate-500">Total Minutes</div>
                <div className="font-semibold text-slate-900">
                  {currentLedger.global.totalMinutes} min
                </div>
              </div>
              <div>
                <div className="text-slate-500">Consec. Hard Days</div>
                <div className="font-semibold text-slate-900">
                  {currentLedger.global.maxConsecutiveHardDays} day(s)
                </div>
              </div>
              <div>
                <div className="text-slate-500">sRPE×min (Info)</div>
                <div className="font-semibold text-slate-900">
                  {Math.round(currentLedger.global.totalSessionLoad)} AU
                </div>
              </div>
              <div>
                <div className="text-slate-500">4-wk Base Hard</div>
                <div className="font-semibold text-slate-900">
                  {baseline.declaredHardSessions}/wk
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Main Sport Regional Ledger (P10 adaptive) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Main Sport · {mainMeta.shortLabel}
              </span>
              <Activity className="h-4 w-4 text-indigo-600" />
            </div>

            {athlete.mainSport === "swim" && (
              <>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {currentLedger.swim.distanceM.toLocaleString()}
                  </span>
                  <span className="text-xs font-medium text-slate-500">m this week</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Baseline: {Math.round(baseline.swimDistanceM).toLocaleString()} m/wk
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                  <div>
                    <div className="text-slate-500">Pool Minutes</div>
                    <div className="font-semibold text-slate-900">
                      {currentLedger.swim.minutes} min
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Paddle Sessions</div>
                    <div className="font-semibold text-slate-900">
                      {currentLedger.swim.paddleSessions} (base {baseline.swimPaddleSessions})
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Sprint Sets</div>
                    <div className="font-semibold text-slate-900">
                      {currentLedger.swim.sprintSetSessions}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Sessions</div>
                    <div className="font-semibold text-slate-900">
                      {currentLedger.swim.sessions}
                    </div>
                  </div>
                </div>
              </>
            )}

            {athlete.mainSport === "erg" && (
              <>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {currentLedger.erg.minutes}
                  </span>
                  <span className="text-xs font-medium text-slate-500">erg min (erg-only)</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Baseline: {baseline.ergMinutes} min/wk · Lumbar guard: bouts &gt;30 min
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                  <div>
                    <div className="text-slate-500">Bouts &gt;30 min</div>
                    <div
                      className={`font-semibold ${
                        currentLedger.erg.longBoutsOver30m > 0
                          ? "text-amber-700"
                          : "text-slate-900"
                      }`}
                    >
                      {currentLedger.erg.longBoutsOver30m} (base {baseline.ergLongBoutsOver30m})
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Max Cont. Bout</div>
                    <div className="font-semibold text-slate-900">
                      {currentLedger.erg.maxContinuousBoutMin} min
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Hard Intervals</div>
                    <div className="font-semibold text-slate-900">
                      {currentLedger.erg.hardIntervalSessions}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Sessions</div>
                    <div className="font-semibold text-slate-900">
                      {currentLedger.erg.sessions}
                    </div>
                  </div>
                </div>
              </>
            )}

            {athlete.mainSport === "squash" && (
              <>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {currentLedger.squash.courtMinutes}
                  </span>
                  <span className="text-xs font-medium text-slate-500">court min</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Baseline: {baseline.squashMinutes} min/wk · Matchplay not assumed hardest
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                  <div>
                    <div className="text-slate-500">High-Density COD</div>
                    <div className="font-semibold text-slate-900">
                      {currentLedger.squash.highDensitySessions} (base{" "}
                      {baseline.squashHighDensitySessions})
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Sessions</div>
                    <div className="font-semibold text-slate-900">
                      {currentLedger.squash.sessions}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-slate-500">Types Logged</div>
                    <div className="font-medium text-slate-800">
                      {Object.entries(currentLedger.squash.sessionsByType)
                        .map(([k, v]) => `${k} (${v})`)
                        .join(", ") || "None yet"}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Card 3: Track Always-On Impact Ledger */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Track · {trackMeta.shortLabel}
              </span>
              <Footprints className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">
                {currentLedger.track.minutes}
              </span>
              <span className="text-xs font-medium text-slate-500">
                run min ({currentLedger.track.distanceKm.toFixed(1)} km)
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Baseline: {baseline.trackMinutes} min/wk · Always-on lower-limb impact ledger
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
              <div>
                <div className="text-slate-500">Speed / Hills</div>
                <div className="font-semibold text-slate-900">
                  {currentLedger.track.speedSessions + currentLedger.track.hillSessions} (base{" "}
                  {baseline.trackSpeedSessions})
                </div>
              </div>
              <div>
                <div className="text-slate-500">Plyo Contacts</div>
                <div className="font-semibold text-slate-900">
                  {currentLedger.track.totalPlyoContacts} (base {baseline.trackPlyoContacts})
                </div>
              </div>
              <div>
                <div className="text-slate-500">Hard Track</div>
                <div className="font-semibold text-slate-900">
                  {currentLedger.track.hardTrackSessions}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Sessions</div>
                <div className="font-semibold text-slate-900">
                  {currentLedger.track.sessions}
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Strength + Regional Symptoms */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Gym &amp; Regional Symptoms
              </span>
              <HeartPulse className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
                {athlete.gymModality}
              </span>
              <span className="text-xs text-slate-600">
                Lower {currentLedger.gym.lowerBodyHardSets} · Upper{" "}
                {currentLedger.gym.upperBodyHardSets} hard sets
              </span>
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                This Week Regional Pain (0–10)
              </div>
              {symptomEntries.length === 0 ? (
                <p className="mt-1.5 text-xs text-emerald-700 font-medium">
                  No regional pain logged this week (0/10).
                </p>
              ) : (
                <div className="mt-1.5 space-y-1.5">
                  {symptomEntries.map(([region, sym]) => (
                    <div
                      key={region}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-medium text-slate-800">
                        {BODY_REGION_LABELS[region]}
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          sym.maxPainAny >= 7 ||
                          (region === "rib_chest_wall" && sym.maxPainAny >= 2) ||
                          sym.redFlagsTriggered.length > 0
                            ? "text-rose-700"
                            : sym.maxPainAny >= 3
                              ? "text-amber-700"
                              : "text-slate-700"
                        }`}
                      >
                        {sym.maxPainDuring}/{sym.maxPainAfter}/{sym.maxPainNextMorning}
                        <span className="ml-1 text-[10px] font-normal text-slate-500">
                          (dur/aft/AM)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. THIN F2 GATED WEEKLY TEMPLATE */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                F2 Gated Weekly Template · {renderedPlan.templateName}
              </h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                mode: {renderedPlan.mode}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">{renderedPlan.summary}</p>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs max-w-md">
            <Dumbbell className="mt-0.5 h-4 w-4 shrink-0 text-slate-800" />
            <div>
              <div className="font-bold text-slate-900">
                Gym Split: {renderedPlan.gymModule.label} ({renderedPlan.gymModule.frequency})
              </div>
              <div className="text-slate-600">
                <strong>{renderedPlan.gymModule.repRange}</strong> — {renderedPlan.gymModule.focus}
              </div>
            </div>
          </div>
        </div>

        {/* Active Adjustments / Directive Summary */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs">
          <div className="space-y-1">
            {renderedPlan.adjustments.map((adj, i) => (
              <div key={i} className="flex items-start gap-2 text-slate-700">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span>{adj}</span>
              </div>
            ))}
          </div>
          <div className="shrink-0 text-right font-mono text-[11px] text-slate-600">
            <div>
              Planned hard slots: <strong>{renderedPlan.plannedHardSlots}</strong> (cap{" "}
              {renderedPlan.hardSessionCap})
            </div>
            <div>
              P3 progression:{" "}
              <strong>{renderedPlan.allowOneProgression ? "Max 1 dimension" : "FROZEN"}</strong>
            </div>
          </div>
        </div>

        {/* 7-Day Template Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-3 font-semibold w-14">Day</th>
                <th className="py-2 px-3 font-semibold">Primary (Main-Sport Priority)</th>
                <th className="py-2 px-3 font-semibold">Secondary</th>
                <th className="py-2 px-3 font-semibold w-28">Planned Tag</th>
                <th className="py-2 pl-3 font-semibold">Focus &amp; Guardrail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {renderedPlan.days.map((d) => (
                <tr
                  key={d.day}
                  className={
                    renderedPlan.mode === "red_recovery_only"
                      ? "bg-rose-50/40"
                      : d.wasModified
                        ? "bg-amber-50/50"
                        : "hover:bg-slate-50/60"
                  }
                >
                  <td className="py-3 pr-3 font-bold text-slate-900">{d.day}</td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-900">{d.primary.title}</span>
                      {d.primary.isKey && (
                        <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                          Key
                        </span>
                      )}
                    </div>
                    {d.modificationNote && (
                      <div className="mt-1 text-[11px] font-medium text-amber-800">
                        ↳ {d.modificationNote}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-700">
                    {d.secondary ? d.secondary.title : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${tagPillClass(d.plannedTag)}`}
                      >
                        {d.plannedTag}
                      </span>
                      {d.wasModified && d.originalPlannedTag !== d.plannedTag && (
                        <span className="text-[10px] text-slate-400 line-through">
                          {d.originalPlannedTag}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pl-3 text-slate-600">{d.focus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Priority Ordering Rules Footer */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            F2 Priority &amp; Spacing Rules
          </div>
          <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-3">
            {renderedPlan.priorityRules.map((rule, idx) => (
              <li
                key={idx}
                className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 border border-slate-100"
              >
                {rule}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. VISIBLE RULE-EVALUATION TRACE (EXPLAINS WHY GREEN/AMBER/RED FIRED!) */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setTraceOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Live Rule-Evaluation Trace (from <span className="font-mono">config/rules.json</span>)
            </h3>
            <p className="text-xs text-slate-500">
              Exact order of evaluation: P9 Red Lines → P5 Baseline → P6 Symptoms → P4 Hard Budget →
              P1/P2 Domain Spikes → P3 Stacking.
            </p>
          </div>
          {traceOpen ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </button>

        {traceOpen && (
          <div className="border-t border-slate-100 px-5 pb-5 pt-3 overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-2">Rule</th>
                  <th className="py-2 px-2">Outcome</th>
                  <th className="py-2 px-2">Current vs Baseline</th>
                  <th className="py-2 px-2">Config Threshold</th>
                  <th className="py-2 pl-2">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ruleTrace.map((step) => (
                  <tr key={step.id}>
                    <td className="py-2.5 pr-2">
                      <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                        {step.principle}
                      </span>
                      <span className="font-semibold text-slate-900">{step.ruleName}</span>
                      <div className="font-mono text-[10px] text-slate-400">{step.configPath}</div>
                    </td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                          step.outcome === "red"
                            ? "bg-rose-100 text-rose-800"
                            : step.outcome === "amber"
                              ? "bg-amber-100 text-amber-800"
                              : step.outcome === "info"
                                ? "bg-sky-100 text-sky-800"
                                : step.outcome === "skipped"
                                  ? "bg-slate-100 text-slate-500"
                                  : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {step.outcome}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-slate-700">{step.currentSummary}</td>
                    <td className="py-2.5 px-2 font-mono text-[11px] text-slate-600">
                      {step.thresholdSummary}
                    </td>
                    <td className="py-2.5 pl-2 text-slate-600">{step.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
