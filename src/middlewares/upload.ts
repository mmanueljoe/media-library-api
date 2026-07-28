import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import { env } from "@/config/env.js";
import { allowedMimeTypes, deriveCategory } from "@/config/mediaTypes.js";
import { AppError } from "@/utils/AppError.js";

const storage = multer.memoryStorage();

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
    // deriveCategory returning a value is the same question as "is this type
    // allowed", so the accepted list has one definition in mediaTypes.ts.
    if (deriveCategory(file.mimetype)) {
        cb(null, true);
    } else {
        (cb as unknown as (error: Error | null, acceptFile: boolean) => void)(
            new Error(`Invalid file type. Allowed: ${allowedMimeTypes.join(", ")}`),
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
