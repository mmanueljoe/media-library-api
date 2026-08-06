import { describe, it, expect } from "vitest";
import { useTestDatabase } from "../setup/mongo.js";
import { api, authHeader, registerUser } from "../helpers/app.js";

useTestDatabase();

// 1x1 transparent PNG (8 bytes header + minimal IHDR/IDAT/IEND) is awkward
// to write inline. A buffer with the correct PNG signature is enough — Multer
// only checks MIME, not magic bytes.
const fakePng = (): Buffer => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const fakeTxt = (): Buffer => Buffer.from("hello", "utf8");
const VALID_BUT_NONEXISTENT_ID = "507f1f77bcf86cd799439011";

const uploadOne = async (
    token: string,
    overrides: Partial<{ title: string; category: "image" | "document"; mime: string }> = {}
) => {
    const title = overrides.title ?? `media-${Math.random().toString(36).slice(2, 8)}`;
    const category = overrides.category ?? "image";
    const mime = overrides.mime ?? "image/png";
    const buffer = mime === "application/pdf" ? Buffer.from("%PDF-1.4") : fakePng();

    return api()
        .post("/api/v1/media")
        .set(authHeader(token))
        .field("title", title)
        .field("category", category)
        .attach("file", buffer, { filename: "test.png", contentType: mime });
};

