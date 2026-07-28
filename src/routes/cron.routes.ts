import { Router } from "express";
import { authenticateCron, ensureDbConnection } from "@/middlewares/index.js";
import { purgeDeletedMedia } from "@/controllers/mediaController.js";

export const cronRouter = Router();

/**
 * GET rather than POST because that's what Vercel Cron issues. Not RESTful for
 * something with side effects, but the alternative is a POST endpoint the
 * scheduler can't call.
 *
 * authenticateCron runs before ensureDbConnection for the same reason the auth
 * limiter does: an unauthorized caller shouldn't cost us a database connection.
 */
cronRouter.get("/purge-deleted-media", authenticateCron, ensureDbConnection, purgeDeletedMedia);
