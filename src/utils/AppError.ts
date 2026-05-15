export type ErrorDetail = {
    field: string;
    message: string;
};

export class AppError extends Error {
    statusCode: number;
    isOperational: boolean;
    details?: ErrorDetail[];

    constructor(message: string, statusCode: number, details?: ErrorDetail[]) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        if (details) this.details = details;

        Error.captureStackTrace(this, this.constructor);
    }
}
