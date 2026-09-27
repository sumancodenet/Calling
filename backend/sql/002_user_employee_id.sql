-- Adds employeeId to Users, unique per tenant.
-- MySQL permits many NULLs in a unique index, so users without an employeeId
-- do not collide with each other.
--
-- Apply with:  node scripts/apply-sql.js sql/002_user_employee_id.sql

ALTER TABLE `Users`
  ADD COLUMN `employeeId` VARCHAR(50) NULL AFTER `phone`;

CREATE UNIQUE INDEX `users_tenant_employee_id` ON `Users` (`tenantId`, `employeeId`);
