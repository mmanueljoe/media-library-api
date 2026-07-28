import pino from "pino";
import { env } from "@/config/env.js";
import { getRequestId } from "@/config/requestContext.js";

const isDev = env.NODE_ENV === "development";

export const logger = pino({
    level: env.LOG_LEVEL,

    mixin: () => {
        const requestId = getRequestId();
        return requestId ? { requestId } : {};
    },

    redact: {
        paths: [
            "password",
            "passwordHash",
            "*.password",
            "*.passwordHash",
            "req.body.password",
            "req.headers.authorization",
            "headers.authorization",
            "token",
            "*.token",
        ],
        censor: "[Redacted]",
    },

    ...(isDev && {
        transport: {
            target: "pino-pretty",
            options: {
                colorize: true,
            },
        },
    }),
});
