import { createUser, findUserByEmail, findUserById } from "../repositories/index.js";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/index.js";
import { env } from "../config/index.js";
import { type UserDoc } from "../models/index.js";
import bcrypt from "bcrypt";

export const register = async (email: string, password: string) => {
    const normalizedEmail = email.toLowerCase();
    const user = await findUserByEmail(normalizedEmail);

    if (user) throw new AppError("User already exists", 400);

    const newUser: UserDoc = await createUser({
        email: normalizedEmail,
        passwordHash: password,
    });

    const token = jwt.sign({ userId: newUser._id }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN as Exclude<jwt.SignOptions["expiresIn"], undefined>,
    });

    return {
        user: {
            id: newUser._id,
            email: newUser.email,
        },
        token,
    };
};

export const login = async (email: string, password: string) => {
    const normalizedEmail = email.toLowerCase();
    const user = await findUserByEmail(normalizedEmail);

    if (!user) throw new AppError("Invalid credentials", 401);

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) throw new AppError("Invalid credentials", 401);

    const token = jwt.sign({ userId: user._id }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN as Exclude<jwt.SignOptions["expiresIn"], undefined>,
    });

    return {
        user: {
            id: user._id,
            email: user.email,
        },
        token,
    };
};

export const getCurrentUser = async (userId: string) => {
    const user = await findUserById(userId);

    if (!user) throw new AppError("User not found", 404);

    return {
        user: {
            id: user._id,
            email: user.email,
        },
    };
};
