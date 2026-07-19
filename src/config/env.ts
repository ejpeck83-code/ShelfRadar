import { z } from "zod";
import { isPublicHttpUrl } from "@/domain/adapters";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");
const adapterMode = z.enum(["fixture", "unavailable", "provider"]);
const necaAdapterMode = z.enum(["fixture", "unavailable", "provider", "public"]);
const crowdAdapterMode = z.enum(["fixture", "unavailable", "oauth", "rss"]);
const productionSecret = z.string().min(32).max(512);
const providerUrl = z.string().refine((value) => isPublicHttpUrl(value) && new URL(value).protocol === "https:", "must be a public HTTPS URL without embedded credentials");

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_BASE_URL: z.url().default("http://localhost:3000"),
    APP_TIME_ZONE: z.string().min(1).default("America/Indiana/Indianapolis"),
    LIVE_INGESTION_ENABLED: booleanString.default(false),
    FIXTURE_INGESTION_ENABLED: booleanString.default(true),
    CRON_SECRET: productionSecret.optional(),
    DATABASE_URL: z.string().startsWith("postgresql://").optional(),
    DATABASE_DIRECT_URL: z.string().startsWith("postgresql://").optional(),
    TARGET_ADAPTER_MODE: adapterMode.default("fixture"),
    TARGET_PROVIDER_BASE_URL: providerUrl.optional(),
    TARGET_PROVIDER_API_KEY: z.string().min(1).optional(),
    WALMART_ADAPTER_MODE: adapterMode.default("fixture"),
    MEIJER_ADAPTER_MODE: adapterMode.default("fixture"),
    NECA_ADAPTER_MODE: necaAdapterMode.default("fixture"),
    ONLINE_RETAIL_ADAPTER_MODE: adapterMode.default("fixture"),
    REDDIT_ADAPTER_MODE: crowdAdapterMode.default("fixture"),
    REDDIT_CLIENT_ID: z.string().min(1).optional(),
    REDDIT_CLIENT_SECRET: z.string().min(1).optional(),
    REDDIT_REFRESH_TOKEN: z.string().min(1).optional(),
    REDDIT_USER_AGENT: z.string().min(8).max(200).default("shelf-radar/0.1 by configured-owner"),
    REDDIT_COMMUNITIES: z.string().min(1).default("TMNT,NECATMNT,ActionFigures,RossFinds"),
    ADAPTER_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(15_000),
    ADAPTER_MAX_PAGES_PER_RUN: z.coerce.number().int().min(1).max(20).default(5),
    ADAPTER_MIN_REQUEST_INTERVAL_MS: z.coerce.number().int().min(0).default(1_000),
    RAW_SOURCE_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    TMNT_DISCOVERY_TERMS: z.string().min(1).default("TMNT,Teenage Mutant Ninja Turtles,NECA TMNT,Last Ronin,Mutant Mayhem,TMNT GI Joe"),
    DISCOVERY_CRON: z.string().min(1).max(100).default("0 6,18 * * *"),
    CROWD_CRON: z.string().min(1).max(100).default("15 * * * *"),
    AVAILABILITY_CRON: z.string().min(1).max(100).default("45 */2 * * *"),
    RETENTION_CRON: z.string().min(1).max(100).default("30 3 * * *"),
    SHELF_RADAR_DATA_MODE: z.enum(["database", "fixture"]).default("fixture"),
    AUTH_MODE: z.enum(["development", "shared-secret"]).default("development"),
    AUTH_SECRET: productionSecret.optional(),
    ALLOWED_USER_EMAIL: z.email().optional()
  })
  .superRefine((env, ctx) => {
    const providerModes = [env.TARGET_ADAPTER_MODE, env.WALMART_ADAPTER_MODE, env.MEIJER_ADAPTER_MODE, env.ONLINE_RETAIL_ADAPTER_MODE];
    if (providerModes.includes("provider") && !env.LIVE_INGESTION_ENABLED) {
      ctx.addIssue({ code: "custom", path: ["LIVE_INGESTION_ENABLED"], message: "must be true for every retail provider mode" });
    }
    if (["provider", "public"].includes(env.NECA_ADAPTER_MODE) && !env.LIVE_INGESTION_ENABLED) {
      ctx.addIssue({ code: "custom", path: ["LIVE_INGESTION_ENABLED"], message: "must be true for NECA provider or public mode" });
    }
    if (env.TARGET_ADAPTER_MODE === "provider") {
      if (!env.TARGET_PROVIDER_BASE_URL || !env.TARGET_PROVIDER_API_KEY) {
        ctx.addIssue({ code: "custom", path: ["TARGET_PROVIDER_API_KEY"], message: "provider URL and key are required for provider mode" });
      }
    }
    if (env.REDDIT_ADAPTER_MODE === "oauth") {
      if (!env.LIVE_INGESTION_ENABLED) {
        ctx.addIssue({ code: "custom", path: ["LIVE_INGESTION_ENABLED"], message: "must be true for Reddit OAuth mode" });
      }
      if (!env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET || !env.REDDIT_REFRESH_TOKEN) {
        ctx.addIssue({ code: "custom", path: ["REDDIT_CLIENT_ID"], message: "approved Reddit OAuth credentials are required for OAuth mode" });
      }
    }
    if (env.REDDIT_ADAPTER_MODE === "rss" && !env.LIVE_INGESTION_ENABLED) {
      ctx.addIssue({ code: "custom", path: ["LIVE_INGESTION_ENABLED"], message: "must be true for Reddit RSS mode" });
    }
    if (env.SHELF_RADAR_DATA_MODE === "database" && !env.DATABASE_URL) {
      ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "is required for database data mode" });
    }
    if (env.NODE_ENV === "production" && env.SHELF_RADAR_DATA_MODE === "database") {
      if (env.AUTH_MODE !== "shared-secret" || !env.AUTH_SECRET || !env.ALLOWED_USER_EMAIL) {
        ctx.addIssue({ code: "custom", path: ["AUTH_MODE"], message: "production database mode requires shared-secret owner authentication" });
      }
      if (!env.CRON_SECRET) {
        ctx.addIssue({ code: "custom", path: ["CRON_SECRET"], message: "is required for production database jobs" });
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(input);
}
