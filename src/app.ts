import express from "express";
import { errorHandler, requestLogger } from "@/middlewares/index.js";
import { AppError } from "@/utils/AppError.js";
import { authRouter, mediaRouter, healthRouter } from "@/routes/index.js";

const app = express();
app.disable("x-powered-by");

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
