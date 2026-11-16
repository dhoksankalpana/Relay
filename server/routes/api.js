import express from 'express';
import { store } from '../db.js';
import { buildSeed } from '../services/seed.js';
import { extractEntities } from '../services/extract.js';
import { CLASSIFICATIONS, copilotAnswer, draftReply, enrichThread, llmConfig } from '../services/ai.js';

export const router = express.Router();

const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ *
 * Metrics + segmentation
 * ------------------------------------------------------------------ */
const SEGMENTS = {
  all: (t) => !t.archived && !t.completed,
  assistant: (t) => !t.archived && !t.completed && t.ai.classification === 'assistant_reply',
  client: (t) => !t.completed && t.ai.classification === 'client_reply',
  no_reply: (t) => !t.completed && t.ai.classification === 'no_reply',
  needs_review: (t) => !t.completed && t.ai.needsReview,
  action: (t) => !t.completed && (t.labels.includes('Action Required') || t.status === 'action_required'),
  waiting: (t) => !t.completed && (t.status === 'waiting' || t.labels.includes('Waiting for Response')),
  meetings: (t) => !t.completed && t.labels.includes('Meetings & Appointments'),
  important: (t) => !t.completed && t.important,
  general: (t) => !t.completed && !t.archived && t.category === 'General' && !t.important,
  archived: (t) => Boolean(t.archived || t.completed),
};

function segmentCounts(threads) {
  const out = {};
  for (const [key, fn] of Object.entries(SEGMENTS)) out[key] = threads.filter(fn).length;
  out.needs_review = threads.filter(SEGMENTS.needs_review).length;
  return out;
}

function metricsFor(threads) {
  const counts = segmentCounts(threads);
  return {
    total: counts.all,
    unread: threads.filter((t) => t.unread && !t.completed).length,
    important: counts.important,
    actionRequired: counts.action,
    waiting: counts.waiting,
    assistantReply: counts.assistant,
    clientReply: counts.client,
    needsReview: counts.needs_review,
    totalIncludingArchived: threads.length,
  };
}

function upcomingMeetings(threads) {
  const items = [];
  threads
    .filter((t) => !t.completed)
    .forEach((t) => {
      (t.extracted?.appointments || []).forEach((a) => {
        items.push({
          ...a,
          threadId: t._id,
          subject: t.subject,
          sender: t.participants.find((p) => p.role === 'counterparty')?.name || t.participants[0]?.name,
          provider: t.provider,
        });
      });
      (t.extracted?.deadlines || []).forEach((d) => {
        items.push({
          id: d.id,
          title: d.label.startsWith('by') ? d.label : `Deadline — ${d.label}`,
          label: d.label,
          start: d.dueDate,
          deadline: true,
          threadId: t._id,
          subject: t.subject,
          sender: t.participants.find((p) => p.role === 'counterparty')?.name || t.participants[0]?.name,
          provider: t.provider,
        });
      });
    });
  return items
    .filter((i) => i.start)
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 8);
}

export function statePayload() {
  const threads = store.visibleThreads().sort(
    (a, b) => new Date(b.messages[b.messages.length - 1].receivedAt) - new Date(a.messages[a.messages.length - 1].receivedAt)
  );
  return {
    threads,
    accounts: store.accounts,
    connectedProviders: store.connectedProviders(),
    metrics: metricsFor(threads),
    segments: segmentCounts(threads),
    upcoming: upcomingMeetings(threads),
    user: {
      assistant: { name: 'Sarah Chen', email: 'sarah.chen@meridianholdings.com', role: 'Executive Assistant', initials: 'SC' },
      client: { name: 'Alex Mercer', email: 'alex.mercer@meridianholdings.com', role: 'CEO, Meridian Holdings', initials: 'AM' },
    },
  };
}

/* ------------------------------------------------------------------ *
 * Core state
 * ------------------------------------------------------------------ */
router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    uptime: Math.round(process.uptime()),
    storage: store.mode,
    dbState: store.dbState,
    ai: llmConfig(),
    threads: store.threads.length,
  });
});

