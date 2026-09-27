import { validationResult } from "express-validator";
import { unprocessable } from "../utils/AppError.js";

/** express-validator reports `users[0].phone`; services report `users.0.phone`. Normalise. */
const normalisePath = (path) => String(path).replace(/\[(\d+)\]/g, ".$1");

export const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result.array().map((error) => ({
    field: normalisePath(error.path),
    message: error.msg,
  }));

  return next(unprocessable(details[0]?.message ?? "Validation failed", details));
};

export default validate;
