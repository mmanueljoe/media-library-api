import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const storage = multer.memoryStorage();

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) {
        cb(null, true);
    } else {
        (cb as unknown as (error: Error | null, acceptFile: boolean) => void)(
            new Error("Invalid file type"),
            false
        );
    }
};

const limits = {
    fileSize: 1024 * 1024 * env.MAX_FILE_SIZE_MB,
};

export const upload = multer({ storage, limits, fileFilter });

/**
 * Wraps upload.single() so Multer's plain Error rejections (wrong MIME,
 * oversized file) become AppError(400) and reach the standard error envelope.
 */
export const uploadSingle =
    (field: string) =>
    (req: Request, res: Response, next: NextFunction): void => {
        upload.single(field)(req, res, (err: unknown) => {
            if (err) {
                const message = err instanceof Error ? err.message : "Upload failed";
                return next(new AppError(message, 400));
            }
            next();
        });
    };
