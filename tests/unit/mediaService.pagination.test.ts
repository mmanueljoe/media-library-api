import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/repositories/mediaRepository.js", () => ({
    createMedia: vi.fn(),
    deleteMediaById: vi.fn(),
    findMediaById: vi.fn(),
    findMediaByOwner: vi.fn(),
    updateMediaById: vi.fn(),
}));

import { findMediaByOwner } from "../../src/repositories/mediaRepository.js";
import { getMyMedia } from "../../src/services/mediaService.js";

const mockFindMediaByOwner = vi.mocked(findMediaByOwner);

describe("mediaService.getMyMedia pagination", () => {
    beforeEach(() => {
        mockFindMediaByOwner.mockReset();
    });

    const cases = [
        { total: 0, page: 1, limit: 10, expected: 0 },
        { total: 1, page: 1, limit: 10, expected: 1 },
        { total: 10, page: 1, limit: 10, expected: 1 },
        { total: 11, page: 1, limit: 10, expected: 2 },
        { total: 84, page: 2, limit: 10, expected: 9 },
        { total: 100, page: 1, limit: 25, expected: 4 },
        { total: 101, page: 1, limit: 25, expected: 5 },
    ];

    for (const { total, page, limit, expected } of cases) {
        it(`computes totalPages=${expected} for total=${total}, limit=${limit}`, async () => {
            mockFindMediaByOwner.mockResolvedValue({ total, results: [] });

            const result = await getMyMedia("owner-id", { page, limit });

            expect(result.pagination).toEqual({
                total,
                page,
                limit,
                totalPages: expected,
            });
        });
    }

    it("returns the repository's results untouched", async () => {
        const fakeResults = [{ _id: "m1" }, { _id: "m2" }] as unknown as Awaited<
            ReturnType<typeof findMediaByOwner>
        >["results"];
        mockFindMediaByOwner.mockResolvedValue({ total: 2, results: fakeResults });

        const result = await getMyMedia("owner-id", { page: 1, limit: 10 });

        expect(result.results).toBe(fakeResults);
    });

    it("forwards optional filters to the repository", async () => {
        mockFindMediaByOwner.mockResolvedValue({ total: 0, results: [] });

        await getMyMedia("owner-id", {
            page: 1,
            limit: 10,
            category: "document",
            tags: ["x"],
            search: "hello",
            sortBy: "title",
            order: "asc",
        });

        expect(mockFindMediaByOwner).toHaveBeenCalledWith("owner-id", 1, 10, {
            category: "document",
            tags: ["x"],
            search: "hello",
            sortBy: "title",
            order: "asc",
        });
    });
});
