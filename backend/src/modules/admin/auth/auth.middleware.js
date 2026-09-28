import { verifyAccessToken } from "../../../utils/tokens.js";
import { unauthorized, forbidden } from "../../../utils/AppError.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { getSessionUser } from "./auth.service.js";

const extractToken = (req) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
};

export const authenticate = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw unauthorized("Missing access token");

  const payload = verifyAccessToken(token);
  if (payload.typ !== "access") throw unauthorized("Invalid token type");

  const user = await getSessionUser(Number(payload.sub));
  if (user.tenant?.id !== payload.tid) {
    // Token and account no longer agree on the workspace - refuse rather than guess.
    throw unauthorized("Token no longer valid for this workspace");
  }

  req.user = user;
  req.tenantId = user.tenant.id;
  return next();
});

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      // 403, not 401: the token is perfectly valid, this account simply may not do
      // this. A 401 here would make the client burn a refresh and retry pointlessly.
      return next(forbidden(`Requires one of: ${roles.join(", ")}`));
    }
    return next();
  };

export default authenticate;
