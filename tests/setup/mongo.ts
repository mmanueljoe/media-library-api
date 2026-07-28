import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll } from "vitest";
import { resetRateLimits } from "@/middlewares/rateLimit.js";

export const useTestDatabase = (): void => {
    let mongo: MongoMemoryServer;

    beforeAll(async () => {
        mongo = await MongoMemoryServer.create();
        await mongoose.connect(mongo.getUri());
    });

    afterEach(async () => {
        const collections = mongoose.connection.collections;
        for (const key of Object.keys(collections)) {
            await collections[key]!.deleteMany({});
        }
        // Rate-limit counters are process-wide, so without this a case that
        // makes a lot of failed logins would silently 429 the next one.
        resetRateLimits();
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongo.stop();
    });
};
