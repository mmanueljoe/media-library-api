import { z } from "zod";

const registerSchema = {
    body: z.object({
        email: z.string().email(),
        password: z.string().min(8),
    }),
};

const loginSchema = {
    body: z.object({
        email: z.string().email(),
        password: z.string().min(8),
    }),
};

export { registerSchema, loginSchema };
