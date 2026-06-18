-- ============================================================
-- ShopSaathi — SAFE MIGRATIONS (run these on live database)
-- These use ADD COLUMN IF NOT EXISTS — zero data loss, safe to
-- run multiple times. Add new columns here, never in schema.sql
-- ============================================================

-- v2: Payment mode per bill + GST rate setting
ALTER TABLE bills ADD COLUMN IF NOT EXISTS "paymentMode" TEXT DEFAULT 'cash';
ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS "gstRate" NUMERIC DEFAULT 18;

-- v3: GST breakdown stored per bill
ALTER TABLE bills ADD COLUMN IF NOT EXISTS "cgst" NUMERIC DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS "sgst" NUMERIC DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS "gstRate" NUMERIC DEFAULT 0;

-- v3: Atomic bill number increment RPC
-- Run this in Supabase SQL editor to enable race-free bill numbering
CREATE OR REPLACE FUNCTION increment_bill_number(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  UPDATE shop_profiles
  SET last_bill_number = COALESCE(last_bill_number, 1000) + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING last_bill_number INTO v_next;

  IF NOT FOUND THEN
    INSERT INTO shop_profiles (user_id, last_bill_number, updated_at)
    VALUES (p_user_id, 1001, NOW())
    RETURNING last_bill_number INTO v_next;
  END IF;

  RETURN v_next;
END;
$$;