router.get('/state', (_req, res) => {
  res.json({ ...statePayload(), aiStatus: aiStatusPayload() });
});

router.get('/threads', (req, res) => {
  const { segment = 'all', q = '', unread, provider, priority } = req.query;
  const matcher = SEGMENTS[segment] || SEGMENTS.all;
  let threads = store.visibleThreads().filter(matcher);
  if (unread === 'true') threads = threads.filter((t) => t.unread);
  if (provider) threads = threads.filter((t) => t.provider === provider);
  if (priority === 'high') threads = threads.filter((t) => t.priority === 'high' || t.important);
  if (q) {
    const needle = String(q).toLowerCase();
    threads = threads.filter((t) =>
      [t.subject, t.ai.aiSummary, ...t.participants.map((p) => `${p.name} ${p.email}`), ...t.messages.map((m) => m.body)]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }
  res.json({ threads, count: threads.length, segment, metrics: metricsFor(store.visibleThreads()), segments: segmentCounts(store.visibleThreads()) });
});

router.get('/threads/:id', (req, res) => {
  const thread = store.findThread(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  res.json({ thread });
});

router.get('/ai/status', (_req, res) => res.json(aiStatusPayload()));

function aiStatusPayload() {
  const cfg = llmConfig();
  const lastError = store.threads.map((t) => t.ai?.lastError).filter(Boolean).slice(-1)[0] || null;
  return {
    live: cfg.live,
    provider: cfg.live ? cfg.provider : 'built-in',
    model: cfg.live ? cfg.model : 'relay-triage-engine-v2',
    label: cfg.live ? `Live LLM (${cfg.provider} · ${cfg.model})` : 'Simulated AI (deterministic engine)',
    detail: cfg.live
      ? 'Classification, summaries, drafts and copilot answers are produced by the configured LLM.'
      : 'No LLM_API_KEY detected — Relay is running its deterministic context-aware engine. Every AI feature stays functional.',
    lastError,
    storage: store.mode,
  };
}

/* ------------------------------------------------------------------ *
 * Thread mutations
 * ------------------------------------------------------------------ */
function logActivity(thread, type, text) {
  thread.history = thread.history || [];
  thread.history.unshift({ id: uid('act'), type, text, at: nowIso() });
  thread.history = thread.history.slice(0, 25);
}

router.patch('/threads/:id', async (req, res) => {
  const thread = store.findThread(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  const { classification, important, starred, unread, archived, completed, status, priority, note } = req.body;
  const events = [];

  if (classification && classification !== thread.ai.classification) {
    const previous = thread.ai.classification;
    if (!CLASSIFICATIONS[classification]) return res.status(400).json({ error: 'Unknown classification' });
    thread.ai.classification = classification;
    thread.ai.overridden = true;
    thread.ai.needsReview = false;
    thread.ai.overriddenAt = nowIso();
    thread.ai.overriddenFrom = previous;
    thread.ai.overrideNote = note || null;
    events.push(`Reclassified from ${CLASSIFICATIONS[previous].label} to ${CLASSIFICATIONS[classification].label} (manual override)`);
    logActivity(thread, 'reclassify', `Manually reclassified to ${CLASSIFICATIONS[classification].label}${note ? ` — “${note}”` : ''}`);
  }

  if (typeof important === 'boolean') {
    thread.important = important;
    logActivity(thread, 'flag', important ? 'Marked important' : 'Removed important flag');
  }
  if (typeof starred === 'boolean') thread.starred = starred;
  if (typeof unread === 'boolean') {
    thread.unread = unread;
    logActivity(thread, 'read', unread ? 'Marked as unread' : 'Marked as read');
  }
  if (typeof archived === 'boolean') {
    thread.archived = archived;
    if (archived) thread.status = 'archived';
    else if (thread.status === 'archived') thread.status = 'general';
    logActivity(thread, 'archive', archived ? 'Archived the conversation' : 'Restored from archive');
  }
  if (typeof completed === 'boolean') {
    thread.completed = completed;
    if (completed) {
      thread.archived = false;
      thread.status = 'completed';
      thread.unread = false;
      logActivity(thread, 'complete', 'Marked the conversation as completed');
    } else if (thread.status === 'completed') {
      thread.status = 'general';
      logActivity(thread, 'reopen', 'Reopened the conversation');
    }
  }
  if (status) thread.status = status;
  if (priority) thread.priority = priority;

  await store.saveThread(thread);
  res.json({ thread, events, state: statePayload() });
});

router.post('/threads/:id/reclassify', async (req, res) => {
  const thread = store.findThread(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  const before = { ...thread.ai };
  await enrichThread(thread, { reason: 'manual-reevaluation' });
  thread.ai.overridden = false;
  logActivity(
    thread,
    'ai',
    `AI re-evaluated the thread → ${CLASSIFICATIONS[thread.ai.classification].label} (${thread.ai.aiConfidence}% confidence)`
  );
  await store.saveThread(thread);
  res.json({
    thread,
    previous: { classification: before.classification, aiConfidence: before.aiConfidence },
    changed: before.classification !== thread.ai.classification,
    state: statePayload(),
  });
});

router.post('/threads/:id/simulate-reply', async (req, res) => {
  const thread = store.findThread(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  const { body, senderName, senderEmail } = req.body || {};
  const queue = thread.followUps || [];
  const canned = queue.shift();
  const lastCounterparty = thread.participants.find((p) => p.role === 'counterparty') || thread.participants[0];

  const from = canned?.from || {
    name: senderName || lastCounterparty.name,
    email: senderEmail || lastCounterparty.email,
  };
  const text =
    body ||
    canned?.body ||
    `Where does this stand on your side? Happy to jump on a call if that is easier.\n\n${from.name.split(' ')[0]}`;

  const before = thread.ai.classification;
  const message = {
    id: uid('msg'),
    from,
    to: [{ name: 'Sarah Chen', email: 'sarah.chen@meridianholdings.com' }],
    direction: 'inbound',
    body: text.trim(),
    snippet: text.replace(/\s+/g, ' ').trim().slice(0, 140),
    receivedAt: nowIso(),
    simulated: true,
  };

  thread.messages.push(message);
  thread.followUps = queue;
  thread.unread = true;
  thread.completed = false;
  thread.archived = false;
  if (thread.status === 'completed' || thread.status === 'archived') thread.status = 'action_required';
  thread.ai.overridden = false;
  thread.ai.overrideNote = null;
  thread.extracted = extractEntities(thread);
  await enrichThread(thread, { reason: 'incoming-reply' });
  logActivity(
    thread,
    'incoming',
    `Simulated inbound reply from ${from.name} · AI re-evaluated → ${CLASSIFICATIONS[thread.ai.classification].label} (${thread.ai.aiConfidence}%)`
  );
  await store.saveThread(thread);

  res.json({
    thread,
    message,
    previousClassification: before,
    changed: before !== thread.ai.classification,
    state: statePayload(),
  });
});

router.post('/threads/:id/draft', async (req, res) => {
  const thread = store.findThread(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  const tone = req.body?.tone || 'Professional';
  const result = await draftReply(thread, tone);
  thread.draft = { ...result.value, tone, generatedAt: nowIso(), simulated: result.simulated };
  logActivity(thread, 'draft', `AI drafted a ${tone.toLowerCase()} reply${result.simulated ? ' (deterministic engine)' : ''}`);
  await store.saveThread(thread);
  res.json({ thread, draft: thread.draft, simulated: result.simulated, model: aiStatusPayload().model });
});

router.post('/threads/:id/send', async (req, res) => {
  const thread = store.findThread(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  const { body, subject, markCompleted } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'Reply body is required' });

  const recipient = thread.participants.find((p) => p.role === 'counterparty') || thread.participants[0];
  const message = {
    id: uid('msg'),
    from: { name: 'Sarah Chen', email: 'sarah.chen@meridianholdings.com' },
    to: [recipient],
    direction: 'outbound',
    body: body.trim(),
    snippet: body.replace(/\s+/g, ' ').trim().slice(0, 140),
    receivedAt: nowIso(),
    subject: subject || null,
    approvedBy: 'Sarah Chen',
  };
  thread.messages.push(message);
  thread.draft = null;
  thread.unread = false;
  thread.labels = thread.labels.filter((l) => l !== 'Action Required');
  if (markCompleted) {
    thread.completed = true;
    thread.status = 'completed';
    thread.labels = ['Archived / Completed'];
    thread.category = 'Archived / Completed';
  } else {
    thread.status = 'waiting';
    if (!thread.labels.includes('Waiting for Response')) thread.labels.push('Waiting for Response');
    thread.category = 'Waiting for Response';
  }
  thread.ai.needsReview = false;
  await enrichThread(thread, { reason: 'reply-sent' });
  logActivity(thread, 'send', markCompleted ? 'Approved & sent reply — thread completed' : 'Approved & sent reply — now waiting for response');
  await store.saveThread(thread);
  res.json({ thread, message, state: statePayload() });
});

/* Client-facing actions (synchronised with the assistant dashboard) */
router.post('/threads/:id/client-action', async (req, res) => {
  const thread = store.findThread(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  const { action, note } = req.body || {};

  if (action === 'handled') {
    thread.completed = true;
    thread.archived = false;
    thread.status = 'completed';
    thread.unread = false;
    thread.labels = ['Archived / Completed'];
    thread.category = 'Archived / Completed';
    thread.clientAction = { type: 'handled', note: note || null, at: nowIso() };
    logActivity(thread, 'client', 'Alex marked this as handled from the client view');
    thread.pendingAssistantNotice = {
      text: `Alex handled “${thread.subject}” from the client view — removed from his queue.`,
      at: nowIso(),
    };
  } else if (action === 'reply') {
    if (!note || !note.trim()) return res.status(400).json({ error: 'Your reply cannot be empty' });
    const recipient = thread.participants.find((p) => p.role === 'counterparty') || thread.participants[0];
    const message = {
      id: uid('msg'),
      from: { name: 'Alex Mercer', email: 'alex.mercer@meridianholdings.com' },
      to: [recipient],
      direction: 'outbound',
      body: note.trim(),
      snippet: note.replace(/\s+/g, ' ').trim().slice(0, 140),
      receivedAt: nowIso(),
      approvedBy: 'Alex Mercer',
      clientAuthored: true,
    };
    thread.messages.push(message);
    thread.completed = true;
    thread.archived = false;
    thread.status = 'completed';
    thread.unread = false;
    thread.labels = ['Archived / Completed'];
    thread.category = 'Archived / Completed';
    thread.clientAction = { type: 'reply', note: note.trim(), at: nowIso() };
    thread.pendingAssistantNotice = {
      text: `Alex replied personally to “${thread.subject}” from the client view — thread completed.`,
      at: nowIso(),
    };
    logActivity(thread, 'client', 'Alex sent a personal reply from the client view — thread completed');
  } else if (action === 'delegate') {
    const previous = thread.ai.classification;
    thread.ai.classification = 'assistant_reply';
    thread.ai.overridden = true;
    thread.ai.needsReview = false;
    thread.ai.overrideNote = note || 'Delegated back to the assistant by Alex';
    thread.ai.overriddenAt = nowIso();
    thread.status = 'action_required';
    thread.completed = false;
    thread.important = true;
    thread.priority = 'high';
    thread.labels = Array.from(new Set([...thread.labels.filter((l) => l !== 'Archived / Completed'), 'Action Required']));
    thread.category = 'Action Required';
    thread.clientAction = { type: 'delegate', note: note || null, at: nowIso() };
    thread.pendingAssistantNotice = {
      text: `Alex delegated “${thread.subject}” back to you${note ? ` — “${note}”` : ''}.`,
      at: nowIso(),
    };
    logActivity(thread, 'client', `Alex delegated this back to the assistant${note ? ` — “${note}”` : ''} (was ${CLASSIFICATIONS[previous].label})`);
  } else {
    return res.status(400).json({ error: 'action must be "handled", "delegate" or "reply"' });
  }

  await store.saveThread(thread);
  res.json({ thread, state: statePayload() });
});

router.post('/threads/:id/ack-notice', async (req, res) => {
  const thread = store.findThread(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  thread.pendingAssistantNotice = null;
  await store.saveThread(thread);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ *
 * Copilot
 * ------------------------------------------------------------------ */
router.post('/ai/chat', async (req, res) => {
  const { message, threadId } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'message is required' });
  const threads = store.visibleThreads();
  const currentThread = threadId ? store.findThread(threadId) : null;
  const result = await copilotAnswer({ message: message.trim(), threads, currentThread });
  res.json({
    ...result.value,
    simulated: result.simulated,
    error: result.error,
    model: aiStatusPayload().model,
    at: nowIso(),
  });
});

/* ------------------------------------------------------------------ *
 * Accounts / simulated OAuth
 * ------------------------------------------------------------------ */
const PROVIDERS = {
  gmail: { provider: 'gmail', label: 'Google Workspace / Gmail', scopes: ['Read email', 'Organize (labels, archive)', 'Draft replies'] },
  outlook: { provider: 'outlook', label: 'Microsoft 365 / Outlook', scopes: ['Read email', 'Organize (folders, archive)', 'Draft replies'] },
};

router.get('/providers', (_req, res) => res.json({ providers: Object.values(PROVIDERS), accounts: store.accounts }));

router.post('/accounts/connect', async (req, res) => {
  const provider = req.body?.provider;
  if (!PROVIDERS[provider]) return res.status(400).json({ error: 'Unsupported provider' });

  const account = store.accounts.find((a) => a.provider === provider);
  const pendingCount = store.threads.filter((t) => t.provider === provider && !store.connectedProviders().includes(provider)).length;

  if (account) {
    account.connected = true;
    account.status = 'connected';
    account.scopes = PROVIDERS[provider].scopes;
    account.lastSyncedAt = nowIso();
    await store.saveAccount(account);
  }

  const threads = store.visibleThreads();
  for (const t of threads) {
    if (!t.extracted?.processedAt) t.extracted = extractEntities(t);
  }

  res.json({
    ok: true,
    account,
    fetched: pendingCount,
    steps: [
      'Handshake with identity provider',
      'Authorising scopes: read, organize, draft',
      `Fetching threads from ${PROVIDERS[provider].label}…`,
      'Running AI Reply Responsibility Classifier…',
      'Extracting meetings, deadlines and action items…',
    ],
    message: `${pendingCount} threads imported and triaged from ${PROVIDERS[provider].label}.`,
    state: statePayload(),
  });
});

router.post('/accounts/:id/disconnect', async (req, res) => {
  const account = store.accounts.find((a) => a._id === req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  account.connected = false;
  account.status = 'disconnected';
  account.scopes = [];
  account.lastSyncedAt = null;
  await store.saveAccount(account);
  res.json({ ok: true, account, state: statePayload() });
});

router.get('/accounts/refresh', (_req, res) => res.json({ accounts: store.accounts }));

router.post('/accounts/:id/sync', async (req, res) => {
  const account = store.accounts.find((a) => a._id === req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  if (!account.connected) return res.status(400).json({ error: 'Account is not connected' });

  const before = account.lastSyncedAt;
  account.lastSyncedAt = nowIso();
  account.syncCount = (account.syncCount || 0) + 1;
  await store.saveAccount(account);

  const checked = store.threads.filter((t) => t.provider === account.provider).length;
  res.json({
    ok: true,
    account,
    checked,
    newMessages: 0,
    previousSync: before,
    message: `${checked} threads checked · no new mail (inbox is up to date)`,
    state: statePayload(),
  });
});

/* ------------------------------------------------------------------ *
 * Dataset utilities
 * ------------------------------------------------------------------ */
router.post('/seed/reset', async (_req, res) => {
  const { threads, accounts } = buildSeed();
  await store.replaceAll({ threads, accounts });
  res.json({ ok: true, message: 'Dataset restored to its seeded state.', state: statePayload() });
});

export { metricsFor, segmentCounts, upcomingMeetings };
