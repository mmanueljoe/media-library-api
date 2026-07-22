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
} from "@/controllers/mediaController.js";

const mediaRouter = Router();

mediaRouter.post("/", authenticate, uploadSingle("file"), validate(createMediaSchema), uploadMedia);

mediaRouter.get("/", authenticate, validate(listMediaSchema), getMyMedia);

mediaRouter.get("/:id", authenticate, validate(getMediaByIdSchema), getMediaById);

mediaRouter.delete("/:id", authenticate, validate(getMediaByIdSchema), deleteMedia);

mediaRouter.patch("/:id", authenticate, validate(updateMediaSchema), updateMedia);

export { mediaRouter };
