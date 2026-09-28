-- Promotes city to a first-class column.
--
-- Until now it was only caught by the "anything else goes in extra JSON" path,
-- which made it impossible to filter or group leads by city. The upload mapping
-- step now treats it as a mappable field alongside name, phone and email.
--
-- Apply with:  node scripts/apply-sql.js sql/005_lead_city.sql

ALTER TABLE `CampaignLeads`
  ADD COLUMN `city` VARCHAR(120) NULL AFTER `email`;

CREATE INDEX `campaign_leads_city` ON `CampaignLeads` (`tenantId`, `city`);
