"use client";

import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  Dumbbell,
  FlaskConical,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  MAIN_SPORT_META,
  TRACK_BRANCH_META,
  type MainSport,
  type TrackBranch,
} from "@/domain/types";
import type { SandboxScenario } from "@/domain/presets";

interface OnboardingFlowProps {
  onComplete: (payload: {
    displayName: string;
    mainSport: MainSport;
    trackBranch: TrackBranch;
    phase: "baseline" | "active";
    isAdultConfirmed: true;
  }) => Promise<void>;
  onQuickSeed: (
    mainSport: MainSport,
    trackBranch: TrackBranch,
    scenario: SandboxScenario,
  ) => Promise<void>;
  busy: boolean;
}

export function OnboardingFlow({ onComplete, onQuickSeed, busy }: OnboardingFlowProps) {
  const [displayName, setDisplayName] = useState("Athlete");
  const [mainSport, setMainSport] = useState<MainSport>("erg");
  const [trackBranch, setTrackBranch] = useState<TrackBranch>("sprint_track");
  const [phase, setPhase] = useState<"baseline" | "active">("baseline");
  const [isAdultConfirmed, setIsAdultConfirmed] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedTrack = TRACK_BRANCH_META[trackBranch];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdultConfirmed) {
      setError("Please confirm you are 18+ (minors are out of scope in v1).");
      return;
    }
    setError(null);
    await onComplete({
      displayName: displayName.trim() || "Athlete",
      mainSport,
      trackBranch,
      phase,
      isAdultConfirmed: true,
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
          <Activity className="h-3.5 w-3.5 text-emerald-400" />
          quasiAthlete · v1 Proof of Concept
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
          Set Up Your Multisport Training Archetype
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
          Pick your primary sport and track branch. This selects your F1 regional monitoring
          ledger, your weekly F2 template, and your strength modality (P10).
        </p>
      </div>

      {/* Quick Dev Sandbox jump-in */}
      <div className="mb-8 rounded-xl border border-indigo-200 bg-indigo-50/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
            <div>
              <p className="text-sm font-semibold text-indigo-950">
                Want to explore immediately with realistic multi-week data?
              </p>
              <p className="text-xs text-indigo-800">
                Load a pre-seeded Dev Sandbox scenario right now (or configure manually below).
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onQuickSeed("erg", "sprint_track", "green")}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Erg + Sprint (Green)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onQuickSeed("swim", "mdlong_track", "amber_spike")}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              Swim + Md-Long (Amber Spike)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onQuickSeed("squash", "sprint_track", "amber_symptom")}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Squash + Sprint (Amber Symptom)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onQuickSeed("erg", "mdlong_track", "red_clinical")}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              Erg + Md-Long (Red Rib)
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Athlete Label
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
            className="mt-1.5 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            placeholder="e.g. Chaddy Daddy"
          />
        </div>

        {/* Step 1: Main Sport */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            1. Main Sport (Primary Adaptation Target)
          </label>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {(["swim", "erg", "squash"] as MainSport[]).map((sport) => {
              const meta = MAIN_SPORT_META[sport];
              const active = mainSport === sport;
              return (
                <button
                  key={sport}
                  type="button"
                  onClick={() => setMainSport(sport)}
                  className={`rounded-xl border p-4 text-left transition ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border-slate-200 bg-slate-50/70 text-slate-800 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{meta.label}</span>
                    {active && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                  </div>
                  <p className={`mt-1.5 text-xs ${active ? "text-slate-300" : "text-slate-600"}`}>
                    {meta.regionalFocus}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Track Branch (drives stark gym split!) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            2. Always-On Track Branch (Selects Impact Ledger & Gym Modality)
          </label>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {(["sprint_track", "mdlong_track"] as TrackBranch[]).map((branch) => {
              const meta = TRACK_BRANCH_META[branch];
              const active = trackBranch === branch;
              return (
                <button
                  key={branch}
                  type="button"
                  onClick={() => setTrackBranch(branch)}
                  className={`rounded-xl border p-4 text-left transition ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border-slate-200 bg-slate-50/70 text-slate-800 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{meta.label}</span>
                    {active && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                  </div>
                  <p className={`mt-1 text-xs ${active ? "text-slate-300" : "text-slate-600"}`}>
                    <strong>Track ledger:</strong> {meta.impactFocus}
                  </p>
                  <div
                    className={`mt-2.5 flex items-start gap-2 rounded-lg p-2.5 text-xs ${
                      active ? "bg-slate-800 text-emerald-200" : "bg-white text-slate-700 border border-slate-200"
                    }`}
                  >
                    <Dumbbell className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div>
                      <div className="font-semibold">{meta.gymLabel}</div>
                      <div className="mt-0.5 opacity-90">{meta.gymSummary}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3: Phase & Consent Defaults */}
        <div className="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              3. Starting Phase (P5)
            </label>
            <div className="mt-2 space-y-2">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                <input
                  type="radio"
                  name="phase"
                  checked={phase === "baseline"}
                  onChange={() => setPhase("baseline")}
                  className="mt-0.5"
                />
                <div className="text-xs">
                  <div className="font-semibold text-slate-900">
                    Baseline Phase (2–4 wks log-only, Recommended)
                  </div>
                  <div className="text-slate-600">
                    Collects personal baselines before activating progression directives. Red-line
                    clinical checks stay active immediately.
                  </div>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                <input
                  type="radio"
                  name="phase"
                  checked={phase === "active"}
                  onChange={() => setPhase("active")}
                  className="mt-0.5"
                />
                <div className="text-xs">
                  <div className="font-semibold text-slate-900">
                    Active Mode (Green / Amber / Red Gating)
                  </div>
                  <div className="text-slate-600">
                    Skip baseline hold so you can test Green/Amber/Red weekly gating immediately.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Consent-First Defaults (R1–R5)
            </div>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              <li>• Core regional symptom monitoring (R2): <strong>ON</strong> (powers P6 &amp; P9)</li>
              <li>• Wearables (R4/R5 OAuth): <strong>OFF by default</strong></li>
              <li>• Anonymized research exports (R2/R3): <strong>OFF by default</strong></li>
              <li>• Full JSON export &amp; permanent delete available anytime</li>
            </ul>
            <label className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-800">
              <input
                type="checkbox"
                checked={isAdultConfirmed}
                onChange={(e) => setIsAdultConfirmed(e.target.checked)}
              />
              I confirm I am an adult (18+).
            </label>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="text-xs text-slate-600">
            Selected archetype:{" "}
            <span className="font-mono font-semibold text-slate-900">
              {mainSport}__{trackBranch}
            </span>{" "}
            · Gym:{" "}
            <span className="font-mono font-semibold text-slate-900">
              {selectedTrack.gymModality}
            </span>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4 text-emerald-400" />
            {busy ? "Creating Profile..." : "Start Training Ledger"}
          </button>
        </div>
      </form>
    </div>
  );
}
