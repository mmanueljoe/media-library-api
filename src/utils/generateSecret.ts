import crypto from "crypto";

const generateToken = () => {
    const secret = crypto.randomBytes(64).toString("hex");

    console.log(secret);
};

generateToken();
