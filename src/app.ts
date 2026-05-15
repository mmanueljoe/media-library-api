import express from "express";
import { sendSuccess } from "./utils/response.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { AppError } from "./utils/AppError.js";
import { authRouter } from "./routes/auth.routes.js";
import { mediaRouter } from "./routes/media.routes.js";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
    sendSuccess(res, { status: "ok" });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/media", mediaRouter);

app.use((req, _res, next) => {
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

app.use(errorHandler);

export default app;