describe("POST /api/v1/media", () => {
    it("creates media on a valid upload", async () => {
        const token = await registerUser("uploader@test.local");

        const res = await uploadOne(token, { title: "my picture", category: "image" });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe("success");
        expect(res.body.data).toMatchObject({
            title: "my picture",
            category: "image",
            mimeType: "image/png",
        });
        expect(res.body.data.url).toMatch(/^https:\/\/res\.cloudinary\.com\/fake\//);
        expect(typeof res.body.data.publicId).toBe("string");
    });

    it("rejects a missing title with 400", async () => {
        const token = await registerUser("missing-title@test.local");

        const res = await api()
            .post("/api/v1/media")
            .set(authHeader(token))
            .field("category", "image")
            .attach("file", fakePng(), { filename: "x.png", contentType: "image/png" });

        expect(res.status).toBe(400);
    });

    it("rejects an unsupported file type with 400", async () => {
        const token = await registerUser("bad-mime@test.local");

        const res = await api()
            .post("/api/v1/media")
            .set(authHeader(token))
            .field("title", "text file")
            .field("category", "document")
            .attach("file", fakeTxt(), { filename: "x.txt", contentType: "text/plain" });

        expect(res.status).toBe(400);
    });

    it("rejects an unauthenticated request with 401", async () => {
        const res = await api()
            .post("/api/v1/media")
            .field("title", "no auth")
            .field("category", "image")
            .attach("file", fakePng(), { filename: "x.png", contentType: "image/png" });

        expect(res.status).toBe(401);
    });
});

describe("GET /api/v1/media", () => {
    it("returns paginated results", async () => {
        const token = await registerUser("lister@test.local");
        await uploadOne(token);
        await uploadOne(token);
        await uploadOne(token);

        const res = await api().get("/api/v1/media").set(authHeader(token));

        expect(res.status).toBe(200);
        expect(res.body.data.results).toHaveLength(3);
        expect(res.body.data.pagination).toEqual({
            total: 3,
            page: 1,
            limit: 10,
            totalPages: 1,
        });
    });

    it("filters by category", async () => {
        const token = await registerUser("filterer@test.local");
        await uploadOne(token, { category: "image" });
        await uploadOne(token, { category: "document", mime: "application/pdf" });

        const res = await api().get("/api/v1/media?category=document").set(authHeader(token));

        expect(res.status).toBe(200);
        expect(res.body.data.results).toHaveLength(1);
        expect(res.body.data.results[0].category).toBe("document");
    });

    it("searches by title", async () => {
        const token = await registerUser("searcher@test.local");
        await uploadOne(token, { title: "uniquephrase needle" });
        await uploadOne(token, { title: "other haystack" });

        const res = await api().get("/api/v1/media?search=uniquephrase").set(authHeader(token));

        expect(res.status).toBe(200);
        expect(res.body.data.results).toHaveLength(1);
        expect(res.body.data.results[0].title).toBe("uniquephrase needle");
    });

    it("only returns the caller's own media", async () => {
        const tokenA = await registerUser("user-a@test.local");
        const tokenB = await registerUser("user-b@test.local");
        await uploadOne(tokenA);
        await uploadOne(tokenA);
        await uploadOne(tokenB);

        const res = await api().get("/api/v1/media").set(authHeader(tokenB));

        expect(res.body.data.results).toHaveLength(1);
    });

    it("rejects an unauthenticated request with 401", async () => {
        const res = await api().get("/api/v1/media");
        expect(res.status).toBe(401);
    });
});

describe("GET /api/v1/media/:id", () => {
    it("returns the media when the caller owns it", async () => {
        const token = await registerUser("getter@test.local");
        const upload = await uploadOne(token, { title: "fetch me" });
        const id = upload.body.data._id;

        const res = await api().get(`/api/v1/media/${id}`).set(authHeader(token));

        expect(res.status).toBe(200);
        expect(res.body.data._id).toBe(id);
    });

    it("returns 404 for a non-existent id", async () => {
        const token = await registerUser("getter-404@test.local");

        const res = await api()
            .get(`/api/v1/media/${VALID_BUT_NONEXISTENT_ID}`)
            .set(authHeader(token));

        expect(res.status).toBe(404);
    });

    it("returns 404 for another user's media, not revealing that it exists", async () => {
        const tokenA = await registerUser("owner-a@test.local");
        const tokenB = await registerUser("owner-b@test.local");
        const upload = await uploadOne(tokenA);
        const id = upload.body.data._id;

        const res = await api().get(`/api/v1/media/${id}`).set(authHeader(tokenB));

        expect(res.status).toBe(404);
    });

    /**
     * The point of returning 404 rather than 403 is that the two cases can't be
     * told apart. Asserting each is 404 separately wouldn't catch a difference in
     * the message, which would leak the same information a 403 did.
     */
    it("gives a byte-identical response for someone else's id and a made-up one", async () => {
        const tokenA = await registerUser("indist-a@test.local");
        const tokenB = await registerUser("indist-b@test.local");
        const upload = await uploadOne(tokenA);

        const someoneElses = await api()
            .get(`/api/v1/media/${upload.body.data._id}`)
            .set(authHeader(tokenB));

        const nonExistent = await api()
            .get(`/api/v1/media/${VALID_BUT_NONEXISTENT_ID}`)
            .set(authHeader(tokenB));

        expect(someoneElses.status).toBe(nonExistent.status);
        expect(someoneElses.body).toEqual(nonExistent.body);
    });
});

describe("PATCH /api/v1/media/:id", () => {
    it("updates the title", async () => {
        const token = await registerUser("updater@test.local");
        const upload = await uploadOne(token, { title: "old title" });
        const id = upload.body.data._id;

        const res = await api()
            .patch(`/api/v1/media/${id}`)
            .set(authHeader(token))
            .send({ title: "new title" });

        expect(res.status).toBe(200);
        expect(res.body.data.title).toBe("new title");
    });

    it("rejects an empty body with 400", async () => {
        const token = await registerUser("updater-bad@test.local");
        const upload = await uploadOne(token);
        const id = upload.body.data._id;

        const res = await api().patch(`/api/v1/media/${id}`).set(authHeader(token)).send({});

        expect(res.status).toBe(400);
    });

    it("returns 404 for another user's media, not revealing that it exists", async () => {
        const tokenA = await registerUser("update-owner-a@test.local");
        const tokenB = await registerUser("update-owner-b@test.local");
        const upload = await uploadOne(tokenA);
        const id = upload.body.data._id;

        const res = await api()
            .patch(`/api/v1/media/${id}`)
            .set(authHeader(tokenB))
            .send({ title: "hijack" });

        expect(res.status).toBe(404);
    });

    it("returns 404 for a non-existent id", async () => {
        const token = await registerUser("update-404@test.local");

        const res = await api()
            .put(`/api/v1/media/${VALID_BUT_NONEXISTENT_ID}`)
            .set(authHeader(token))
            .send({ title: "nope" });

        expect(res.status).toBe(404);
    });
});

describe("DELETE /api/v1/media/:id", () => {
    it("deletes the media", async () => {
        const token = await registerUser("deleter@test.local");
        const upload = await uploadOne(token);
        const id = upload.body.data._id;

        const res = await api().delete(`/api/v1/media/${id}`).set(authHeader(token));

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ id });

        const fetched = await api().get(`/api/v1/media/${id}`).set(authHeader(token));
        expect(fetched.status).toBe(404);
    });

    it("returns 404 for a non-existent id", async () => {
        const token = await registerUser("delete-404@test.local");

        const res = await api()
            .delete(`/api/v1/media/${VALID_BUT_NONEXISTENT_ID}`)
            .set(authHeader(token));

        expect(res.status).toBe(404);
    });

    it("returns 404 for another user's media, not revealing that it exists", async () => {
        const tokenA = await registerUser("delete-owner-a@test.local");
        const tokenB = await registerUser("delete-owner-b@test.local");
        const upload = await uploadOne(tokenA);
        const id = upload.body.data._id;

        const res = await api().delete(`/api/v1/media/${id}`).set(authHeader(tokenB));

        expect(res.status).toBe(404);
    });
});
