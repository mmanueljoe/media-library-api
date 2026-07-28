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
import { authRouter, mediaRouter, healthRouter, cronRouter } from "@/routes/index.js";

const app = express();
app.disable("x-powered-by");

app.set("trust proxy", 1);

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "100kb" }));
app.use(requestLogger);

app.use("/health", healthRouter);

app.use("/api/v1", apiRateLimit);

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/media", ensureDbConnection, mediaRouter);

app.use("/api/cron", cronRouter);

app.use((req, _res, next) => {
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

app.use(errorHandler);

export default app;
