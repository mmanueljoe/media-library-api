import type { CorsOptions } from "cors";
import { env } from "@/config/env.js";

/**
 * CORS only governs browsers. Postman, curl, and server-to-server calls send no
 * Origin header and are never blocked by this — so an empty CORS_ORIGINS list
 * locks out browser frontends without breaking the API for anything else.
 *
 * Deliberately not defaulting to "*": a wildcard plus credentials is the
 * combination that lets any site on the internet make authenticated calls with a
 * user's cookies. We only echo back origins that were explicitly allowed.
 */
export const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);

        return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    // Cache the preflight result so browsers stop re-asking on every request.
    maxAge: 86_400,
};
