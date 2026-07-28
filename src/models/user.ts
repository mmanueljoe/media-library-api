import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
        },
        passwordHash: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

userSchema.pre("save", async function () {
    if (!this.isModified("passwordHash")) return;
    this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
});

export const User = mongoose.model("User", userSchema);

export type UserSchema = mongoose.InferSchemaType<typeof userSchema>;

export type UserDoc = mongoose.HydratedDocument<UserSchema>;
