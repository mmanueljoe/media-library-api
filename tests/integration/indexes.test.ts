import { describe, it, expect } from "vitest";
import { User, Media } from "@/models/index.js";
import { isDuplicateKeyError } from "@/utils/mongoErrors.js";
import { useTestDatabase } from "../setup/mongo.js";

useTestDatabase();

/**
 * These assert the indexes exist rather than testing behaviour through the API.
 * Two things quietly depend on them: the duplicate-email race is only safe
 * because the unique index rejects the second insert, and ?search only works
 * while the text index is present. Both fail silently if index creation ever
 * gets turned off.
 */
describe("model indexes", () => {
    it("enforces unique emails at the database level", async () => {
        await User.syncIndexes();

        await User.create({ email: "dupe@test.local", passwordHash: "hashed" });

        const secondInsert = User.create({
            email: "dupe@test.local",
            passwordHash: "hashed",
        });

        await expect(secondInsert).rejects.toSatisfy(isDuplicateKeyError);
    });

    it("has a text index on media titles for ?search", async () => {
        await Media.syncIndexes();

        const indexes = await Media.collection.indexes();
        const textIndex = indexes.find((index) => Object.values(index.key).includes("text"));

        expect(textIndex).toBeDefined();
    });
});
