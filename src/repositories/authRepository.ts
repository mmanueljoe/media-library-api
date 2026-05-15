import { User, type UserDoc } from "../models/user.js";
import { type CreateUserInput } from "../types/types.js";

export const createUser = async (data: CreateUserInput): Promise<UserDoc> => {
    return await User.create(data);
};

export const findUserByEmail = async (email: string): Promise<UserDoc | null> => {
    return await User.findOne({ email });
};

export const findUserById = async (id: string): Promise<UserDoc | null> => {
    return await User.findById(id);
};
