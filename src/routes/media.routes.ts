import { Router } from "express";
import { upload, authenticate, validate } from "../middlewares/index.js";
import {
    uploadMedia,
    getMyMedia,
    getMediaById,
    deleteMedia,
    updateMedia,
} from "../controllers/index.js";
import {
    createMediaSchema,
    listMediaSchema,
    getMediaByIdSchema,
    updateMediaSchema,
} from "../middlewares/validators/index.js";

const mediaRouter = Router();

mediaRouter.post(
    "/",
    authenticate,
    validate(createMediaSchema),
    upload.single("file"),
    uploadMedia
);

mediaRouter.get("/", authenticate, validate(listMediaSchema), getMyMedia);

mediaRouter.get("/:id", authenticate, validate(getMediaByIdSchema), getMediaById);

mediaRouter.delete("/:id", authenticate, validate(getMediaByIdSchema), deleteMedia);

mediaRouter.patch("/:id", authenticate, validate(updateMediaSchema), updateMedia);

export { mediaRouter };
