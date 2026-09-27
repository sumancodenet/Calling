import { UniqueConstraintError, ValidationError, ForeignKeyConstraintError, DatabaseError } from "sequelize";
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { sendError } from "../utils/response.js";

const normalize = (error) => {
  if (error instanceof AppError) {
    return { statusCode: error.statusCode, code: error.code, message: error.message, details: error.details };
  }

  if (error instanceof UniqueConstraintError) {
    const fields = Object.keys(error.fields ?? {});
    return {
      statusCode: 409,
      code: "CONFLICT",
      message: "A record with these values already exists",
      details: fields.length ? { fields } : null,
    };
  }

  if (error instanceof ValidationError) {
    return {
      statusCode: 422,
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: error.errors.map((item) => ({ field: item.path, message: item.message })),
    };
  }

  if (error instanceof ForeignKeyConstraintError) {
    return { statusCode: 400, code: "FK_VIOLATION", message: "Referenced record does not exist", details: null };
  }

  if (error instanceof jwt.TokenExpiredError) {
    return { statusCode: 401, code: "TOKEN_EXPIRED", message: "Session expired, please sign in again", details: null };
  }

  if (error instanceof jwt.JsonWebTokenError) {
    return { statusCode: 401, code: "INVALID_TOKEN", message: "Invalid authentication token", details: null };
  }

  if (error instanceof DatabaseError) {
    return { statusCode: 500, code: "DATABASE_ERROR", message: "Database error", details: null };
  }

  if (error?.type === "entity.parse.failed") {
    return { statusCode: 400, code: "INVALID_JSON", message: "Request body is not valid JSON", details: null };
  }

  return { statusCode: 500, code: "INTERNAL_ERROR", message: "Something went wrong", details: null };
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  const { statusCode, code, message, details } = normalize(error);

  const payload = { statusCode, code, message };
  if (details) payload.data = details;

  if (statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl} -> ${error.stack ?? error.message}`);
  } else {
    console.warn(`[warn] ${req.method} ${req.originalUrl} -> ${statusCode} ${code}: ${error.message}`);
  }

  if (!env.isProduction && statusCode >= 500) {
    payload.stack = error.stack;
  }

  return sendError(res, payload);
};

export default errorHandler;
