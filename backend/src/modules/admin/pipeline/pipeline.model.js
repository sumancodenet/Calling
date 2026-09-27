import { DataTypes } from "sequelize";
import sequelize from "../../../config/sequelize.js";

const Pipelines = sequelize.define(
  "Pipelines",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    pipeline: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "Pipelines",
    paranoid: true,
    deletedAt: "DeletedAt",
    timestamps: true,
    createdAt: "CreatedAt",
    updatedAt: "UpdatedAt",
    indexes: [{ unique: true, fields: ["tenantId", "pipeline"] }],
  },
);

export default Pipelines;
