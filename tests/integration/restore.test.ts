import { describe, it, expect } from "vitest";
import { useTestDatabase } from "../setup/mongo.js";
import { api, authHeader, registerUser } from "../helpers/app.js";

useTestDatabase();

const fakePng = (): Buffer => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const VALID_BUT_NONEXISTENT_ID = "507f1f77bcf86cd799439011";

const uploadOne = async (token: string, title = "restore-subject") =>
    api()
        .post("/api/v1/media")
        .set(authHeader(token))
        .field("title", title)
        .field("category", "image")
        .attach("file", fakePng(), { filename: "test.png", contentType: "image/png" });

const uploadThenDelete = async (email: string) => {
    const token = await registerUser(email);
    const upload = await uploadOne(token);
    const id = upload.body.data._id as string;
    await api().delete(`/api/v1/media/${id}`).set(authHeader(token));
    return { token, id };
};

describe("POST /api/v1/media/:id/restore", () => {
    it("brings a soft-deleted item back into reads", async () => {
        const { token, id } = await uploadThenDelete("restore-ok@test.local");

        const res = await api().post(`/api/v1/media/${id}/restore`).set(authHeader(token));

        expect(res.status).toBe(200);
        expect(res.body.data.deletedAt).toBeNull();

        const fetched = await api().get(`/api/v1/media/${id}`).set(authHeader(token));
        expect(fetched.status).toBe(200);

        const list = await api().get("/api/v1/media").set(authHeader(token));
        expect(list.body.data.results).toHaveLength(1);
        expect(list.body.data.pagination.total).toBe(1);
    });

    it("makes the item updatable again", async () => {
        const { token, id } = await uploadThenDelete("restore-update@test.local");

        await api().post(`/api/v1/media/${id}/restore`).set(authHeader(token));

        const res = await api()
            .patch(`/api/v1/media/${id}`)
            .set(authHeader(token))
            .send({ title: "back from the dead" });

        expect(res.status).toBe(200);
        expect(res.body.data.title).toBe("back from the dead");
    });

    it("404s on an item that was never deleted", async () => {
        const token = await registerUser("restore-live@test.local");
        const upload = await uploadOne(token);

        const res = await api()
            .post(`/api/v1/media/${upload.body.data._id}/restore`)
            .set(authHeader(token));

        expect(res.status).toBe(404);
    });

    it("404s on an id that does not exist", async () => {
        const token = await registerUser("restore-missing@test.local");

        const res = await api()
            .post(`/api/v1/media/${VALID_BUT_NONEXISTENT_ID}/restore`)
            .set(authHeader(token));

        expect(res.status).toBe(404);
    });

    it("403s when the caller is not the owner", async () => {
        const { id } = await uploadThenDelete("restore-owner-a@test.local");
        const tokenB = await registerUser("restore-owner-b@test.local");

        const res = await api().post(`/api/v1/media/${id}/restore`).set(authHeader(tokenB));

        expect(res.status).toBe(403);
    });

    it("401s without a token", async () => {
        const { id } = await uploadThenDelete("restore-noauth@test.local");

        const res = await api().post(`/api/v1/media/${id}/restore`);

        expect(res.status).toBe(401);
    });

    it("404s on a second restore rather than reporting success twice", async () => {
        const { token, id } = await uploadThenDelete("restore-twice@test.local");

        const first = await api().post(`/api/v1/media/${id}/restore`).set(authHeader(token));
        const second = await api().post(`/api/v1/media/${id}/restore`).set(authHeader(token));

        expect(first.status).toBe(200);
        expect(second.status).toBe(404);
    });
});
