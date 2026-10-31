const express = require('express');
const router = express.Router();
const { memoryStore } = require('../db');

// 1. Get current settings
router.get('/', (req, res) => {
  return res.json(memoryStore.settings);
});

// 2. Update settings (SettingsView.jsx save changes)
router.put('/', (req, res) => {
  const updates = req.body;

  // Merge updates deeply into memoryStore.settings
  if (updates.general) {
    memoryStore.settings.general = { ...memoryStore.settings.general, ...updates.general };
  }
  if (updates.billing) {
    memoryStore.settings.billing = { ...memoryStore.settings.billing, ...updates.billing };
  }
  if (updates.dunning) {
    memoryStore.settings.dunning = { ...memoryStore.settings.dunning, ...updates.dunning };
  }
  if (updates.webhooks) {
    memoryStore.settings.webhooks = { ...memoryStore.settings.webhooks, ...updates.webhooks };
  }
  if (updates.integrations) {
    memoryStore.settings.integrations = { ...memoryStore.settings.integrations, ...updates.integrations };
  }

  // Also support flat updates (e.g. currency: 'USD')
  if (updates.currency) {
    memoryStore.settings.general.currency = updates.currency;
    memoryStore.settings.general.currencySymbol = 
      updates.currency === 'USD' ? '$' : (updates.currency === 'EUR' ? '€' : '₹');
  }

  console.log(`⚙️ [Settings] System settings updated: Currency=${memoryStore.settings.general.currency}, Dunning=${memoryStore.settings.dunning.enabled}`);
  return res.json({
    success: true,
    message: 'Settings saved successfully',
    settings: memoryStore.settings
  });
});

module.exports = router;
