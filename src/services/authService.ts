import { createUser, findUserByEmail, findUserById } from "@/repositories/authRepository.js";
import jwt from "jsonwebtoken";
import { AppError } from "@/utils/AppError.js";
import { isDuplicateKeyError } from "@/utils/mongoErrors.js";
import { env } from "@/config/env.js";
import { type UserDoc } from "@/models/user.js";
import bcrypt from "bcryptjs";

export const register = async (email: string, password: string) => {
    const normalizedEmail = email.toLowerCase();
    const user = await findUserByEmail(normalizedEmail);

    if (user) throw new AppError("User already exists", 400);

    // The check above loses a race: two simultaneous registrations for the same
    // email both see "no user" and both try to insert. The unique index on email
    // is what actually enforces this, so we translate its error into the same
    // response the check produces — otherwise the loser of the race gets a 500
    // and identical requests return different status codes based on timing.
    let newUser: UserDoc;
    try {
        newUser = await createUser({
            email: normalizedEmail,
            passwordHash: password,
        });
    } catch (err: unknown) {
        if (isDuplicateKeyError(err)) throw new AppError("User already exists", 400);
        throw err;
    }

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
