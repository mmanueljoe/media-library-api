import { User, type UserDoc } from "../models/user.js";

type CreateUserInput = {
    email: string;
    passwordHash: string;
};

export const createUser = async (data: CreateUserInput): Promise<UserDoc> => {
    return await User.create(data);
};

export const findUserByEmail = async (email: string): Promise<UserDoc | null> => {
    return await User.findOne({ email });
};

export const findUserById = async (id: string): Promise<UserDoc | null> => {
    return await User.findById(id);
};
