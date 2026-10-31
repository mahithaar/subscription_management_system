const { supabase, isSupabaseConfigured, memoryStore } = require('./db');

class TimeMachine {
  constructor() {
    this.currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }

  async getCurrentDate() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'simulated_date')
          .single();

        if (data && data.value && data.value.date) {
          this.currentDate = data.value.date;
          return this.currentDate;
        }
      } catch (err) {
        console.warn('Could not read simulated_date from Supabase, using local state');
      }
    }
    return this.currentDate;
  }

  async setDate(newDateStr) {
    this.currentDate = newDateStr;
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('system_settings')
          .upsert({ key: 'simulated_date', value: { date: newDateStr } });
      } catch (err) {
        console.error('Failed to persist simulated date to Supabase:', err);
      }
    }
    return this.currentDate;
  }

  async advanceDays(days = 30) {
    const cur = await this.getCurrentDate();
    const d = new Date(cur);
    d.setDate(d.getDate() + days);
    const nextDate = d.toISOString().split('T')[0];
    return await this.setDate(nextDate);
  }

  async reset() {
    const today = new Date().toISOString().split('T')[0];
    return await this.setDate(today);
  }
}

const timeMachineInstance = new TimeMachine();
module.exports = timeMachineInstance;
