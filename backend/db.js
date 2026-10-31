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
    general: {
      currency: "INR",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      companyName: "RecurOS",
      companyEmail: "billing@recuros.io",
      supportEmail: "support@recuros.io"
    },
    billing: {
      autoGenerateInvoices: true,
      invoicePrefix: "INV-2024-",
      nextInvoiceNumber: 1001,
      paymentTermDays: 14,
      taxName: "GST",
      taxRate: 18,
      defaultCurrency: "INR"
    },
    dunning: {
      enabled: true,
      retryIntervals: [3, 7, 14],
      maxRetries: 3,
      cancelAfterMaxRetries: true,
      notifyCustomerOnRetry: true
    },
    webhooks: {
      enabled: true,
      url: "https://api.merchant.com/webhooks/recuros",
      secret: "whsec_live_99214ab8312019c4",
      events: ["invoice.created", "invoice.paid", "payment.failed", "subscription.cancelled"]
    },
    integrations: {
      razorpay: {
        name: "Razorpay",
        connected: true,
        keyId: "rzp_live_k8912hjasd",
        environment: "live"
      },
      stripe: {
        name: "Stripe",
        connected: true,
        publishableKey: "pk_live_51M0abc8921",
        environment: "live"
      },
      cashfree: {
        name: "Cashfree",
        connected: false,
        environment: "sandbox"
      }
    },
    simulated_date: new Date().toISOString().split('T')[0]
  },
  billingRuns: []
};

module.exports = {
  supabase,
  isSupabaseConfigured,
  memoryStore
};
