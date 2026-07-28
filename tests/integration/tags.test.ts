import { describe, it, expect } from "vitest";
import { useTestDatabase } from "../setup/mongo.js";
import { api, authHeader, registerUser } from "../helpers/app.js";

useTestDatabase();

const fakePng = (): Buffer => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** `tags` omitted entirely when undefined, so the "no tags" case is reachable. */
const upload = (token: string, tags?: string | string[]) => {
    const req = api()
        .post("/api/v1/media")
        .set(authHeader(token))
        .field("title", "tagged")
        .field("category", "image");

    if (tags !== undefined) req.field("tags", tags);

    return req.attach("file", fakePng(), { filename: "test.png", contentType: "image/png" });
};

/**
 * multipart/form-data has no array type, so an upload sends tags as the single
 * string "one,two". These cover that path — the existing media tests only ever
 * uploaded without tags, which is how the upload endpoint shipped rejecting them.
 */
describe("tag normalisation on upload", () => {
    it("accepts a comma-separated string and stores an array", async () => {
        const token = await registerUser("tags-csv@test.local");

        const res = await upload(token, "alpha,beta");

        expect(res.status).toBe(201);
        expect(res.body.data.tags).toEqual(["alpha", "beta"]);
    });

    it("trims whitespace around each tag", async () => {
        const token = await registerUser("tags-spaces@test.local");

        const res = await upload(token, " alpha , beta ");

        expect(res.status).toBe(201);
        expect(res.body.data.tags).toEqual(["alpha", "beta"]);
    });

    it("accepts a single tag with no comma", async () => {
        const token = await registerUser("tags-single@test.local");

        const res = await upload(token, "alpha");

        expect(res.status).toBe(201);
        expect(res.body.data.tags).toEqual(["alpha"]);
    });

    it("accepts repeated form fields, which arrive already as an array", async () => {
        const token = await registerUser("tags-repeated@test.local");

        const res = await upload(token, ["alpha", "beta"]);

        expect(res.status).toBe(201);
        expect(res.body.data.tags).toEqual(["alpha", "beta"]);
    });

    it("treats an empty tags field as no tags rather than a validation error", async () => {
        const token = await registerUser("tags-empty@test.local");

        const res = await upload(token, "");

        expect(res.status).toBe(201);
        expect(res.body.data.tags).toEqual([]);
    });

    it("drops empty entries from a trailing comma", async () => {
        const token = await registerUser("tags-trailing@test.local");

        const res = await upload(token, "alpha,,beta,");

        expect(res.status).toBe(201);
        expect(res.body.data.tags).toEqual(["alpha", "beta"]);
    });
});

describe("tag normalisation on update", () => {
    const uploadOne = async (token: string) => upload(token, "original");

    it("accepts a real array over JSON", async () => {
        const token = await registerUser("tags-patch-array@test.local");
        const created = await uploadOne(token);

        const res = await api()
            .patch(`/api/v1/media/${created.body.data._id}`)
            .set(authHeader(token))
            .send({ tags: ["one", "two"] });

        expect(res.status).toBe(200);
        expect(res.body.data.tags).toEqual(["one", "two"]);
    });

    it("also accepts a comma-separated string", async () => {
        const token = await registerUser("tags-patch-csv@test.local");
        const created = await uploadOne(token);

        const res = await api()
            .patch(`/api/v1/media/${created.body.data._id}`)
            .set(authHeader(token))
            .send({ tags: "one,two" });

        expect(res.status).toBe(200);
        expect(res.body.data.tags).toEqual(["one", "two"]);
    });
});

describe("filtering by tag still works", () => {
    it("finds media by one of its tags", async () => {
        const token = await registerUser("tags-filter@test.local");
        await upload(token, "keep,shared");
        await upload(token, "other");

        const res = await api().get("/api/v1/media?tags=keep").set(authHeader(token));

        expect(res.status).toBe(200);
        expect(res.body.data.results).toHaveLength(1);
        expect(res.body.data.results[0].tags).toEqual(["keep", "shared"]);
    });
});
