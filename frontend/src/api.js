async function req(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) throw new Error((body && body.error) || `Request failed (${res.status})`);
  return body;
}

const json = (method) => (url, data) =>
  req(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

const post = json('POST');
const put = json('PUT');

export const api = {
  httpsPort: () => req('/api/https-port'),
  products: (q = '') => req(`/api/products${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createProduct: (form) => req('/api/products', { method: 'POST', body: form }),
  updateProduct: (id, form) => req(`/api/products/${id}`, { method: 'PUT', body: form }),
  deleteProduct: (id) => req(`/api/products/${id}`, { method: 'DELETE' }),

  orders: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v)
    ).toString();
    return req(`/api/orders${qs ? `?${qs}` : ''}`);
  },
  order: (id) => req(`/api/orders/${id}`),
  nextOrderNo: () => req('/api/orders/next-no'),
  ordersByDate: () => req('/api/orders/by-date'),
  customers: () => req('/api/customers'),
  createOrder: (data) => post('/api/orders', data),
  updateOrder: (id, data) => put(`/api/orders/${id}`, data),
  completeOrder: (id, completed) => post(`/api/orders/${id}/complete`, { completed }),
  deleteOrder: (id) => req(`/api/orders/${id}`, { method: 'DELETE' }),

  settings: () => req('/api/settings'),
  saveSettings: (data) => put('/api/settings', data),
  clearData: (confirm) => post('/api/settings/clear-data', { confirm }),
  backup: () => post('/api/settings/backup', {}),
};
