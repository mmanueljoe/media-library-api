import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodType } from "zod";
import { AppError } from "../utils/AppError.js";

type Schemas = {
    body?: ZodType;
    params?: ZodType;
    query?: ZodType;
};

const toErrorDetails = (err: ZodError, prefix: "body" | "params" | "query") => {
    return err.issues.map((issue) => ({
        field: `${prefix}.${issue.path.join(".")}`,
        message: issue.message,
    }));
};

export const validate =
    (schemas: Schemas) =>
    (req: Request, _res: Response, next: NextFunction): void => {
        try {
            const { body, params, query } = req;

            if (schemas.body) {
                try {
                    req.body = schemas.body.parse(body);
                } catch (err: unknown) {
                    if (err instanceof ZodError) {
                        return next(
                            new AppError("Validation failed", 400, toErrorDetails(err, "body"))
                        );
                    }
                    return next(err);
                }
            }

            if (schemas.params) {
                try {
                    Object.assign(req.params, schemas.params.parse(params));
                } catch (err: unknown) {
                    if (err instanceof ZodError) {
                        return next(
                            new AppError("Validation failed", 400, toErrorDetails(err, "params"))
                        );
                    }
                    return next(err);
                }
            }

            if (schemas.query) {
                try {
                    Object.assign(req.query, schemas.query.parse(query));
                } catch (err: unknown) {
                    if (err instanceof ZodError) {
                        return next(
                            new AppError("Validation failed", 400, toErrorDetails(err, "query"))
                        );
                    }
                    return next(err);
                }
            }

            next();
        } catch (err: unknown) {
            next(err);
        }
    };
