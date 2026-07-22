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
    CLOUDINARY_CLOUD_NAME: z.string().min(1),
    CLOUDINARY_API_KEY: z.string().min(1),
    CLOUDINARY_API_SECRET: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    const issues = parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
}

export const env = parsed.data;

export type Env = z.infer<typeof envSchema>;
