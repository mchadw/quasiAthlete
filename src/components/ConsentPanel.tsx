"use client";

import { useState } from "react";
import { Download, ShieldCheck, Trash2, Watch } from "lucide-react";
import { CONSENT_TIER_META, type ConsentTierKey } from "@/domain/types";
import type { DashboardPayload } from "./types";

interface ConsentPanelProps {
  data: DashboardPayload;
  onToggleConsent: (
    tier: ConsentTierKey,
    enabled: boolean,
    oauthProvider?: "apple_health" | "garmin" | "oura" | "polar" | "none",
  ) => Promise<void>;
  onDeleteAllData: () => Promise<void>;
  busy: boolean;
}

export function ConsentPanel({
  data,
  onToggleConsent,
  onDeleteAllData,
  busy,
}: ConsentPanelProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { athlete, consentAudit } = data;
  if (!athlete) return null;

  const tierKeys = Object.keys(CONSENT_TIER_META) as ConsentTierKey[];

  return (
    <div className="space-y-6">
      {/* Header & Portability Actions */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900">
                Consent-First Research &amp; Wearable Tiers (R1–R5)
              </h2>
            </div>
            <p className="max-w-2xl text-xs text-slate-600">
              Every data class has an independent toggle, plain-language purpose, and an immutable
              versioned audit trail in Postgres (consent v{athlete.consent.consentVersion}). Wearables
              and research exports default <strong>OFF</strong>. Zero third-party data sale.
            </p>
            <p className="text-[11px] text-slate-500">
              Excluded from automated safety scoring: HRV, wearable &ldquo;readiness&rdquo; scores,
              and ACWR thresholds are never used to label training safe or unsafe.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/api/data/export"
              download
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              Export All Data (JSON)
            </a>
            {!confirmDelete ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete All My Data
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs">
                <span className="font-semibold text-rose-900">Permanently erase?</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await onDeleteAllData();
                    setConfirmDelete(false);
                  }}
                  className="rounded-lg bg-rose-600 px-2.5 py-1 font-bold text-white hover:bg-rose-700"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg bg-white px-2.5 py-1 font-medium text-slate-700 border border-slate-200"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Granular Tier Toggles */}
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {tierKeys.map((tierKey) => {
            const meta = CONSENT_TIER_META[tierKey];
            const state = athlete.consent.tiers[tierKey];
            const enabled = state?.enabled ?? meta.defaultEnabled;

            return (
              <div
                key={tierKey}
                className={`rounded-xl border p-4 transition ${
                  enabled
                    ? "border-emerald-200 bg-emerald-50/40"
                    : "border-slate-200 bg-slate-50/50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                        {meta.code}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{meta.title}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
                      {meta.purpose}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    disabled={busy}
                    onClick={() =>
                      onToggleConsent(
                        tierKey,
                        !enabled,
                        meta.isWearable ? (state?.oauthProvider && state.oauthProvider !== "none" ? state.oauthProvider : "garmin") : undefined,
                      )
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                      enabled ? "bg-emerald-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        enabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-2 text-[11px] text-slate-500">
                  <span>
                    Source: <strong>{meta.sourceLabel}</strong> · Purpose{" "}
                    <span className="font-mono">{meta.purposeVersion}</span>
                  </span>
                  {meta.isWearable && enabled && (
                    <div className="flex items-center gap-1.5">
                      <Watch className="h-3.5 w-3.5 text-emerald-700" />
                      <select
                        value={state?.oauthProvider ?? "garmin"}
                        disabled={busy}
                        onChange={(e) =>
                          onToggleConsent(
                            tierKey,
                            true,
                            e.target.value as "apple_health" | "garmin" | "oura" | "polar",
                          )
                        }
                        className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-800"
                      >
                        <option value="garmin">Garmin (OAuth stub)</option>
                        <option value="apple_health">Apple Health (OAuth stub)</option>
                        <option value="oura">Oura (OAuth stub)</option>
                        <option value="polar">Polar (OAuth stub)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[11px] text-slate-500">
          Right to erasure: deleting your data permanently removes your athlete profile, session
          logs, benchmarks, and consent logs from the database and halts future exports. Previously
          published, irreversibly anonymized aggregate research batches cannot be retroactively
          recalled.
        </p>
      </section>

      {/* Versioned Timestamped Consent Audit Log (Postgres) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">
          Postgres Consent Audit Log ({consentAudit.length} events)
        </h3>
        <p className="text-xs text-slate-500">
          Append-only versioned trail of every consent grant and revocation.
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-3">Timestamp (UTC)</th>
                <th className="py-2 px-3">Tier</th>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 px-3">Consent / Purpose Ver</th>
                <th className="py-2 pl-3">OAuth Provider / Scopes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {consentAudit.slice(0, 20).map((row) => (
                <tr key={row.id}>
                  <td className="py-2 pr-3 font-mono text-[11px] text-slate-600">
                    {row.createdAt.replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="py-2 px-3 font-mono font-semibold text-slate-800">{row.tier}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        row.enabled
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {row.enabled ? "GRANTED" : "REVOKED"}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                    v{row.consentVersion} / {row.purposeVersion}
                  </td>
                  <td className="py-2 pl-3 text-[11px] text-slate-600">
                    {row.oauthProvider && row.oauthProvider !== "none"
                      ? `${row.oauthProvider} (${(row.oauthScopes ?? []).join(", ")})`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
