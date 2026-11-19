"use client";

import { useState } from "react";
import { Code2, Database, FlaskConical, RefreshCw, RotateCcw } from "lucide-react";
import type { SandboxScenario } from "@/domain/presets";
import {
  MAIN_SPORT_META,
  TRACK_BRANCH_META,
  type MainSport,
  type TrackBranch,
} from "@/domain/types";
import type { DashboardPayload } from "./types";

interface DevSandboxPanelProps {
  data: DashboardPayload;
  onSeedPreset: (
    mainSport: MainSport,
    trackBranch: TrackBranch,
    scenario: SandboxScenario,
  ) => Promise<void>;
  onResetDb: () => Promise<void>;
  onTogglePhase: (phase: "baseline" | "active") => Promise<void>;
  onReloadConfig: () => Promise<void>;
  busy: boolean;
}

const SCENARIOS: Array<{
  id: SandboxScenario;
  label: string;
  desc: string;
  btnClass: string;
}> = [
  {
    id: "baseline",
    label: "Baseline (P5)",
    desc: "Week 2 of 2–4 log-only baseline; progression gated.",
    btnClass: "bg-sky-600 hover:bg-sky-700 text-white",
  },
  {
    id: "green",
    label: "Green Week",
    desc: "Stable 3-wk baseline + balanced week → full template + 1 progression.",
    btnClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  {
    id: "amber_spike",
    label: "Amber Spike + Stack (P2/P3/P4)",
    desc: "Main sport + track + gym spike + 3 consec hard days → -1 hard slot & trim.",
    btnClass: "bg-amber-500 hover:bg-amber-600 text-white",
  },
  {
    id: "amber_symptom",
    label: "Amber Symptom Override (P6)",
    desc: "Workload looks Green, but recurring regional pain overrides → Amber + P6 warning.",
    btnClass: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  {
    id: "red_clinical",
    label: "Red Clinical Escalation (P9)",
    desc: "Rib/chest-wall, severe pain, or bone-stress red flag → Recovery-Only view.",
    btnClass: "bg-rose-600 hover:bg-rose-700 text-white",
  },
];

export function DevSandboxPanel({
  data,
  onSeedPreset,
  onResetDb,
  onTogglePhase,
  onReloadConfig,
  busy,
}: DevSandboxPanelProps) {
  const [selectedSport, setSelectedSport] = useState<MainSport>(
    data.athlete?.mainSport ?? "erg",
  );
  const [selectedBranch, setSelectedBranch] = useState<TrackBranch>(
    data.athlete?.trackBranch ?? "sprint_track",
  );
  const [configTab, setConfigTab] = useState<"rules" | "template">("rules");

  return (
    <div className="space-y-6">
      {/* Seed Presets + DB Reset */}
      <section className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-2.5">
            <FlaskConical className="mt-0.5 h-5 w-5 text-indigo-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Dev Sandbox — One-Click Presets &amp; Config Inspector
              </h2>
              <p className="text-xs text-slate-600">
                Test any of the 6 archetypes across Baseline, Green, Amber Spike/Symptom, and Red
                Clinical states. Edit{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]">
                  config/rules.json
                </code>{" "}
                or{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]">
                  config/templates/*.json
                </code>{" "}
                and click Reload Config to test rule tweaks live.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-mono text-[11px] font-semibold text-slate-700">
              <Database className="h-3.5 w-3.5 text-emerald-600" />
              DB: {data.dbEngine === "postgres" ? "Postgres (DATABASE_URL)" : "Embedded Postgres (PGlite)"}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={onReloadConfig}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reload Config JSON
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onResetDb}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset DB (Empty)
            </button>
          </div>
        </div>

        {/* Archetype Pickers */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              1. Pick Main Sport
            </div>
            <div className="mt-1.5 flex gap-2">
              {(["swim", "erg", "squash"] as MainSport[]).map((sport) => (
                <button
                  key={sport}
                  type="button"
                  onClick={() => setSelectedSport(sport)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    selectedSport === sport
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {MAIN_SPORT_META[sport].shortLabel}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              2. Pick Track Branch &amp; Gym Modality
            </div>
            <div className="mt-1.5 flex gap-2">
              {(["sprint_track", "mdlong_track"] as TrackBranch[]).map((branch) => (
                <button
                  key={branch}
                  type="button"
                  onClick={() => setSelectedBranch(branch)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    selectedBranch === branch
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {TRACK_BRANCH_META[branch].shortLabel}{" "}
                  <span className="opacity-75 font-mono text-[10px]">
                    ({TRACK_BRANCH_META[branch].gymModality})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* One-Click Scenario Buttons */}
        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            3. Seed Scenario into Postgres ({selectedSport}__{selectedBranch})
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SCENARIOS.map((sc) => (
              <div
                key={sc.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900">{sc.label}</div>
                  <p className="mt-1 text-[11px] text-slate-600">{sc.desc}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSeedPreset(selectedSport, selectedBranch, sc.id)}
                  className={`mt-3 w-full rounded-lg px-2.5 py-1.5 text-xs font-bold transition disabled:opacity-50 ${sc.btnClass}`}
                >
                  {busy ? "Seeding..." : "Load Preset"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Live Phase Switcher */}
        {data.athlete && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs border border-slate-200">
            <div>
              <span className="font-semibold text-slate-800">Current Athlete Phase: </span>
              <span className="font-mono font-bold text-slate-900">{data.athlete.phase}</span>
              <span className="ml-2 text-slate-500">
                (Switch between baseline and active without deleting sessions — notice Red still
                fires during baseline!)
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || data.athlete.phase === "baseline"}
                onClick={() => onTogglePhase("baseline")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Set Baseline
              </button>
              <button
                type="button"
                disabled={busy || data.athlete.phase === "active"}
                onClick={() => onTogglePhase("active")}
                className="rounded-lg bg-slate-900 px-3 py-1 font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
              >
                Set Active
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Live Config JSON Inspector */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Active Editable Config Surface (<span className="font-mono">config/</span>)
            </h3>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setConfigTab("rules")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                configTab === "rules"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              config/rules.json
            </button>
            <button
              type="button"
              onClick={() => setConfigTab("template")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                configTab === "template"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {data.activeTemplateConfig
                ? `config/templates/${data.activeTemplateConfig.id}.json`
                : "Active Template JSON"}
            </button>
          </div>
        </div>

        <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-emerald-200">
          {configTab === "rules"
            ? JSON.stringify(data.rulesConfig, null, 2)
            : JSON.stringify(data.activeTemplateConfig ?? { note: "Complete onboarding or load a preset to view active template JSON." }, null, 2)}
        </pre>
      </section>
    </div>
  );
}
