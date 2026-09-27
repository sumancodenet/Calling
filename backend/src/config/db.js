import env from "./env.js";
import sequelize from "./sequelize.js";
import "../models/index.js";

export const connectDB = async () => {
  await sequelize.authenticate();
  console.log("[db] connected successfully");
  return sequelize;
};

export const syncDB = async ({ alter = env.db.syncAlter, force = false } = {}) => {
  if (env.isProduction && (alter || force)) {
    throw new Error("Refusing to run sequelize.sync({ alter, force }) in production. Use migrations instead.");
  }
  await sequelize.sync({ alter, force });
  console.log(`[db] tables synced${alter ? " (alter)" : ""}${force ? " (force)" : ""}`);
  return sequelize;
};

export { sequelize };
export default sequelize;
