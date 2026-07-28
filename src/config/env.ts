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

    // Comma-separated list of browser origins allowed to call the API.
    // Empty means "no browser origins" — non-browser clients (Postman, curl,
    // server-to-server) are unaffected either way, since they send no Origin.
    CORS_ORIGINS: z
        .string()
        .default("")
        .transform((value) =>
            value
                .split(",")
                .map((origin) => origin.trim())
                .filter(Boolean)
        ),

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
