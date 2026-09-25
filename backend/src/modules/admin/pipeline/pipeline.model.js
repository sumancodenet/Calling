import { DataTypes } from "sequelize";
import { sequelize } from "../../../config/db.js";

const Pipelines = sequelize.define(
  "Pipelines",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    pipeline: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "Pipelines",
    timestamps: true,
    createdAt: "CreatedAt",
    updatedAt: "UpdatedAt",
  },
);

export default Pipelines;
