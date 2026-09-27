import "dotenv/config";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { Sequelize } from "sequelize";

/**
 * Applies a plain .sql file. Stands in for a migration runner: statements are
 * split on ";" and run in order, and a failure stops before the next statement.
 *
 *   node scripts/apply-sql.js sql/002_user_employee_id.sql
 */
const file = process.argv[2];

if (!file) {
  console.error("usage: node scripts/apply-sql.js <file.sql>");
  process.exit(1);
}

const sequelize = new Sequelize(process.env.DB_DBNAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  dialect: "mysql",
  logging: false,
});

const statements = readFileSync(file, "utf8")
  .split(";")
  .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
  .filter(Boolean);

for (const statement of statements) {
  try {
    await sequelize.query(statement);
    console.log(`[sql] ok: ${statement.slice(0, 70).replace(/\s+/g, " ")}`);
  } catch (error) {
    // 1060 duplicate column / 1061 duplicate key means it is already applied.
    if (error.original?.errno === 1060 || error.original?.errno === 1061 || error.parent?.errno === 1061) {
      console.log(`[sql] already applied, skipped: ${statement.slice(0, 50)}`);
      continue;
    }
    console.error(`[sql] FAILED in ${basename(file)}: ${error.message}`);
    await sequelize.close();
    process.exit(1);
  }
}

console.log(`[sql] ${basename(file)} applied`);
await sequelize.close();
