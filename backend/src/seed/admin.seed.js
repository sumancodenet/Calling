import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import env from "../config/env.js";
import { connectDB, syncDB, sequelize } from "../config/db.js";
import { Tenants, Users, Pipelines } from "../models/index.js";
import { string } from "../constants/string.js";

const SALT_ROUNDS = 10;
const args = process.argv.slice(2);
const force = args.includes("--force");
const alter = args.includes("--alter");

const DEFAULT_PIPELINES = ["New", "Contacted", "Qualified", "Won", "Lost"];

const seedTenant = async () => {
  const [tenant, created] = await Tenants.findOrCreate({
    where: { slug: env.seed.tenantSlug },
    defaults: { name: env.seed.tenantName, slug: env.seed.tenantSlug, plan: "PRO", maxUsers: 50, Status: "ACTIVE" },
  });
  console.log(`${created ? "created" : "exists"} -> tenant "${tenant.slug}" (id: ${tenant.id})`);
  return tenant;
};

const seedAdmin = async (tenant) => {
  const existing = await Users.findOne({ where: { tenantId: tenant.id, userName: env.seed.adminUserName } });
  if (existing) {
    console.log(`exists  -> admin "${existing.userName}" (id: ${existing.id})`);
    return;
  }

  const password = await bcrypt.hash(env.seed.adminPassword, SALT_ROUNDS);
  const admin = await Users.create({
    tenantId: tenant.id,
    userId: `ADM-${randomUUID().slice(0, 8).toUpperCase()}`,
    userName: env.seed.adminUserName,
    fullName: env.seed.adminFullName,
    password,
    role: string.ADMIN,
    Status: "ACTIVE",
    IsReset: false,
  });

  console.log(`created -> admin "${admin.userName}" (id: ${admin.id}, userId: ${admin.userId})`);
  console.log(`         password: ${env.seed.adminPassword}`);
};

const seedPipelines = async (tenant) => {
  for (const [position, pipeline] of DEFAULT_PIPELINES.entries()) {
    await Pipelines.findOrCreate({
      where: { tenantId: tenant.id, pipeline },
      defaults: { tenantId: tenant.id, pipeline, position, isDefault: true },
    });
  }
  console.log(`ensured -> ${DEFAULT_PIPELINES.length} default pipelines`);
};

try {
  await connectDB();
  await syncDB(force ? { force: true } : { alter });

  const tenant = await seedTenant();
  await seedAdmin(tenant);
  await seedPipelines(tenant);

  console.log("[seed] done");
} catch (error) {
  console.error("[seed] failed:", error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
