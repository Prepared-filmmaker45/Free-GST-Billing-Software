// File-based storage via local Express API server
// All data persists as JSON files in the ./data/ folder

const API = '/api';

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ---- Invoice counter ----
export const getNextInvoiceNumber = async (prefix = 'INV') => {
  const key = `counter_${prefix}`;
  const { value } = await apiFetch(`${API}/meta/${key}`);
  const next = (value || 0) + 1;
  await apiFetch(`${API}/meta/${key}`, { method: 'POST', body: JSON.stringify({ value: next }) });
  const currentYear = new Date().getFullYear();
  const nextYear = (currentYear + 1).toString().slice(-2);
  const padded = String(next).padStart(4, '0');
  return `${prefix}/${currentYear}-${nextYear}/${padded}`;
};

// ---- Bills ----
export const saveBill = async (bill) => {
  return apiFetch(`${API}/bills`, { method: 'POST', body: JSON.stringify(bill) });
};

export const getBill = async (id) => {
  const bills = await getAllBills();
  return bills.find(b => b.id === id) || null;
};

export const getAllBills = async () => {
  return apiFetch(`${API}/bills`);
};

export const deleteBill = async (id) => {
  return apiFetch(`${API}/bills/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Profile ----
export const saveProfile = async (profile) => {
  return apiFetch(`${API}/profile`, { method: 'POST', body: JSON.stringify(profile) });
};

export const getProfile = async () => {
  return apiFetch(`${API}/profile`);
};

// ---- Saved Clients ----
export const saveClient = async (client) => {
  const res = await apiFetch(`${API}/clients`, { method: 'POST', body: JSON.stringify(client) });
  if (res.id) client.id = res.id;
  return client;
};

export const getAllClients = async () => {
  return apiFetch(`${API}/clients`);
};

export const deleteClient = async (id) => {
  return apiFetch(`${API}/clients/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Terms Templates ----
export const getTermsTemplates = async () => {
  return apiFetch(`${API}/templates`);
};

export const saveTermsTemplate = async (template) => {
  const res = await apiFetch(`${API}/templates`, { method: 'POST', body: JSON.stringify(template) });
  if (res.id) template.id = res.id;
  return template;
};

export const deleteTermsTemplate = async (id) => {
  return apiFetch(`${API}/templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Export / Import ----
export const exportAllData = async () => {
  const data = await apiFetch(`${API}/export`);
  return JSON.stringify(data, null, 2);
};

export const importData = async (jsonString) => {
  const data = JSON.parse(jsonString);
  return apiFetch(`${API}/import`, { method: 'POST', body: JSON.stringify(data) });
};
