import fs from "node:fs";
import path from "node:path";
import type { F1RulesConfig, MainSport, TrackBranch, WeeklyTemplateConfig } from "./types";

/**
 * Static allowlist of the 6 archetype templates so file paths are NEVER user-controlled.
 * Reading fresh from disk on each call lets developers edit config/*.json and see changes on refresh.
 */
const TEMPLATE_FILENAMES: Record<`${MainSport}__${TrackBranch}`, string> = {
  swim__sprint_track: "swim__sprint_track.json",
  swim__mdlong_track: "swim__mdlong_track.json",
  erg__sprint_track: "erg__sprint_track.json",
  erg__mdlong_track: "erg__mdlong_track.json",
  squash__sprint_track: "squash__sprint_track.json",
  squash__mdlong_track: "squash__mdlong_track.json",
};

export function getTemplateId(
  mainSport: MainSport,
  trackBranch: TrackBranch,
): `${MainSport}__${TrackBranch}` {
  return `${mainSport}__${trackBranch}`;
}

export function loadF1RulesConfig(): F1RulesConfig {
  const filePath = path.join(process.cwd(), "config", "rules.json");
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as F1RulesConfig;
}

export function loadWeeklyTemplate(
  mainSport: MainSport,
  trackBranch: TrackBranch,
): WeeklyTemplateConfig {
  const key = getTemplateId(mainSport, trackBranch);
  const filename = TEMPLATE_FILENAMES[key];
  const filePath = path.join(process.cwd(), "config", "templates", filename);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as WeeklyTemplateConfig;
}

export function loadAllWeeklyTemplates(): WeeklyTemplateConfig[] {
  return (Object.keys(TEMPLATE_FILENAMES) as Array<`${MainSport}__${TrackBranch}`>).map((key) => {
    const [mainSport, trackBranch] = key.split("__") as [MainSport, TrackBranch];
    return loadWeeklyTemplate(mainSport, trackBranch);
  });
}
