"use client";

import { useState } from "react";
import { Award, Trash2 } from "lucide-react";
import { BODY_REGION_LABELS, MAIN_SPORT_META, type MainSport } from "@/domain/types";
import type { DashboardPayload } from "./types";

interface HistoryAndBenchmarksProps {
  data: DashboardPayload;
  onDeleteSession: (id: string) => Promise<void>;
  onAddBenchmark: (payload: {
    sport: MainSport | "track";
    metricLabel: string;
    valueText: string;
    recordedDate: string;
    notes?: string;
  }) => Promise<void>;
  busy: boolean;
}

export function HistoryAndBenchmarks({
  data,
  onDeleteSession,
  onAddBenchmark,
  busy,
}: HistoryAndBenchmarksProps) {
  const { athlete, sessions, benchmarks } = data;
  const [bSport, setBSport] = useState<MainSport | "track">(athlete?.mainSport ?? "erg");
  const [bLabel, setBLabel] = useState("");
  const [bValue, setBValue] = useState("");
  const [bDate, setBDate] = useState(new Date().toISOString().slice(0, 10));

  if (!athlete) return null;
  const r1Enabled = athlete.consent.tiers.R1_benchmarks?.enabled ?? false;

  async function handleBenchmarkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bLabel.trim() || !bValue.trim()) return;
    await onAddBenchmark({
      sport: bSport,
      metricLabel: bLabel.trim(),
      valueText: bValue.trim(),
      recordedDate: bDate,
    });
    setBLabel("");
    setBValue("");
  }

  return (
    <div className="space-y-6">
      {/* Logged Sessions Table */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Logged Sessions ({sessions.length})
            </h2>
            <p className="text-xs text-slate-500">
              Chronological record across all disciplines feeding your F1 weekly ledgers.
            </p>
          </div>
        </div>

        {sessions.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-6 text-center text-xs text-slate-500">
            No sessions logged yet. Log a session or seed a preset in the Dev Sandbox.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 px-3">Sport</th>
                  <th className="py-2 px-3">Duration / RPE</th>
                  <th className="py-2 px-3">P4 Tag</th>
                  <th className="py-2 px-3">Regional Exposure</th>
                  <th className="py-2 px-3">Symptoms</th>
                  <th className="py-2 pl-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pr-3 font-mono font-medium text-slate-800">{s.date}</td>
                    <td className="py-2.5 px-3 font-semibold uppercase text-slate-900">
                      {s.sport}
                      {s.isKeySession && (
                        <span className="ml-1.5 rounded bg-slate-900 px-1.5 py-0.5 text-[9px] text-white">
                          KEY
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {s.durationMin}m
                      {typeof s.sessionRpe === "number" && (
                        <span className="ml-1.5 text-slate-500">
                          · RPE {s.sessionRpe} ({Math.round(s.sessionLoad ?? 0)} AU)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                          s.intensityTag === "hard"
                            ? "bg-rose-100 text-rose-800"
                            : s.intensityTag === "moderate"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {s.intensityTag}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {s.swim && (
                        <span>
                          {s.swim.distanceM}m {s.swim.strokePrimary} ({s.swim.setType})
                          {s.swim.usedPaddles ? " · paddles" : ""}
                        </span>
                      )}
                      {s.erg && (
                        <span>
                          {s.erg.ergMinutes}m erg · max bout {s.erg.longestContinuousBoutMin}m
                          {s.erg.hasHardIntervals ? " · intervals" : ""}
                        </span>
                      )}
                      {s.squash && (
                        <span>
                          {s.squash.sessionType} · {s.squash.courtMinutes}m
                          {s.squash.codDensityRating ? ` · COD ${s.squash.codDensityRating}/5` : ""}
                        </span>
                      )}
                      {s.track && (
                        <span>
                          {s.track.sessionType} · {s.track.distanceKm ?? 0}km ({s.track.surface})
                          {s.track.plyoContacts ? ` · ${s.track.plyoContacts} plyo` : ""}
                        </span>
                      )}
                      {s.gym && (
                        <span>
                          {s.gym.modality} · L:{s.gym.lowerBodyHardSets} U:{s.gym.upperBodyHardSets}{" "}
                          sets
                        </span>
                      )}
                      {!s.swim && !s.erg && !s.squash && !s.track && !s.gym && (
                        <span>{s.notes || "—"}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {s.symptoms.length === 0 ? (
                        <span className="text-slate-400">None</span>
                      ) : (
                        <div className="space-y-0.5">
                          {s.symptoms.map((sym, i) => (
                            <div key={i} className="text-[11px] font-medium text-amber-800">
                              {BODY_REGION_LABELS[sym.region]}: {sym.painDuring}/{sym.painAfter}/
                              {sym.painNextMorning ?? 0}
                              {sym.redFlags && sym.redFlags.length > 0 && (
                                <span className="ml-1 rounded bg-rose-600 px-1 text-[9px] text-white">
                                  RED FLAG
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onDeleteSession(s.id)}
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        title="Delete session"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* R1 Standardized Sport Benchmarks */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">
            R1 Standardized Sport Benchmarks (Optional Performance Tier)
          </h2>
        </div>
        {!r1Enabled ? (
          <p className="mt-2 rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
            R1 Benchmarks are currently <strong>OFF</strong>. Enable{" "}
            <span className="font-mono">R1_benchmarks</span> in the{" "}
            <strong>Consent &amp; Data</strong> tab to record repeatable tests (e.g. swim 100m, erg
            2k, squash ghosting, track time trial).
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <form onSubmit={handleBenchmarkSubmit} className="grid gap-3 sm:grid-cols-5">
              <select
                value={bSport}
                onChange={(e) => setBSport(e.target.value as MainSport | "track")}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
              >
                <option value={athlete.mainSport}>
                  {MAIN_SPORT_META[athlete.mainSport].label}
                </option>
                <option value="track">Track</option>
              </select>
              <input
                type="text"
                value={bLabel}
                onChange={(e) => setBLabel(e.target.value)}
                placeholder="Test (e.g. Erg 2k, 100m Free)"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs sm:col-span-2"
                required
              />
              <input
                type="text"
                value={bValue}
                onChange={(e) => setBValue(e.target.value)}
                placeholder="Result (e.g. 6:52.0)"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                required
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={bDate}
                  onChange={(e) => setBDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </form>

            {benchmarks.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {benchmarks.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{b.metricLabel}</div>
                      <div className="text-[11px] text-slate-500">
                        {b.sport.toUpperCase()} · {b.recordedDate}
                      </div>
                    </div>
                    <div className="font-mono text-sm font-bold text-indigo-700">{b.valueText}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
