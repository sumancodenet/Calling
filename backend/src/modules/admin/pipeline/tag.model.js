import { DataTypes } from "sequelize";
import sequelize from "../../../config/sequelize.js";

/** A label hanging off a stage, e.g. "Hot lead" on "Fresh Enquiry". */
const StageTags = sequelize.define(
  "StageTags",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tenantId: { type: DataTypes.INTEGER, allowNull: false },
    stageId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
    color: { type: DataTypes.STRING(20), allowNull: true },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    tableName: "StageTags",
    paranoid: true,
    deletedAt: "DeletedAt",
    timestamps: true,
    createdAt: "CreatedAt",
    updatedAt: "UpdatedAt",
    indexes: [
      { unique: true, fields: ["stageId", "name"] },
      { fields: ["tenantId"] },
    ],
  },
);

export default StageTags;
