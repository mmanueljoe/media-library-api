import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { connectDB } from "@/config/db.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req: Request, res: Response) => {
    // On a serverless cold start nothing has connected yet, so probe first —
    // otherwise health reports "disconnected" on every fresh container.
    // Swallowing the error is the point: a failed probe is a reportable result,
    // not a failed request.
    await connectDB().catch(() => undefined);

    const dbOk = mongoose.connection.readyState === 1;

    res.status(dbOk ? 200 : 503).json({
        status: dbOk ? "ok" : "error",
        db: dbOk ? "connected" : "disconnected",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});
