import { seedSandboxForOwner } from "../src/db/queries";
import type { MainSport, TrackBranch } from "../src/domain/types";
import type { SandboxScenario } from "../src/domain/presets";

const mainSport = (process.argv[2] as MainSport) || "erg";
const trackBranch = (process.argv[3] as TrackBranch) || "sprint_track";
const scenario = (process.argv[4] as SandboxScenario) || "green";
// Matches cursor/identity.dev.ts default dev viewer sub for CLI seeding against local Postgres
const ownerSub = process.env.SEED_OWNER_SUB || "user:dev";

async function main() {
  const result = await seedSandboxForOwner({
    ownerSub,
    mainSport,
    trackBranch,
    scenario,
  });
  console.log(
    `Seeded quasiAthlete preset (${mainSport} + ${trackBranch} / ${scenario}) — status: ${result.evaluation?.review.status}, sessions: ${result.sessions.length}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
