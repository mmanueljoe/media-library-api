import { describe, it, expect } from "vitest";
import { Media } from "@/models/index.js";
import { useTestDatabase } from "../setup/mongo.js";
import { api, authHeader, registerUser } from "../helpers/app.js";

useTestDatabase();

const fakePng = (): Buffer => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const uploadOne = async (token: string, title = "soft-delete-subject") =>
    api()
        .post("/api/v1/media")
        .set(authHeader(token))
        .field("title", title)
        .field("category", "image")
        .attach("file", fakePng(), { filename: "test.png", contentType: "image/png" });

const setup = async (email: string) => {
    const token = await registerUser(email);
    const upload = await uploadOne(token);
    return { token, id: upload.body.data._id as string };
};

describe("soft delete", () => {
    it("keeps the row in the database with deletedAt stamped", async () => {
        const { token, id } = await setup("soft-row@test.local");

        await api().delete(`/api/v1/media/${id}`).set(authHeader(token));

        // Querying the model directly, bypassing the repository's deletedAt
        // filter — the point is that the document still exists, which every read
        // path is supposed to hide.
        const raw = await Media.findById(id).lean();
        expect(raw).not.toBeNull();
        expect(raw?.deletedAt).toBeInstanceOf(Date);
    });

    it("hides it from get-by-id", async () => {
        const { token, id } = await setup("soft-get@test.local");

        await api().delete(`/api/v1/media/${id}`).set(authHeader(token));

        const res = await api().get(`/api/v1/media/${id}`).set(authHeader(token));
        expect(res.status).toBe(404);
    });

    it("hides it from the list and excludes it from the total", async () => {
        const token = await registerUser("soft-list@test.local");
        const keep = await uploadOne(token, "kept");
        const drop = await uploadOne(token, "dropped");

        await api().delete(`/api/v1/media/${drop.body.data._id}`).set(authHeader(token));

        const res = await api().get("/api/v1/media").set(authHeader(token));

        expect(res.status).toBe(200);
        expect(res.body.data.results).toHaveLength(1);
        expect(res.body.data.results[0]._id).toBe(keep.body.data._id);
        // A stale total would leak the deleted row as a phantom extra page.
        expect(res.body.data.pagination.total).toBe(1);
    });

    it("refuses to update a deleted item", async () => {
        const { token, id } = await setup("soft-update@test.local");

        await api().delete(`/api/v1/media/${id}`).set(authHeader(token));

        const res = await api()
            .patch(`/api/v1/media/${id}`)
            .set(authHeader(token))
            .send({ title: "resurrected" });

        expect(res.status).toBe(404);
    });

    it("returns 404 on a second delete rather than reporting success twice", async () => {
        const { token, id } = await setup("soft-twice@test.local");

        const first = await api().delete(`/api/v1/media/${id}`).set(authHeader(token));
        const second = await api().delete(`/api/v1/media/${id}`).set(authHeader(token));

        expect(first.status).toBe(200);
        expect(second.status).toBe(404);
    });

    it("keeps a deleted item out of search results", async () => {
        const token = await registerUser("soft-search@test.local");
        const drop = await uploadOne(token, "uniqueneedle findme");

        await api().delete(`/api/v1/media/${drop.body.data._id}`).set(authHeader(token));

        const res = await api().get("/api/v1/media?search=uniqueneedle").set(authHeader(token));

        expect(res.status).toBe(200);
        expect(res.body.data.results).toHaveLength(0);
    });

    it("still refuses a non-owner, without revealing whether the item exists", async () => {
        const { id } = await setup("soft-owner-a@test.local");
        const tokenB = await registerUser("soft-owner-b@test.local");

        const res = await api().delete(`/api/v1/media/${id}`).set(authHeader(tokenB));

        expect(res.status).toBe(403);
    });
});
