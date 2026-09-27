import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import env from "../config/env.js";
import { connectDB, syncDB, sequelize } from "../config/db.js";
import { Tenants, Users, Pipelines, PipelineStages, StageTags } from "../models/index.js";
import { string } from "../constants/string.js";

const SALT_ROUNDS = 10;
const args = process.argv.slice(2);
const force = args.includes("--force");
const alter = args.includes("--alter");

/**
 * Pipeline -> Stage -> Tag. `terminal` stages close a deal when reached.
 */
const DEFAULT_PIPELINE = {
  name: "Default",
  description: "Standard sales flow",
  stages: [
    { name: "Fresh Enquiry", probability: 10 },
    { name: "Deposit Status", probability: 40, tags: ["Awaiting payment", "Paid"] },
    { name: "Convert", probability: 75 },
    { name: "Load", probability: 90, tags: ["Hot lead", "Cold lead"] },
    { name: "Won", probability: 100, terminal: "won" },
    { name: "Lost", terminal: "lost" },
  ],
};

const seedTenant = async () => {
  const [tenant, created] = await Tenants.findOrCreate({
    where: { slug: env.seed.tenantSlug },
    defaults: { name: env.seed.tenantName, slug: env.seed.tenantSlug, plan: "PRO", maxUsers: 50, Status: "ACTIVE" },
  });
  console.log(`${created ? "created" : "exists "} -> tenant "${tenant.slug}" (id: ${tenant.id})`);
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
  console.log(`          password: ${env.seed.adminPassword}`);
};

const seedPipeline = async (tenant) => {
  const [pipeline, created] = await Pipelines.findOrCreate({
    where: { tenantId: tenant.id, pipeline: DEFAULT_PIPELINE.name },
    defaults: {
      tenantId: tenant.id,
      pipeline: DEFAULT_PIPELINE.name,
      description: DEFAULT_PIPELINE.description,
      isDefault: true,
      position: 0,
      Status: "ACTIVE",
    },
  });
  console.log(`${created ? "created" : "exists "} -> pipeline "${pipeline.pipeline}" (id: ${pipeline.id})`);

  for (const [position, stage] of DEFAULT_PIPELINE.stages.entries()) {
    const [row, stageCreated] = await PipelineStages.findOrCreate({
      where: { pipelineId: pipeline.id, name: stage.name },
      defaults: {
        tenantId: tenant.id,
        pipelineId: pipeline.id,
        name: stage.name,
        position,
        probability: stage.probability ?? null,
        isWon: stage.terminal === "won",
        isLost: stage.terminal === "lost",
        isTerminal: Boolean(stage.terminal),
      },
    });
    if (stageCreated) console.log(`  created -> stage "${row.name}" (id: ${row.id})`);

    for (const [i, tag] of (stage.tags ?? []).entries()) {
      const [, tagCreated] = await StageTags.findOrCreate({
        where: { stageId: row.id, name: tag },
        defaults: { tenantId: tenant.id, stageId: row.id, name: tag, position: i },
      });
      if (tagCreated) console.log(`    + tag "${tag}"`);
    }
  }
  console.log(`  ensured ${DEFAULT_PIPELINE.stages.length} stages`);
};

try {
  // Schema must already exist: run `node scripts/migrate-pipeline-hierarchy.js`.
  await connectDB();
  if (force || alter) await syncDB(force ? { force: true } : { alter });

  const tenant = await seedTenant();
  await seedAdmin(tenant);
  await seedPipeline(tenant);

  console.log("[seed] done");
} catch (error) {
  console.error("[seed] failed:", error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
