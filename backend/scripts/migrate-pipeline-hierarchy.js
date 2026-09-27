import "dotenv/config";
import { connectDB, sequelize } from "../src/config/db.js";

/**
 * Restructures the pipeline domain from a flat list into a real hierarchy:
 *
 *   Pipelines (a pipeline)  ->  PipelineStages  ->  StageTags
 *
 * Historically the `Pipelines` table held stage rows ("New", "Contacted", ...)
 * directly. Those rows are moved under a single default pipeline so no data is
 * lost, and the two new tables are created.
 *
 * Idempotent: safe to run more than once.
 */
await connectDB();
const q = sequelize.getQueryInterface();
const db = sequelize.getDatabaseName();

const hasTable = async (name) => {
  const [rows] = await sequelize.query(
    "SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
    { replacements: [db, name] },
  );
  return rows[0].c > 0;
};

const hasColumn = async (table, column) => {
  const [rows] = await sequelize.query(
    "SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    { replacements: [db, table, column] },
  );
  return rows[0].c > 0;
};

const addColumn = async (table, column, definition) => {
  if (await hasColumn(table, column)) return console.log(`  skip ${table}.${column} (exists)`);
  await q.addColumn(table, column, definition);
  console.log(`  + ${table}.${column}`);
};

const addIndex = async (table, options) => {
  try {
    await q.addIndex(table, options);
    console.log(`  + index ${options.name}`);
  } catch {
    console.log(`  skip index ${options.name} (exists)`);
  }
};

const addFk = async (table, name, column, refTable, onDelete = "CASCADE") => {
  try {
    await q.addConstraint(table, {
      name,
      type: "foreign key",
      fields: [column],
      references: { table: refTable, field: "id" },
      onDelete,
    });
    console.log(`  + fk ${table}.${column} -> ${refTable}`);
  } catch {
    console.log(`  skip fk ${table}.${column}`);
  }
};

const dropTable = async (name) => {
  if (!(await hasTable(name))) return;
  await q.dropTable(name).catch(() => {});
  console.log(`  - dropped dead table ${name}`);
};

console.log("1. removing the unused CRM tables (all empty, no code references them)");
for (const t of ["LeadActivities", "CallLogs", "Deals", "Leads"]) await dropTable(t);

console.log("2. adding pipeline columns");
await addColumn("Pipelines", "description", { type: sequelize.Sequelize.STRING(255), allowNull: true });
await addColumn("Pipelines", "Status", { type: sequelize.Sequelize.STRING(20), allowNull: true, defaultValue: "ACTIVE" });
await sequelize.query("UPDATE `Pipelines` SET `Status` = 'ACTIVE' WHERE `Status` IS NULL");
await addIndex("Pipelines", { name: "pipelines_tenant_name", unique: true, fields: ["tenantId", "pipeline"] });

