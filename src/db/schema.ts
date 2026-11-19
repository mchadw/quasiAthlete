import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type {
  BodyRegion,
  CompetitionItem,
  ConsentSettings,
  ErgFields,
  GymFields,
  RegionalSymptomEntry,
  SquashFields,
  SwimFields,
  TrackFields,
} from "@/domain/types";

export interface SportPayloadJson {
  swim?: SwimFields;
  erg?: ErgFields;
  squash?: SquashFields;
  track?: TrackFields;
  gym?: GymFields;
}

export const athletes = pgTable("athletes", {
  id: text("id").primaryKey(),
  ownerSub: text("owner_sub").notNull().unique(),
  displayName: text("display_name").notNull().default("Athlete"),
  mainSport: text("main_sport").notNull(), // 'swim' | 'erg' | 'squash'
  trackBranch: text("track_branch").notNull(), // 'sprint_track' | 'mdlong_track'
  gymModality: text("gym_modality").notNull(), // 'sprint_force' | 'distance_prehab'
  phase: text("phase").notNull().default("baseline"), // 'baseline' | 'active'
  baselineStartDate: text("baseline_start_date").notNull(),
  baselineWeeksCompleted: integer("baseline_weeks_completed").notNull().default(0),
  weeklyHardBudgetCap: integer("weekly_hard_budget_cap"),
  injuryHistoryRegions: jsonb("injury_history_regions")
    .$type<BodyRegion[]>()
    .notNull()
    .default([]),
  upcomingCompetitions: jsonb("upcoming_competitions")
    .$type<CompetitionItem[]>()
    .notNull()
    .default([]),
  consentSettings: jsonb("consent_settings").$type<ConsentSettings>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessionLogs = pgTable("session_logs", {
  id: text("id").primaryKey(),
  athleteId: text("athlete_id")
    .notNull()
    .references(() => athletes.id, { onDelete: "cascade" }),
  ownerSub: text("owner_sub").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  sport: text("sport").notNull(), // 'swim' | 'erg' | 'squash' | 'track' | 'gym' | 'other'
  durationMin: integer("duration_min").notNull(),
  intensityTag: text("intensity_tag").notNull(), // P4: 'easy' | 'moderate' | 'hard'
  isKeySession: boolean("is_key_session").notNull().default(false),
  sessionRpe: real("session_rpe"),
  sessionLoad: real("session_load"),
  rpeHigherThanExpected: boolean("rpe_higher_than_expected").notNull().default(false),
  sleepHours: real("sleep_hours"),
  sleepQuality: integer("sleep_quality"),
  perceivedFatigue: real("perceived_fatigue"),
  avgHrBpm: integer("avg_hr_bpm"),
  hrZoneMinutes: jsonb("hr_zone_minutes").$type<{
    z1: number;
    z2: number;
    z3: number;
    z4: number;
    z5: number;
  } | null>(),
  symptoms: jsonb("symptoms").$type<RegionalSymptomEntry[]>().notNull().default([]),
  sportPayload: jsonb("sport_payload").$type<SportPayloadJson>().notNull().default({}),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const benchmarks = pgTable("benchmarks", {
  id: text("id").primaryKey(),
  athleteId: text("athlete_id")
    .notNull()
    .references(() => athletes.id, { onDelete: "cascade" }),
  ownerSub: text("owner_sub").notNull(),
  sport: text("sport").notNull(),
  metricLabel: text("metric_label").notNull(),
  valueText: text("value_text").notNull(),
  recordedDate: text("recorded_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const consentAuditLogs = pgTable("consent_audit_logs", {
  id: text("id").primaryKey(),
  athleteId: text("athlete_id")
    .notNull()
    .references(() => athletes.id, { onDelete: "cascade" }),
  ownerSub: text("owner_sub").notNull(),
  tier: text("tier").notNull(),
  enabled: boolean("enabled").notNull(),
  consentVersion: text("consent_version").notNull(),
  purposeVersion: text("purpose_version").notNull(),
  oauthProvider: text("oauth_provider"),
  oauthScopes: jsonb("oauth_scopes").$type<string[] | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
