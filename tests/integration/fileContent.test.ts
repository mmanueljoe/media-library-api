import { describe, it, expect } from "vitest";
import { useTestDatabase } from "../setup/mongo.js";
import { api, authHeader, registerUser } from "../helpers/app.js";

useTestDatabase();

/** Real leading bytes for each format, plus filler so nothing is suspiciously short. */
const realPng = () =>
    Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(16),
    ]);
const realJpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
const realPdf = () => Buffer.from("%PDF-1.4\n trailing content");
const notAnything = () => Buffer.from("this is just text, no magic number");

const upload = (token: string, buffer: Buffer, declaredMime: string, filename = "file") =>
    api()
        .post("/api/v1/media")
        .set(authHeader(token))
        .field("title", "subject")
        .attach("file", buffer, { filename, contentType: declaredMime });

/**
 * The declared Content-Type is a label the client types; these tests check the
 * file's actual leading bytes. Multer's fileFilter only ever saw the label, so on
 * its own a PDF renamed to .png and sent as image/png sailed through.
 */
describe("uploads are checked against the file's real contents", () => {
    it("accepts a genuine PNG", async () => {
        const token = await registerUser("magic-png@test.local");

        const res = await upload(token, realPng(), "image/png", "real.png");

        expect(res.status).toBe(201);
        expect(res.body.data.mimeType).toBe("image/png");
        expect(res.body.data.category).toBe("image");
    });

    it("accepts a genuine JPEG", async () => {
        const token = await registerUser("magic-jpeg@test.local");

        const res = await upload(token, realJpeg(), "image/jpeg", "real.jpg");

        expect(res.status).toBe(201);
        expect(res.body.data.mimeType).toBe("image/jpeg");
        expect(res.body.data.category).toBe("image");
    });

    it("accepts a genuine PDF", async () => {
        const token = await registerUser("magic-pdf@test.local");

        const res = await upload(token, realPdf(), "application/pdf", "real.pdf");

        expect(res.status).toBe(201);
        expect(res.body.data.mimeType).toBe("application/pdf");
        expect(res.body.data.category).toBe("document");
    });

    it("rejects a PDF disguised as a PNG", async () => {
        const token = await registerUser("magic-pdf-as-png@test.local");

        // The exact attack: rename invoice.pdf to photo.png and declare image/png.
        const res = await upload(token, realPdf(), "image/png", "photo.png");

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("application/pdf");
    });

    it("rejects a PNG disguised as a PDF", async () => {
        const token = await registerUser("magic-png-as-pdf@test.local");

        const res = await upload(token, realPng(), "application/pdf", "doc.pdf");

        expect(res.status).toBe(400);
    });

    it("rejects a JPEG disguised as a PNG", async () => {
        const token = await registerUser("magic-jpeg-as-png@test.local");

        const res = await upload(token, realJpeg(), "image/png", "photo.png");

        expect(res.status).toBe(400);
    });

    it("rejects contents that match no supported format", async () => {
        const token = await registerUser("magic-garbage@test.local");

        const res = await upload(token, notAnything(), "image/png", "fake.png");

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("not a supported type");
    });

    it("rejects a file too short to carry a signature", async () => {
        const token = await registerUser("magic-tiny@test.local");

        const res = await upload(token, Buffer.from([0x89, 0x50]), "image/png", "tiny.png");

        expect(res.status).toBe(400);
    });

    it("does not care about the filename extension, only the bytes", async () => {
        const token = await registerUser("magic-ext@test.local");

        // Wrong extension, right bytes, right declared type — the extension is
        // never consulted, so this is a legitimate upload.
        const res = await upload(token, realPng(), "image/png", "screenshot.txt");

        expect(res.status).toBe(201);
        expect(res.body.data.category).toBe("image");
    });

    it("nothing is stored when the contents are rejected", async () => {
        const token = await registerUser("magic-nostore@test.local");

        await upload(token, realPdf(), "image/png", "photo.png");

        const list = await api().get("/api/v1/media").set(authHeader(token));
        expect(list.body.data.results).toHaveLength(0);
    });
});
