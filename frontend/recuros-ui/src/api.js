const API_BASE = '/api/v1';

let cachedToken = sessionStorage.getItem('recuros_token') || null;

export async function getAuthToken() {
  if (cachedToken) return cachedToken;
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@brightloop.io', password: 'Password123!' })
    });
    if (res.ok) {
      const data = await res.json();
      cachedToken = data.access_token;
      sessionStorage.setItem('recuros_token', cachedToken);
      return cachedToken;
    }
  } catch (err) {
    console.warn('Auth error:', err);
  }
  return null;
}

export async function apiRequest(endpoint, options = {}) {
  const token = await getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}
