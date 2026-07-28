import { Router } from "express";
import { validate, authenticate, authRateLimit, ensureDbConnection } from "@/middlewares/index.js";
import { loginSchema, registerSchema } from "@/middlewares/validators/authValidator.js";
import { register, login, me } from "@/controllers/authController.js";

export const authRouter = Router();

/**
 * Order matters here. The rate limiter goes first so a rejected attempt costs
 * nothing but a counter increment — put ensureDbConnection ahead of it and every
 * guess in a credential-stuffing run gets its own connection attempt, which is
 * an 8-second hold on a function invocation whenever the database is unhealthy.
 *
 * Register sits behind the same limiter as login: unlimited attempts let someone
 * enumerate which emails already have accounts.
 */
authRouter.post("/register", authRateLimit, ensureDbConnection, validate(registerSchema), register);

authRouter.post("/login", authRateLimit, ensureDbConnection, validate(loginSchema), login);

authRouter.get("/me", ensureDbConnection, authenticate, me);
