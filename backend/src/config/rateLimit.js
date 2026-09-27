import rateLimit from "express-rate-limit";
import env from "./env.js";
import { tooManyRequests } from "../utils/AppError.js";

const fail = (req, res, next) => next(tooManyRequests());

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProduction ? 10 : 100,
  // Only failed logins count, so a legitimate user is never locked out by typos elsewhere.
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: fail,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.isProduction ? 300 : 5000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: fail,
});

export default { authLimiter, apiLimiter };
