import { type Response } from "express";

export const sendSuccess = (
  res: Response,
  data: unknown,
  statusCode: number = 200
): void => {
  res.status(statusCode).json({
    status: "success",
    data,
  });
};
