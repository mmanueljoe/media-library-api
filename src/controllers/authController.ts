import type { Response, Request } from "express";
import { catchAsync, sendSuccess } from "../utils/index.js";
import { register as registerUser, login as loginUser, getCurrentUser } from "../services/index.js";

export const register = catchAsync(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const user = await registerUser(email, password);
    sendSuccess(res, user, 201);
});

export const login = catchAsync(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const user = await loginUser(email, password);
    sendSuccess(res, user, 200);
});

export const me = catchAsync(async (req: Request, res: Response) => {
    const id = req.user!.id;
    const user = await getCurrentUser(id);
    sendSuccess(res, user, 200);
});
