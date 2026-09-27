import { createHash, randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import env from "../config/env.js";

export const REFRESH_COOKIE = "crm_rt";

export const hashToken = (token) => createHash("sha256").update(token).digest("hex");

const cookieBase = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? "strict" : "lax",
  path: "/api/auth",
  maxAge: env.jwt.refreshDays * 24 * 60 * 60 * 1000,
};

export const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE, token, cookieBase);
};

export const clearRefreshCookie = (res) => {
  const { maxAge, ...rest } = cookieBase;
  res.clearCookie(REFRESH_COOKIE, { ...rest, maxAge: undefined });
};

export const newFamilyId = () => randomUUID();
export const newRefreshToken = () => randomBytes(48).toString("base64url");

export const signAccessToken = (user) =>
  jwt.sign(
    { role: user.role, tid: user.tenantId, typ: "access" },
    env.jwt.accessSecret,
    {
      subject: String(user.id),
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
      expiresIn: env.jwt.accessTtl,
    },
  );

export const verifyAccessToken = (token) =>
  jwt.verify(token, env.jwt.accessSecret, { issuer: env.jwt.issuer, audience: env.jwt.audience });

export const refreshExpiry = () => new Date(Date.now() + env.jwt.refreshDays * 24 * 60 * 60 * 1000);

export const publicUser = (user) => ({
  id: user.id,
  userId: user.userId,
  userName: user.userName,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.Status,
  isReset: Boolean(user.IsReset),
  profileImage: user.ProfileImage,
  tenant: user.tenant
    ? { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug, plan: user.tenant.plan }
    : undefined,
  lastLogin: user.lastLogin,
});
