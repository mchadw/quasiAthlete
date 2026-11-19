"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CalendarDays,
  FlaskConical,
  LayoutDashboard,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";
import type { SandboxScenario } from "@/domain/presets";
import {
  MAIN_SPORT_META,
  TRACK_BRANCH_META,
  type ConsentTierKey,
  type MainSport,
  type TrackBranch,
} from "@/domain/types";
import { ConsentPanel } from "./ConsentPanel";
import { DashboardView } from "./DashboardView";
import { DevSandboxPanel } from "./DevSandboxPanel";
import { HistoryAndBenchmarks } from "./HistoryAndBenchmarks";
import { LogSessionForm } from "./LogSessionForm";
import { OnboardingFlow } from "./OnboardingFlow";
import type { DashboardPayload } from "./types";

type ActiveTab = "dashboard" | "log" | "history" | "consent" | "sandbox";

export function QuasiAthleteApp() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ActiveTab>("dashboard");

  const fetchDashboard = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/dashboard", { cache: "no-store" });
    if (res.status === 401) {
      setError("Signed out: please sign in to view your quasiAthlete ledger.");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError("Could not load dashboard state.");
      setLoading(false);
      return;
    }
    const json = (await res.json()) as DashboardPayload;
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  async function mutate(url: string, init: RequestInit, nextTab?: ActiveTab) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(init.headers ?? {}),
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }
      if (body && "athlete" in body) {
        setData((prev) => ({
          ...(prev ?? {}),
          ...body,
          viewer: body.viewer ?? prev?.viewer,
          dbEngine: body.dbEngine ?? prev?.dbEngine,
        }));
      } else {
        await fetchDashboard();
      }
      if (nextTab) setTab(nextTab);
    } finally {
      setBusy(false);
    }
  }

  async function handleOnboard(payload: {
    displayName: string;
    mainSport: MainSport;
    trackBranch: TrackBranch;
    phase: "baseline" | "active";
    isAdultConfirmed: true;
  }) {
    await mutate("/api/profile", { method: "POST", body: JSON.stringify(payload) }, "dashboard");
  }

  async function handleSeedPreset(
    mainSport: MainSport,
    trackBranch: TrackBranch,
    scenario: SandboxScenario,
  ) {
    await mutate(
      "/api/sandbox/seed",
      { method: "POST", body: JSON.stringify({ mainSport, trackBranch, scenario }) },
      "dashboard",
    );
  }

  async function handleResetDb() {
    await mutate("/api/sandbox/reset", { method: "POST", body: JSON.stringify({}) }, "dashboard");
  }

  async function handleLogSession(payload: Record<string, unknown>) {
    await mutate("/api/sessions", { method: "POST", body: JSON.stringify(payload) }, "dashboard");
  }

  async function handleDeleteSession(id: string) {
    await mutate(`/api/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async function handleToggleConsent(
    tier: ConsentTierKey,
    enabled: boolean,
    oauthProvider?: "apple_health" | "garmin" | "oura" | "polar" | "none",
  ) {
    await mutate("/api/consent", {
      method: "POST",
      body: JSON.stringify({ tier, enabled, oauthProvider }),
    });
  }

  async function handleAddBenchmark(payload: {
    sport: MainSport | "track";
    metricLabel: string;
    valueText: string;
    recordedDate: string;
    notes?: string;
  }) {
    await mutate("/api/benchmarks", { method: "POST", body: JSON.stringify(payload) });
  }

  async function handleDeleteAllData() {
    await mutate("/api/data/delete", { method: "DELETE" });
    await fetchDashboard();
  }

  async function handleTogglePhase(phase: "baseline" | "active") {
    await mutate("/api/profile", { method: "PATCH", body: JSON.stringify({ phase }) });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading quasiAthlete F1/F2 engine...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900">quasiAthlete</h1>
        <p className="mt-2 text-sm text-rose-600">{error ?? "Unable to load application."}</p>
      </div>
    );
  }

  if (!data.athlete) {
    return (
      <div className="min-h-screen bg-slate-50">
        <OnboardingFlow
          onComplete={handleOnboard}
          onQuickSeed={handleSeedPreset}
          busy={busy}
        />
      </div>
    );
  }

  const status = data.evaluation?.review.status ?? "baseline";
  const statusDot =
    status === "green"
      ? "bg-emerald-500"
      : status === "amber"
        ? "bg-amber-500"
        : status === "red"
          ? "bg-rose-500"
          : "bg-sky-500";

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.ReactNode }> = [
    { id: "dashboard", label: "Weekly Review", icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "log", label: "Log Session", icon: <PlusCircle className="h-4 w-4" /> },
    { id: "history", label: "History & R1", icon: <CalendarDays className="h-4 w-4" /> },
    { id: "consent", label: "Consent (R1–R5)", icon: <ShieldCheck className="h-4 w-4" /> },
    { id: "sandbox", label: "Dev Sandbox", icon: <FlaskConical className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Activity className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-extrabold tracking-tight text-slate-900">
                  quasiAthlete
                </div>
                <div className="text-[11px] text-slate-500">
                  {MAIN_SPORT_META[data.athlete.mainSport].shortLabel} +{" "}
                  {TRACK_BRANCH_META[data.athlete.trackBranch].shortLabel} ·{" "}
                  <span className="font-mono">{data.athlete.gymModality}</span>
                </div>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold uppercase text-slate-800">
              <span className={`h-2 w-2 rounded-full ${statusDot}`} />
              {status}
            </span>
          </div>

          <nav className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  tab === item.id
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
            {error}
          </div>
        )}

        {tab === "dashboard" && (
          <DashboardView
            data={data}
            onOpenLogSession={() => setTab("log")}
            onOpenSandbox={() => setTab("sandbox")}
          />
        )}

        {tab === "log" && (
          <LogSessionForm athlete={data.athlete} onSubmit={handleLogSession} busy={busy} />
        )}

        {tab === "history" && (
          <HistoryAndBenchmarks
            data={data}
            onDeleteSession={handleDeleteSession}
            onAddBenchmark={handleAddBenchmark}
            busy={busy}
          />
        )}

        {tab === "consent" && (
          <ConsentPanel
            data={data}
            onToggleConsent={handleToggleConsent}
            onDeleteAllData={handleDeleteAllData}
            busy={busy}
          />
        )}

        {tab === "sandbox" && (
          <DevSandboxPanel
            data={data}
            onSeedPreset={handleSeedPreset}
            onResetDb={handleResetDb}
            onTogglePhase={handleTogglePhase}
            onReloadConfig={fetchDashboard}
            busy={busy}
          />
        )}
      </main>
    </div>
  );
}
