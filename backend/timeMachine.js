const { supabase, isSupabaseConfigured, memoryStore } = require('./db');

const timeMachine = {
  async getCurrentDate() {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'simulated_date')
        .maybeSingle();

      if (error || !data) {
        return new Date().toISOString().split('T')[0];
      }
      return data.value;
    }

    if (!memoryStore.settings.simulated_date) {
      memoryStore.settings.simulated_date = new Date().toISOString().split('T')[0];
    }
    return memoryStore.settings.simulated_date;
  },

  async advanceDays(days = 30) {
    const current = await this.getCurrentDate();
    const currentDateObj = new Date(current);
    currentDateObj.setDate(currentDateObj.getDate() + Number(days));
    const nextDate = currentDateObj.toISOString().split('T')[0];

    if (isSupabaseConfigured) {
      await supabase
        .from('system_settings')
        .upsert({ key: 'simulated_date', value: nextDate });
    } else {
      memoryStore.settings.simulated_date = nextDate;
    }

    console.log(`⏱️ [Time Machine] Clock moved forward by ${days} days -> New virtual date: ${nextDate}`);
    return nextDate;
  },

  async setDate(targetDate) {
    if (isSupabaseConfigured) {
      await supabase
        .from('system_settings')
        .upsert({ key: 'simulated_date', value: targetDate });
    } else {
      memoryStore.settings.simulated_date = targetDate;
    }
    return targetDate;
  },

  async reset() {
    const realToday = new Date().toISOString().split('T')[0];
    if (isSupabaseConfigured) {
      await supabase
        .from('system_settings')
        .upsert({ key: 'simulated_date', value: realToday });
    } else {
      memoryStore.settings.simulated_date = realToday;
    }
    console.log(`⏱️ [Time Machine] Clock reset to real date: ${realToday}`);
    return realToday;
  }
};

module.exports = timeMachine;
