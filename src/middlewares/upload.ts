import multer, { type FileFilterCallback } from "multer";
import { type Request } from "express";

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, "uploads/");
    },
    filename: (_req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    },
});

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);

const fileFilter: multer.Options["fileFilter"] = (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
) => {
    if (allowedMimeTypes.has(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type"));
    }
};

const limits = {
    fileSize: 1024 * 1024 * 5,
};

export const upload = multer({ storage, limits, fileFilter });
