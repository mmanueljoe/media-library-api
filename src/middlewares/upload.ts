import multer from "multer";
import { env } from "../config/env.js";

const storage = multer.memoryStorage();

const allowedMimeTypes = ["image/jpeg", "image/png", "application/pdf"];

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
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
