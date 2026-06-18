-- ============================================================
-- ShopSaathi — SAFE MIGRATIONS (run these on live database)
-- These use ADD COLUMN IF NOT EXISTS — zero data loss, safe to
-- run multiple times. Add new columns here, never in schema.sql
-- ============================================================

-- v2: Payment mode per bill + GST rate setting
ALTER TABLE bills ADD COLUMN IF NOT EXISTS "paymentMode" TEXT DEFAULT 'cash';
ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS "gstRate" NUMERIC DEFAULT 18;
