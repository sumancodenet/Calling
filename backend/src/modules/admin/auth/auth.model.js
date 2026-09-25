import { DataTypes } from "sequelize";
import  sequelize  from "../../../config/db.js";

const Users = sequelize.define(
  "Users",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: true,
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
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    password: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    ReportingUser: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    IsReset: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false
    },
    Status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE", "BLOCKED"),
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
    RefreshToken: {
      type:DataTypes.TEXT
    },
    CreatedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    createdAt: "CreatedAt",
    updatedAt: "UpdatedAt",
  },
);

export default Users;
