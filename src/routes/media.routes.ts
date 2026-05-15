import { Router } from "express";
import { upload } from "../middlewares/upload.js";
import { authenticate } from "../middlewares/authenticate.js";
import {
    deleteMedia,
    getMediaById,
    updateMedia,
    uploadMedia,
} from "../controllers/mediaController.js";
import { createMediaSchema } from "../middlewares/validators/mediaValidator.js";
import { listMediaSchema } from "../middlewares/validators/mediaValidator.js";
import { getMediaByIdSchema } from "../middlewares/validators/mediaValidator.js";
import { updateMediaSchema } from "../middlewares/validators/mediaValidator.js";
import { validate } from "../middlewares/validate.js";
import { getMyMedia } from "../controllers/mediaController.js";

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

mediaRouter.put("/:id", authenticate, validate(updateMediaSchema), updateMedia);

export { mediaRouter };
