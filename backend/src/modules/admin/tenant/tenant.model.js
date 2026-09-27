import { DataTypes } from "sequelize";
import sequelize from "../../../config/sequelize.js";

export const PLANS = Object.freeze({
  FREE: "FREE",
  STARTER: "STARTER",
  PRO: "PRO",
  ENTERPRISE: "ENTERPRISE",
});

const Tenants = sequelize.define(
  "Tenants",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true },
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { is: /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/ },
    },
    plan: {
      type: DataTypes.ENUM(...Object.values(PLANS)),
      allowNull: false,
      defaultValue: PLANS.FREE,
    },
    maxUsers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      validate: { min: 1 },
    },
    Status: {
      type: DataTypes.ENUM("ACTIVE", "SUSPENDED"),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
  },
  {
    tableName: "Tenants",
    paranoid: true,
    deletedAt: "DeletedAt",
    timestamps: true,
    createdAt: "CreatedAt",
    updatedAt: "UpdatedAt",
    indexes: [{ unique: true, fields: ["slug"] }],
  },
);

export default Tenants;
