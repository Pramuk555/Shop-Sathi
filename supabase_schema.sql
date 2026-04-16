-- Supabase Schema for ShopSaathi PWA
-- Paste this into the Supabase SQL Editor (https://app.supabase.com)

-- 1. Shop Profiles
CREATE TABLE IF NOT EXISTS shop_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shopName TEXT,
  shopAddress TEXT,
  shopPhone TEXT,
  shopLogo TEXT,
  gstNumber TEXT,
  gstEnabled BOOLEAN DEFAULT FALSE,
  upiId TEXT,
  last_bill_number BIGINT DEFAULT 1000,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE shop_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own shop profile"
  ON shop_profiles FOR ALL
  USING (auth.uid() = user_id);

-- 2. Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own categories"
  ON categories FOR ALL
  USING (auth.uid() = user_id);

-- 3. Products (Inventory)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  categoryId UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  scientificName TEXT,
  sellingPrice NUMERIC DEFAULT 0,
  purchasePrice NUMERIC DEFAULT 0,
  stock NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  lowStockAlert NUMERIC DEFAULT 5,
  image TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own products"
  ON products FOR ALL
  USING (auth.uid() = user_id);

-- 4. Bills
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  billNumber BIGINT NOT NULL,
  customerName TEXT,
  customerPhone TEXT,
  isUdhar BOOLEAN DEFAULT FALSE,
  items JSONB NOT NULL,
  subtotal NUMERIC DEFAULT 0,
  gst NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  profit NUMERIC DEFAULT 0,
  date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own bills"
  ON bills FOR ALL
  USING (auth.uid() = user_id);

-- 5. Udhar (Credit Tracking)
CREATE TABLE IF NOT EXISTS udhar_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('receive', 'pay')),
  name TEXT NOT NULL,
  phone TEXT,
  amount NUMERIC DEFAULT 0,
  paidAmount NUMERIC DEFAULT 0,
  remainingAmount NUMERIC DEFAULT 0,
  description TEXT,
  date TEXT, -- Stored as string to match existing code logic but should ideally be timestamptz
  status TEXT DEFAULT 'pending',
  payments JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE udhar_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own udhar entries"
  ON udhar_list FOR ALL
  USING (auth.uid() = user_id);

-- 6. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_udhar_user_id ON udhar_list(user_id);
