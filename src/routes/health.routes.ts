import { Router } from "express";
import mongoose from "mongoose";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbOk = dbState === 1;
    const status = dbOk ? 200 : 503;
    res.status(status).json({
        status: dbOk ? "ok" : "error",
        db: dbOk ? "connected" : "disconnected",
import { Router, type Request, type Response } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});
