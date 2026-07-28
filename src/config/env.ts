import { config } from "dotenv";
import { z } from "zod";

const NODE_ENV = process.env.NODE_ENV ?? "development";

config({ path: `.env.${NODE_ENV}` });

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(16),
    JWT_EXPIRES_IN: z.string().min(1).default("7d"),
    MAX_FILE_SIZE_MB: z.coerce.number().positive().default(5),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "fatal", "silent"]).default("info"),

    CORS_ORIGINS: z
        .string()
        .default("")
        .transform((value) =>
            value
                .split(",")
                .map((origin) => origin.trim())
                .filter(Boolean)
        ),

    MEDIA_RETENTION_DAYS: z.coerce.number().positive().default(30),
    // Safety valve on the purge job so one run can't try to delete an unbounded
    // number of assets and blow the function timeout.
    MEDIA_PURGE_BATCH_LIMIT: z.coerce.number().positive().default(100),

    /**
     * Vercel sends this as `Authorization: Bearer <secret>` when it triggers a
     * cron. Optional in the schema so local dev and tests don't need it, but the
     * purge endpoint rejects every request when it's unset — an unauthenticated
     * hard-delete endpoint is worse than a cron that doesn't run.
     */
    CRON_SECRET: z.string().min(16).optional(),

    RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().positive().default(15),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().positive().default(100),
    AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().positive().default(10),

    CLOUDINARY_CLOUD_NAME: z.string().min(1),
    CLOUDINARY_API_KEY: z.string().min(1),
    CLOUDINARY_API_SECRET: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    const issues = parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");
    // Throwing rather than process.exit(1): both fail fast at import time, but
    // a thrown error carries the message into Vercel's function logs instead of
    // killing the container with an anonymous non-zero exit.
    throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

export type Env = z.infer<typeof envSchema>;
