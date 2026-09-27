import "dotenv/config";

const REQUIRED = ["DB_DBNAME", "DB_USER", "DB_PASSWORD", "DB_HOST", "JWT_SECRET_KEY"];

const missing = REQUIRED.filter((key) => {
  const value = process.env[key];
  return typeof value !== "string" || value.trim() === "";
});

if (missing.length > 0) {
  console.error(`[config] Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
};

const toList = (value) =>
  String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const accessSecret = process.env.JWT_SECRET_KEY.trim();
const refreshSecret = process.env.JWT_REFRESH_SECRET_KEY?.trim() || accessSecret;

if (refreshSecret === accessSecret) {
  console.warn(
    "[config] JWT_REFRESH_SECRET_KEY is not set - refresh tokens are signed with JWT_SECRET_KEY. Set a distinct secret before going to production.",
  );
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: (process.env.NODE_ENV ?? "development") === "production",
  port: toInt(process.env.PORT, 5000),
  trustProxy: process.env.TRUST_PROXY === "true",

  db: {
    name: process.env.DB_DBNAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: toInt(process.env.DB_PORT, 3306),
    syncAlter: process.env.SYNC_ALTER === "true",
  },

  jwt: {
    issuer: process.env.JWT_ISSUER ?? "calling-crm",
    audience: process.env.JWT_AUDIENCE ?? "calling-crm-app",
    accessSecret,
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshSecret,
    refreshDays: toInt(process.env.JWT_REFRESH_DAYS, 30),
  },

  cors: {
    origins: toList(process.env.FRONTEND_URI),
  },

  seed: {
    tenantName: process.env.SEED_TENANT_NAME ?? "Demo Company",
    tenantSlug: process.env.SEED_TENANT_SLUG ?? "demo",
    adminUserName: process.env.ADMIN_USERNAME ?? "admin",
    adminFullName: process.env.ADMIN_FULL_NAME ?? "Super Admin",
    adminPassword: process.env.ADMIN_PASSWORD ?? "12345678",
  },
};

export default env;
