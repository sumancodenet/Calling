import { DataTypes } from "sequelize";
import sequelize from "../../../config/sequelize.js";

const Users = sequelize.define(
  "Users",
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
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    userName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: { isEmail: true },
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
      // Uniqueness is per tenant (see the composite index below), not global.
    },
    employeeId: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    password: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    passwordChangedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failedLoginAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lockedUntil: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ReportingUser: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    IsReset: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    Status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE", "BLOCKED"),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ProfileImage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    CreatedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "Users",
    paranoid: true,
    deletedAt: "DeletedAt",
    timestamps: true,
    createdAt: "CreatedAt",
    updatedAt: "UpdatedAt",
    indexes: [
      // Uniqueness is scoped per tenant, not globally: two tenants may both have an "admin".
      { unique: true, fields: ["tenantId", "userName"] },
      { fields: ["tenantId", "email"], unique: true },
      { fields: ["tenantId", "phone"], unique: true },
      { unique: true, fields: ["userId"] },
      { fields: ["tenantId"] },
    ],
  },
);

export default Users;
