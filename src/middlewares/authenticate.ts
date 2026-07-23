import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/index.js";
import jwt from "jsonwebtoken";
import { env } from "../config/index.js";
import { findUserById } from "../repositories/index.js";

export const authenticate = async (
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return next(new AppError("Unauthorized", 401));

    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };

    if (!decoded.userId) return next(new AppError("Unauthorized", 401));

    const user = await findUserById(decoded.userId);

    if (!user) return next(new AppError("Unauthorized", 401));

    req.user = { id: user._id.toString() };

    next();
};
