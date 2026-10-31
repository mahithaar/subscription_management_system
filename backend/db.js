const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseKey && 
  !supabaseUrl.includes('your-project') &&
  !supabaseKey.includes('your-anon')
);

let supabase = null;

if (isSupabaseConfigured) {
  console.log('✅ Connecting to Supabase Cloud Database at:', supabaseUrl);
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.log('⚠️ Supabase credentials not set or using placeholders.');
  console.log('⚡ Using Built-in Zero-Config In-Memory Store for instant hackathon dev/demo!');
}

// In-Memory Database Store as fallback & instant local development
const memoryStore = {
  customers: [],
  products: [],
  plans: [],
  subscriptions: [],
  invoices: [],
  payments: [],
  settings: {
    simulated_date: new Date().toISOString().split('T')[0]
  }
};

module.exports = {
  supabase,
  isSupabaseConfigured,
  memoryStore
};
