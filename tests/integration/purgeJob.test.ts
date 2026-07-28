import { describe, it, expect, vi, beforeEach } from "vitest";
import { Media } from "@/models/index.js";
import { cloudinary } from "@/config/cloudinary.js";
import { env } from "@/config/env.js";
import { useTestDatabase } from "../setup/mongo.js";
import { api, authHeader, registerUser } from "../helpers/app.js";

useTestDatabase();

// Read from env rather than hardcoding. CI can supply different values than
// .env.test does, and a test that hardcodes one of them fails there and nowhere
// else — which is exactly how this first broke.
const CRON_AUTH = { Authorization: `Bearer ${env.CRON_SECRET}` };
const PURGE_URL = "/api/cron/purge-deleted-media";
const RETENTION_DAYS = env.MEDIA_RETENTION_DAYS;

const fakePng = (): Buffer => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const daysAgo = (days: number): Date => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const uploadOne = async (token: string, title = "purge-subject") =>
    api()
        .post("/api/v1/media")
        .set(authHeader(token))
        .field("title", title)
        .field("category", "image")
        .attach("file", fakePng(), { filename: "test.png", contentType: "image/png" });

/**
 * Backdates deletedAt directly. The alternative is waiting 30 days, and mocking
 * the clock would hide whether the query's date comparison is right.
 */
const deleteAndBackdate = async (token: string, id: string, days: number) => {
    await api().delete(`/api/v1/media/${id}`).set(authHeader(token));
    await Media.updateOne({ _id: id }, { deletedAt: daysAgo(days) });
};

describe("purge cron authentication", () => {
    it("rejects a request with no token", async () => {
        const res = await api().get(PURGE_URL);
        expect(res.status).toBe(401);
    });

    it("rejects a wrong token", async () => {
        const res = await api().get(PURGE_URL).set({ Authorization: "Bearer nope" });
        expect(res.status).toBe(401);
    });

    it("accepts the configured cron secret", async () => {
        const res = await api().get(PURGE_URL).set(CRON_AUTH);
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ purged: 0, failed: 0 });
    });
});

describe("purge job", () => {
    beforeEach(() => {
        vi.mocked(cloudinary.uploader.destroy).mockClear();
        vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: "ok" });
    });

    it("hard-deletes items past the retention window and destroys their assets", async () => {
        const token = await registerUser("purge-old@test.local");
        const upload = await uploadOne(token);
        const id = upload.body.data._id as string;
        const publicId = upload.body.data.publicId as string;

        await deleteAndBackdate(token, id, RETENTION_DAYS + 1);

        const res = await api().get(PURGE_URL).set(CRON_AUTH);

        expect(res.status).toBe(200);
        expect(res.body.data.purged).toBe(1);
        expect(vi.mocked(cloudinary.uploader.destroy)).toHaveBeenCalledWith(
            publicId,
            expect.objectContaining({ resource_type: "image" })
        );
        // Gone for real this time, not just stamped.
        expect(await Media.findById(id)).toBeNull();
    });

    it("leaves items still inside the retention window alone", async () => {
        const token = await registerUser("purge-recent@test.local");
        const upload = await uploadOne(token);
        const id = upload.body.data._id as string;

        await deleteAndBackdate(token, id, RETENTION_DAYS - 1);

        const res = await api().get(PURGE_URL).set(CRON_AUTH);

        expect(res.body.data.purged).toBe(0);
        expect(vi.mocked(cloudinary.uploader.destroy)).not.toHaveBeenCalled();
        // Still soft-deleted, so still restorable.
        const still = await Media.findById(id);
        expect(still?.deletedAt).toBeInstanceOf(Date);
    });

    it("never touches live media", async () => {
        const token = await registerUser("purge-live@test.local");
        const upload = await uploadOne(token);

        await api().get(PURGE_URL).set(CRON_AUTH);

        expect(vi.mocked(cloudinary.uploader.destroy)).not.toHaveBeenCalled();
        expect(await Media.findById(upload.body.data._id)).not.toBeNull();
    });

    it("keeps the row when the asset destroy fails, so the next run retries it", async () => {
        const token = await registerUser("purge-fail@test.local");
        const upload = await uploadOne(token);
        const id = upload.body.data._id as string;

        await deleteAndBackdate(token, id, RETENTION_DAYS + 1);
        vi.mocked(cloudinary.uploader.destroy).mockRejectedValueOnce(new Error("cloudinary down"));

        const res = await api().get(PURGE_URL).set(CRON_AUTH);

        expect(res.body.data).toMatchObject({ purged: 0, failed: 1 });
        // Dropping the row here would orphan the file with nothing pointing at it.
        expect(await Media.findById(id)).not.toBeNull();
    });

    it("keeps going after one item fails", async () => {
        const token = await registerUser("purge-partial@test.local");
        const first = await uploadOne(token, "first");
        const second = await uploadOne(token, "second");

        await deleteAndBackdate(token, first.body.data._id, RETENTION_DAYS + 2);
        await deleteAndBackdate(token, second.body.data._id, RETENTION_DAYS + 1);

        // Oldest is processed first, so this fails the first of the two.
        vi.mocked(cloudinary.uploader.destroy).mockRejectedValueOnce(new Error("cloudinary down"));

        const res = await api().get(PURGE_URL).set(CRON_AUTH);

        expect(res.body.data).toMatchObject({ purged: 1, failed: 1 });
        expect(await Media.findById(first.body.data._id)).not.toBeNull();
        expect(await Media.findById(second.body.data._id)).toBeNull();
    });

    it("reports the cutoff it used", async () => {
        const res = await api().get(PURGE_URL).set(CRON_AUTH);

        const cutoff = new Date(res.body.data.cutoff as string);
        const expected = daysAgo(RETENTION_DAYS);
        // Within a minute of the expected cutoff — the test and the job don't
        // read the clock at the same instant.
        expect(Math.abs(cutoff.getTime() - expected.getTime())).toBeLessThan(60_000);
    });
});
