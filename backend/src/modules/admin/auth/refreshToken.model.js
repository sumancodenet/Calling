import { DataTypes } from "sequelize";
import sequelize from "../../../config/sequelize.js";

const RefreshTokens = sequelize.define(
  "RefreshTokens",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Rotating tokens share a familyId; presenting a revoked token revokes the whole family.
    familyId: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    tokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    revokedReason: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
  },
  {
    tableName: "RefreshTokens",
    timestamps: true,
    createdAt: "CreatedAt",
    updatedAt: "UpdatedAt",
    indexes: [
      { unique: true, fields: ["tokenHash"] },
      { fields: ["userId"] },
      { fields: ["familyId"] },
      { fields: ["expiresAt"] },
    ],
  },
);

export default RefreshTokens;
