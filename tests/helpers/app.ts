import request from "supertest";
import app from "@/app.js";

export const api = (): request.Agent => request(app);

export const registerUser = async (email: string, password = "password123"): Promise<string> => {
    const res = await api().post("/api/v1/auth/register").send({ email, password });
    if (res.status !== 200 && res.status !== 201) {
        throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body.data.token;
};

export const authHeader = (token: string): Record<string, string> => ({
    Authorization: `Bearer ${token}`,
});