console.log("3. creating PipelineStages");
if (!(await hasTable("PipelineStages"))) {
  await q.createTable("PipelineStages", {
    id: { type: sequelize.Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    tenantId: { type: sequelize.Sequelize.INTEGER, allowNull: false },
    pipelineId: { type: sequelize.Sequelize.INTEGER, allowNull: false },
    name: { type: sequelize.Sequelize.STRING, allowNull: false },
    description: { type: sequelize.Sequelize.STRING(255), allowNull: true },
    position: { type: sequelize.Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    probability: { type: sequelize.Sequelize.INTEGER, allowNull: true },
    color: { type: sequelize.Sequelize.STRING(20), allowNull: true },
    isWon: { type: sequelize.Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    isLost: { type: sequelize.Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    isTerminal: { type: sequelize.Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    CreatedAt: { type: sequelize.Sequelize.DATE, allowNull: false, defaultValue: sequelize.fn("CURRENT_TIMESTAMP") },
    UpdatedAt: { type: sequelize.Sequelize.DATE, allowNull: false, defaultValue: sequelize.fn("CURRENT_TIMESTAMP") },
    DeletedAt: { type: sequelize.Sequelize.DATE, allowNull: true },
  });
  console.log("  + created PipelineStages");
} else {
  console.log("  skip PipelineStages (exists)");
  // The models are paranoid, so a table created before that needs the column.
  await addColumn("PipelineStages", "DeletedAt", { type: sequelize.Sequelize.DATE, allowNull: true });
}
await addIndex("PipelineStages", { name: "stages_pipeline_name", unique: true, fields: ["pipelineId", "name"] });
await addIndex("PipelineStages", { name: "stages_pipeline_position", fields: ["pipelineId", "position"] });
await addFk("PipelineStages", "stages_pipeline_fk", "pipelineId", "Pipelines");

console.log("4. creating StageTags");
if (!(await hasTable("StageTags"))) {
  await q.createTable("StageTags", {
    id: { type: sequelize.Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    tenantId: { type: sequelize.Sequelize.INTEGER, allowNull: false },
    stageId: { type: sequelize.Sequelize.INTEGER, allowNull: false },
    name: { type: sequelize.Sequelize.STRING, allowNull: false },
    color: { type: sequelize.Sequelize.STRING(20), allowNull: true },
    position: { type: sequelize.Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    CreatedAt: { type: sequelize.Sequelize.DATE, allowNull: false, defaultValue: sequelize.fn("CURRENT_TIMESTAMP") },
    UpdatedAt: { type: sequelize.Sequelize.DATE, allowNull: false, defaultValue: sequelize.fn("CURRENT_TIMESTAMP") },
    DeletedAt: { type: sequelize.Sequelize.DATE, allowNull: true },
  });
  console.log("  + created StageTags");
} else {
  console.log("  skip StageTags (exists)");
  await addColumn("StageTags", "DeletedAt", { type: sequelize.Sequelize.DATE, allowNull: true });
}
await addIndex("StageTags", { name: "tags_stage_name", unique: true, fields: ["stageId", "name"] });
await addFk("StageTags", "tags_stage_fk", "stageId", "PipelineStages");

console.log("5. moving the existing stage rows under a default pipeline");
if (await hasTable("PipelineStages")) {
  const [legacy] = await sequelize.query("SELECT id, tenantId, pipeline, position FROM `Pipelines` WHERE pipeline <> 'Default'");

  // The default pipeline must exist for each tenant before anything can move into it.
  const tenantIds = [...new Set(legacy.map((r) => r.tenantId))];
  for (const tenantId of tenantIds) {
    const [existing] = await sequelize.query("SELECT id FROM `Pipelines` WHERE tenantId = ? AND pipeline = 'Default'", {
      replacements: [tenantId],
    });
    if (existing.length === 0) {
      await sequelize.query(
        "INSERT INTO `Pipelines` (tenantId, pipeline, description, isDefault, position, Status, CreatedAt, UpdatedAt) VALUES (?, 'Default', 'Default pipeline', 1, 0, 'ACTIVE', NOW(), NOW())",
        { replacements: [tenantId] },
      );
      console.log(`  + created "Default" pipeline for tenant ${tenantId}`);
    }
  }

  if (legacy.length === 0) {
    console.log("  nothing to migrate (already done)");
  } else {
    const [defaults] = await sequelize.query("SELECT id, tenantId FROM `Pipelines` WHERE pipeline = 'Default'");
    const WON = ["won", "closed won", "converted", "sold"];
    const LOST = ["lost", "closed lost", "junk", "rejected"];
    const moved = [];

    for (const row of legacy) {
      const target = defaults.find((d) => d.tenantId === row.tenantId);
      if (!target) {
        console.warn(`  !! tenant ${row.tenantId} has no Default pipeline - keeping "${row.pipeline}" in place`);
        continue;
      }
      const name = String(row.pipeline).toLowerCase();
      const [result] = await sequelize.query(
        `INSERT IGNORE INTO \`PipelineStages\`
           (tenantId, pipelineId, name, position, isWon, isLost, isTerminal, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        {
          replacements: [
            row.tenantId,
            target.id,
            row.pipeline,
            row.position,
            WON.includes(name) ? 1 : 0,
            LOST.includes(name) ? 1 : 0,
          ],
        },
      );
      if (result.affectedRows > 0) {
        moved.push(row.id);
        console.log(`  ${row.pipeline} -> pipeline ${target.id} (tenant ${row.tenantId})`);
      }
    }

    // Only delete rows that were actually copied across.
    if (moved.length > 0) {
      await sequelize.query(`DELETE FROM \`Pipelines\` WHERE id IN (${moved.map(() => "?").join(",")})`, {
        replacements: moved,
      });
      console.log(`  removed ${moved.length} migrated row(s) from Pipelines`);
    }
  }
}

console.log("[migrate] done");
await sequelize.close();
