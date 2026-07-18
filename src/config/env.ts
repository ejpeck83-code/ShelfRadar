import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");
const adapterMode = z.enum(["fixture", "unavailable", "provider"]);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_BASE_URL: z.url().default("http://localhost:3000"),
    APP_TIME_ZONE: z.string().min(1).default("America/Indiana/Indianapolis"),
    LIVE_INGESTION_ENABLED: booleanString.default(false),
    FIXTURE_INGESTION_ENABLED: booleanString.default(true),
    DATABASE_URL: z.string().startsWith("postgresql://").optional(),
    DATABASE_DIRECT_URL: z.string().startsWith("postgresql://").optional(),
    TARGET_ADAPTER_MODE: adapterMode.default("fixture"),
    TARGET_PROVIDER_BASE_URL: z.url().optional(),
    TARGET_PROVIDER_API_KEY: z.string().min(1).optional(),
    ADAPTER_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(15_000),
    ADAPTER_MAX_PAGES_PER_RUN: z.coerce.number().int().min(1).max(20).default(5),
    ADAPTER_MIN_REQUEST_INTERVAL_MS: z.coerce.number().int().min(0).default(1_000),
    RAW_SOURCE_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    SHELF_RADAR_DATA_MODE: z.enum(["database", "fixture"]).default("fixture"),
    AUTH_MODE: z.enum(["development", "platform"]).default("development"),
    ALLOWED_USER_EMAIL: z.email().optional()
  })
  .superRefine((env, ctx) => {
    if (env.TARGET_ADAPTER_MODE === "provider") {
      if (!env.LIVE_INGESTION_ENABLED) {
        ctx.addIssue({ code: "custom", path: ["LIVE_INGESTION_ENABLED"], message: "must be true for provider mode" });
      }
      if (!env.TARGET_PROVIDER_BASE_URL || !env.TARGET_PROVIDER_API_KEY) {
        ctx.addIssue({ code: "custom", path: ["TARGET_PROVIDER_API_KEY"], message: "provider URL and key are required for provider mode" });
      }
    }
    if (env.SHELF_RADAR_DATA_MODE === "database" && !env.DATABASE_URL) {
      ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "is required for database data mode" });
    }
    if (env.NODE_ENV === "production" && env.AUTH_MODE === "development" && env.SHELF_RADAR_DATA_MODE === "database") {
      ctx.addIssue({ code: "custom", path: ["AUTH_MODE"], message: "database mode in production requires platform owner authentication" });
    }
    if (env.AUTH_MODE === "platform" && !env.ALLOWED_USER_EMAIL) {
      ctx.addIssue({ code: "custom", path: ["ALLOWED_USER_EMAIL"], message: "is required for platform authentication" });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(input);
}
