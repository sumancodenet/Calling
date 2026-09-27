export class AppError extends Error {
  constructor(message, { statusCode = 500, code = "INTERNAL_ERROR", details = null } = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const badRequest = (message, details) =>
  new AppError(message, { statusCode: 400, code: "BAD_REQUEST", details });

export const unauthorized = (message = "Authentication required", details) =>
  new AppError(message, { statusCode: 401, code: "UNAUTHORIZED", details });

export const forbidden = (message = "You do not have access to this resource", details) =>
  new AppError(message, { statusCode: 403, code: "FORBIDDEN", details });

export const notFound = (message = "Resource not found", details) =>
  new AppError(message, { statusCode: 404, code: "NOT_FOUND", details });

export const conflict = (message, details) =>
  new AppError(message, { statusCode: 409, code: "CONFLICT", details });

export const unprocessable = (message, details) =>
  new AppError(message, { statusCode: 422, code: "UNPROCESSABLE_ENTITY", details });

export const tooManyRequests = (message = "Too many requests, please try again later", details) =>
  new AppError(message, { statusCode: 429, code: "TOO_MANY_REQUESTS", details });

export default AppError;
