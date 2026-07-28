import { describe, it, expect } from "vitest";
import { useTestDatabase } from "../setup/mongo.js";
import { api, authHeader, registerUser } from "../helpers/app.js";

useTestDatabase();

const fakePng = (): Buffer => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const fakePdf = (): Buffer => Buffer.from("%PDF-1.4");

const upload = (
    token: string,
    opts: { mime: string; declaredCategory?: string; filename?: string }
) => {
    const req = api().post("/api/v1/media").set(authHeader(token)).field("title", "subject");

    if (opts.declaredCategory !== undefined) req.field("category", opts.declaredCategory);

    const buffer = opts.mime === "application/pdf" ? fakePdf() : fakePng();

    return req.attach("file", buffer, {
        filename: opts.filename ?? "test",
        contentType: opts.mime,
    });
};

/**
 * Category is derived from the file, not taken from the client — a PDF cannot be
 * stored as an "image" no matter what the request says.
 */
describe("category is derived from the file", () => {
    it("stores an image without the client sending a category", async () => {
        const token = await registerUser("cat-derive-img@test.local");

        const res = await upload(token, { mime: "image/png" });

        expect(res.status).toBe(201);
        expect(res.body.data.category).toBe("image");
    });

    it("stores a PDF as a document without the client sending a category", async () => {
        const token = await registerUser("cat-derive-pdf@test.local");

        const res = await upload(token, { mime: "application/pdf" });

        expect(res.status).toBe(201);
        expect(res.body.data.category).toBe("document");
    });
});

describe("a declared category is verified, not trusted", () => {
    it("accepts a matching declaration", async () => {
        const token = await registerUser("cat-match@test.local");

        const res = await upload(token, { mime: "application/pdf", declaredCategory: "document" });

        expect(res.status).toBe(201);
        expect(res.body.data.category).toBe("document");
    });

    it("rejects a PDF declared as an image", async () => {
        const token = await registerUser("cat-pdf-as-image@test.local");

        const res = await upload(token, { mime: "application/pdf", declaredCategory: "image" });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("does not match");
    });

    it("rejects an image declared as a document", async () => {
        const token = await registerUser("cat-image-as-doc@test.local");

        const res = await upload(token, { mime: "image/png", declaredCategory: "document" });

        expect(res.status).toBe(400);
    });

    it("still rejects a category outside the enum", async () => {
        const token = await registerUser("cat-bogus@test.local");

        const res = await upload(token, { mime: "image/png", declaredCategory: "spreadsheet" });

        expect(res.status).toBe(400);
    });
});

describe("category cannot be changed after upload", () => {
    it("ignores category in a PATCH and applies the rest", async () => {
        const token = await registerUser("cat-patch@test.local");
        const created = await upload(token, { mime: "application/pdf" });

        const res = await api()
            .patch(`/api/v1/media/${created.body.data._id}`)
            .set(authHeader(token))
            .send({ title: "renamed", category: "image" });

        expect(res.status).toBe(200);
        expect(res.body.data.title).toBe("renamed");
        // The file is still a PDF, so the category must not have moved.
        expect(res.body.data.category).toBe("document");
    });

    it("rejects a PATCH containing only category, since nothing updatable was sent", async () => {
        const token = await registerUser("cat-patch-only@test.local");
        const created = await upload(token, { mime: "image/png" });

        const res = await api()
            .patch(`/api/v1/media/${created.body.data._id}`)
            .set(authHeader(token))
            .send({ category: "document" });

        expect(res.status).toBe(400);
    });
});

describe("filtering by category still reflects the derived value", () => {
    it("finds the PDF under document without either upload declaring a category", async () => {
        const token = await registerUser("cat-filter@test.local");
        await upload(token, { mime: "image/png" });
        await upload(token, { mime: "application/pdf" });

        const res = await api().get("/api/v1/media?category=document").set(authHeader(token));

        expect(res.status).toBe(200);
        expect(res.body.data.results).toHaveLength(1);
        expect(res.body.data.results[0].mimeType).toBe("application/pdf");
    });
});
