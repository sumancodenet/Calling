import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB, syncDB } from "./src/config/db.js";

import Users from "./src/modules/admin/auth/auth.model.js";
import Pipelines from "./src/modules/admin/pipeline/pipeline.model.js";
import authRoutes from "./src/modules/admin/auth/auth.route.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Calling CRM API is running" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: err.message });
});

const isProduction = process.env.NODE_ENV === "production";
const shouldAlter = process.env.SYNC_ALTER === "true";

connectDB()
  .then(() => (isProduction ? null : syncDB({ alter: shouldAlter })))
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch(() => process.exit(1));
