import mongoose from "mongoose";
import { env, logger } from "@/config/index.js";

/**
 * On Vercel every cold start gets a fresh container, so a naive connect-on-boot
 * opens a new connection pool per container and we burn through the Atlas
 * connection limit under load. Vercel does reuse warm containers though, and
 * anything hung off globalThis survives between requests in the same one — so
 * we stash the connection promise there and hand the same one back on reuse.
 *
 * Caching the *promise* rather than the connection matters: two requests can
 * arrive before the first connect resolves, and both should await one attempt
 * instead of racing to open two pools.
 */
type MongooseCache = {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
};

const globalCache = globalThis as typeof globalThis & {
    __mongooseCache?: MongooseCache;
};

const cache: MongooseCache = (globalCache.__mongooseCache ??= {
    conn: null,
    promise: null,
});

export const connectDB = async (): Promise<typeof mongoose> => {
    // readyState is the source of truth, not the cache: the test suite connects
    // to an in-memory Mongo directly, and calling connect() again on a live
    // connection throws.
    if (mongoose.connection.readyState === 1) return (cache.conn ??= mongoose);

    // A dropped connection leaves a resolved-but-dead promise behind, so clear
    // it and let the next caller start a genuinely new attempt.
    if (mongoose.connection.readyState === 0) {
        cache.conn = null;
        cache.promise = null;
    }

    cache.promise ??= mongoose
        .connect(env.DATABASE_URL, {
            // Serverless invocations are short-lived; fail fast instead of
            // holding the request open for the 30s driver default.
            serverSelectionTimeoutMS: 8000,
            // Left on deliberately. The usual advice is to disable this in
            // production, but two things depend on indexes existing: the text
            // index behind ?search, and the unique constraint on email. Turning
            // it off means both silently stop working on a fresh database until
            // someone builds the indexes by hand. The cost is a cheap no-op
            // index check per cold start; worth it until we have a real
            // migration step to own index creation.
            autoIndex: true,
        })
        .then((m) => {
            logger.info("Connected to MongoDB");
            return m;
        })
        .catch((err: unknown) => {
            cache.promise = null;
            throw err;
        });

    cache.conn = await cache.promise;
    return cache.conn;
};
