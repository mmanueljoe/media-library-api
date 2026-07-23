import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { errorHandler } from "./middlewares/index.js";
import { AppError } from "./utils/index.js";
import { authRouter, mediaRouter, healthRouter } from "./routes/index.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { requestLogger } from "./middlewares/requestLogger.js";
import { AppError } from "./utils/AppError.js";
import { authRouter } from "./routes/auth.routes.js";
import { mediaRouter } from "./routes/media.routes.js";
import { healthRouter } from "./routes/health.routes.js";

const app = express();
app.disable("x-powered-by");

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "100kb" }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: "error", message: "Too many requests, please try again later" },
});
app.use("/api/v1", limiter);

app.use("/health", healthRouter);

app.use(express.json());
app.use(requestLogger);

app.use("/health", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/media", mediaRouter);

app.use((req, _res, next) => {
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

app.use(errorHandler);

export default app;
