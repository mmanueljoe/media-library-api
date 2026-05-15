import { type Request, type Response, type NextFunction } from "express";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export const catchAsync =
    (fn: AsyncHandler) =>
    (req: Request, res: Response, next: NextFunction): void => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
