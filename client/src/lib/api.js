const BASE = '/api';

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message = payload?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return payload;
}

export const api = {
  health: () => request('/health'),
  state: () => request('/state'),
  aiStatus: () => request('/ai/status'),
  providers: () => request('/providers'),

  thread: (id) => request(`/threads/${id}`),
  patchThread: (id, body) => request(`/threads/${id}`, { method: 'PATCH', body }),
  reclassify: (id) => request(`/threads/${id}/reclassify`, { method: 'POST' }),
  simulateReply: (id, body = {}) => request(`/threads/${id}/simulate-reply`, { method: 'POST', body }),
  draft: (id, tone) => request(`/threads/${id}/draft`, { method: 'POST', body: { tone } }),
  send: (id, body) => request(`/threads/${id}/send`, { method: 'POST', body }),
  clientAction: (id, action, note) => request(`/threads/${id}/client-action`, { method: 'POST', body: { action, note } }),
  ackNotice: (id) => request(`/threads/${id}/ack-notice`, { method: 'POST' }),

  chat: (message, threadId) => request('/ai/chat', { method: 'POST', body: { message, threadId } }),

  connect: (provider) => request('/accounts/connect', { method: 'POST', body: { provider } }),
  disconnect: (id) => request(`/accounts/${id}/disconnect`, { method: 'POST' }),
  sync: (id) => request(`/accounts/${id}/sync`, { method: 'POST' }),
  reset: () => request('/seed/reset', { method: 'POST' }),
};
