import { validationResult } from "express-validator";
import { unprocessable } from "../utils/AppError.js";

export const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result.array().map((error) => ({
    field: error.path,
    message: error.msg,
  }));

  return next(unprocessable(details[0]?.message ?? "Validation failed", details));
};

export default validate;
