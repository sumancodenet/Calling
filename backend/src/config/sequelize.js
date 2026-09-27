import { Sequelize } from "sequelize";
import env from "./env.js";

/**
 * Standalone Sequelize instance. Kept free of any model imports so that model
 * files can depend on it without creating an import cycle with db.js.
 */
const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: "mysql",
  logging: env.isProduction ? false : (sql) => console.log(`[sql] ${sql}`),
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    freezeTableName: true,
  },
});

export { sequelize };
export default sequelize;
