import express from "express";
import cors from "cors";
import helmet from "helmet";
import {
    apiRateLimit,
    ensureDbConnection,
    errorHandler,
    requestLogger,
} from "@/middlewares/index.js";
import { corsOptions } from "@/config/cors.js";
import { AppError } from "@/utils/AppError.js";
import { authRouter, mediaRouter, healthRouter } from "@/routes/index.js";

const app = express();
app.disable("x-powered-by");

// Vercel terminates TLS and proxies to the function, so the client IP only
// exists in X-Forwarded-For. Without this, req.ip is the proxy for every
// request and the rate limiter buckets all users into one counter — the whole
// world sharing one budget. `1` trusts exactly one hop (Vercel's) rather than
// `true`, which would trust a header any client can forge.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "100kb" }));
app.use(requestLogger);

// /health deliberately sits outside ensureDbConnection and the rate limiter —
// it reports on the database rather than depending on it, so it must answer even
// when Mongo is down, and uptime checks poll it far more often than the limit allows.
app.use("/health", healthRouter);

app.use("/api/v1", apiRateLimit);
// The auth router owns its own ordering: its rate limiter has to run before we
// try to reach the database, so a credential-stuffing run gets rejected cheaply
// instead of each attempt opening a connection attempt of its own.
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/media", ensureDbConnection, mediaRouter);

app.use((req, _res, next) => {
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

app.use(errorHandler);

export default app;
