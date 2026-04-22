import { supabase } from '../supabase';

/**
 * Supabase Service Layer for ShopSaathi
 * All data is scoped to the logged-in user via Row Level Security (RLS).
 */

// --- Shop Profile ---

export const getShopProfile = (uid, callback) => {
  // Initial fetch
  supabase
    .from('shop_profiles')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle()
    .then(({ data }) => callback(data));

  // Realtime subscription
  const subscription = supabase
    .channel(`shop_profiles:${uid}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'shop_profiles',
      filter: `user_id=eq.${uid}`
    }, (payload) => {
      callback(payload.new || null);
    })
    .subscribe();

  return () => supabase.removeChannel(subscription);
};

export const updateShopProfile = async (uid, details) => {
  return supabase
    .from('shop_profiles')
    .upsert({ user_id: uid, ...details, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
};

export const getNextBillNumber = async (uid) => {
  const { data } = await supabase
    .from('shop_profiles')
    .select('last_bill_number')
    .eq('user_id', uid)
    .maybeSingle();
  return (data?.last_bill_number || 1000) + 1;
};

export const incrementBillNumber = async (uid) => {
  const next = await getNextBillNumber(uid);
  return supabase
    .from('shop_profiles')
    .upsert({ user_id: uid, last_bill_number: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
};

// --- Inventory (Products) ---

export const subscribeInventory = (uid, callback) => {
  supabase
    .from('products')
    .select('*')
    .eq('user_id', uid)
    .then(({ data }) => callback(data || []));

  const subscription = supabase
    .channel(`products:${uid}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'products',
      filter: `user_id=eq.${uid}`
    }, async () => {
      const { data } = await supabase.from('products').select('*').eq('user_id', uid);
      callback(data || []);
    })
    .subscribe();

  return () => supabase.removeChannel(subscription);
};

export const addProduct = async (uid, product) => {
  const { id, ...productData } = product;
  const { error } = await supabase.from('products').insert({ user_id: uid, ...productData });
  if (error) throw error;
};

export const updateProduct = async (uid, productId, updates) => {
  const { error } = await supabase
    .from('products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .eq('user_id', uid);
  if (error) throw error;
};

export const deleteProduct = async (uid, productId) => {
  const { error } = await supabase.from('products').delete().eq('id', productId).eq('user_id', uid);
  if (error) throw error;
};

// --- Categories ---

export const subscribeCategories = (uid, callback) => {
  supabase
    .from('categories')
    .select('*')
    .eq('user_id', uid)
    .then(({ data }) => callback(data || []));

  const subscription = supabase
    .channel(`categories:${uid}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'categories',
      filter: `user_id=eq.${uid}`
    }, async () => {
      const { data } = await supabase.from('categories').select('*').eq('user_id', uid);
      callback(data || []);
    })
    .subscribe();

  return () => supabase.removeChannel(subscription);
};

export const addCategory = async (uid, category) => {
  const { id, ...categoryData } = category;
  const { error } = await supabase.from('categories').insert({ user_id: uid, ...categoryData });
  if (error) throw error;
};

export const deleteCategory = async (uid, categoryId) => {
  const { error } = await supabase.from('categories').delete().eq('id', categoryId).eq('user_id', uid);
  if (error) throw error;
};

// --- Bills ---

export const subscribeBills = (uid, callback) => {
  supabase
    .from('bills')
    .select('*')
    .eq('user_id', uid)
    .order('date', { ascending: false })
    .then(({ data }) => callback(data || []));

  const subscription = supabase
    .channel(`bills:${uid}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'bills',
      filter: `user_id=eq.${uid}`
    }, async () => {
      const { data } = await supabase
        .from('bills')
        .select('*')
        .eq('user_id', uid)
        .order('date', { ascending: false });
      callback(data || []);
    })
    .subscribe();

  return () => supabase.removeChannel(subscription);
};

export const addBill = async (uid, bill) => {
  const { error } = await supabase.from('bills').insert({ user_id: uid, ...bill });
  if (error) throw error;
};

// --- Udhar (Credit Tracking) ---

export const subscribeUdhar = (uid, callback) => {
  supabase
    .from('udhar_list')
    .select('*')
    .eq('user_id', uid)
    .then(({ data }) => callback(data || []));

  const subscription = supabase
    .channel(`udhar_list:${uid}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'udhar_list',
      filter: `user_id=eq.${uid}`
    }, async () => {
      const { data } = await supabase.from('udhar_list').select('*').eq('user_id', uid);
      callback(data || []);
    })
    .subscribe();

  return () => supabase.removeChannel(subscription);
};

export const addUdhar = async (uid, udharEntry) => {
  const { error } = await supabase.from('udhar_list').insert({ user_id: uid, ...udharEntry });
  if (error) throw error;
};

export const updateUdhar = async (uid, udharId, updates) => {
  const { error } = await supabase
    .from('udhar_list')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', udharId)
    .eq('user_id', uid);
  if (error) throw error;
};

export const deleteUdhar = async (uid, udharId) => {
  const { error } = await supabase.from('udhar_list').delete().eq('id', udharId).eq('user_id', uid);
  if (error) throw error;
};
