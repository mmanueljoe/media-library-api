import { Router } from "express";
import { uploadSingle, authenticate, validate } from "@/middlewares/index.js";
import {
    createMediaSchema,
    listMediaSchema,
    getMediaByIdSchema,
    updateMediaSchema,
} from "@/middlewares/validators/mediaValidator.js";
import {
    deleteMedia,
    getMediaById,
    updateMedia,
    uploadMedia,
    getMyMedia,
    restoreMedia,
} from "@/controllers/mediaController.js";

const mediaRouter = Router();

mediaRouter.post("/", authenticate, uploadSingle("file"), validate(createMediaSchema), uploadMedia);

mediaRouter.get("/", authenticate, validate(listMediaSchema), getMyMedia);

// Registered before /:id so "restore" is never swallowed as an id. The validator
// would reject it anyway, but relying on that makes the ordering load-bearing
// and invisible.
mediaRouter.post("/:id/restore", authenticate, validate(getMediaByIdSchema), restoreMedia);

mediaRouter.get("/:id", authenticate, validate(getMediaByIdSchema), getMediaById);

mediaRouter.delete("/:id", authenticate, validate(getMediaByIdSchema), deleteMedia);

mediaRouter.patch("/:id", authenticate, validate(updateMediaSchema), updateMedia);

export { mediaRouter };
