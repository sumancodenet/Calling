import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import env from "./src/config/env.js";
import { connectDB, syncDB, sequelize } from "./src/config/db.js";
import { apiLimiter } from "./src/config/rateLimit.js";
import { errorHandler } from "./src/middleware/errorHandler.js";
import { notFoundHandler } from "./src/middleware/notFound.js";
import authRoutes from "./src/modules/admin/auth/auth.route.js";
import userRoutes from "./src/modules/admin/user/user.route.js";
import pipelineRoutes from "./src/modules/admin/pipeline/pipeline.route.js";

const app = express();

if (env.trustProxy) app.set("trust proxy", 1);

const allowlist = new Set(env.cors.origins);

app.use(
  helmet({
    // API-only service; the SPA is served separately.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin/curl requests have no Origin header.
      if (!origin) return callback(null, true);
      if (allowlist.size === 0) return callback(null, false);
      return callback(null, allowlist.has(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(apiLimiter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "calling-crm-api", env: env.nodeEnv, time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/pipelines", pipelineRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const start = async () => {
  await connectDB();
  if (!env.isProduction) await syncDB({ alter: env.db.syncAlter });

  const server = app.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port} (${env.nodeEnv})`);
    console.log(`[server] cors allowlist: ${[...allowlist].join(", ") || "(empty - all blocked)"}`);
  });

  const shutdown = async (signal) => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

start().catch((error) => {
  console.error("[server] failed to start:", error);
  process.exit(1);
});

export default app;
