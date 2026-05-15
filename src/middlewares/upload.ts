import multer from "multer";

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, "uploads/");
    },
    filename: (_req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    },
});

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
    fileSize: 1024 * 1024 * 5,
};

export const upload = multer({ storage, limits, fileFilter });
