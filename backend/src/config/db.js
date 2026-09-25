import "dotenv/config";
import { Sequelize } from "sequelize";

const sequelize = new Sequelize(process.env.DB_DBNAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  dialect: "mysql",
  logging: false,
});

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }
};

export const syncDB = async ({ alter = false, force = false } = {}) => {
  try {
    await sequelize.sync({ alter, force });
    console.log(`Database tables synced${alter ? " (alter)" : ""}`);
  } catch (error) {
    console.error("Database sync failed:", error.message);
    process.exit(1);
  }
};

export { sequelize };

export default sequelize;
