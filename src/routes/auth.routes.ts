import { Router } from "express";
import { validate, authenticate } from "@/middlewares/index.js";
import { loginSchema, registerSchema } from "@/middlewares/validators/authValidator.js";
import { register, login, me } from "@/controllers/authController.js";

export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), register);

authRouter.post("/login", validate(loginSchema), login);

authRouter.get("/me", authenticate, me);
