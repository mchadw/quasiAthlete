import type { WeeklyEvaluationOutput } from "@/domain/evaluator";
import type {
  AthleteProfile,
  BenchmarkRecord,
  ConsentAuditRecord,
  F1RulesConfig,
  RenderedWeeklyPlan,
  SessionLog,
  WeeklyLedger,
  WeeklyTemplateConfig,
} from "@/domain/types";

export interface DashboardPayload {
  viewer?: {
    label: string;
    kind: "person" | "key";
    isSimulated: boolean;
  };
  dbEngine?: "postgres" | "pglite";
  athlete: AthleteProfile | null;
  sessions: SessionLog[];
  weeklyLedgers: WeeklyLedger[];
  currentLedger: WeeklyLedger | null;
  evaluation: WeeklyEvaluationOutput | null;
  renderedPlan: RenderedWeeklyPlan | null;
  benchmarks: BenchmarkRecord[];
  consentAudit: ConsentAuditRecord[];
  rulesConfig: F1RulesConfig;
  activeTemplateConfig: WeeklyTemplateConfig | null;
}
