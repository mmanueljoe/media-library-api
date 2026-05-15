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

export type RegisterInput = z.infer<(typeof registerSchema)["body"]>;

export type LoginInput = z.infer<(typeof loginSchema)["body"]>;
