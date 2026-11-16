import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api } from '../lib/api';
import { listStamp } from '../lib/ui';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const LS_USER = 'relay.session.user';
const LS_ROLE = 'relay.session.role';

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const emptyChips = { unread: false, highPriority: false, gmail: false, outlook: false };

export function AppProvider({ children }) {
  const [session, setSession] = useState(() => readJson(LS_USER, null));
  const [role, setRole] = useState(() => localStorage.getItem(LS_ROLE) || 'assistant');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState(null);
  const [busy, setBusy] = useState({});
  const [toasts, setToasts] = useState([]);
  const [ui, setUi] = useState({
    segment: 'all',
    query: '',
    chips: { ...emptyChips },
    selectedId: null,
    mobilePane: 'list',
    copilotOpen: false,
    copilotSeed: null,
    wizardOpen: false,
    wizardProvider: 'outlook',
    accountsOpen: false,
  });

  const ackedNotices = useRef(new Set());
  const toastSeq = useRef(0);

  /* ------------------------------------------------------------------ *
   * Toasts
   * ------------------------------------------------------------------ */
  const dismissToast = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (title, options = {}) => {
      const id = `toast-${(toastSeq.current += 1)}`;
      const toast = { id, title, type: options.type || 'success', detail: options.detail || null };
      setToasts((list) => [...list.slice(-3), toast]);
      if (options.sticky !== true) {
        setTimeout(() => dismissToast(id), options.duration || 4600);
      }
      return id;
    },
    [dismissToast]
  );

  const setLoadingFlag = useCallback((key, value) => {
    setBusy((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyState = useCallback((payload) => {
    if (!payload) return;
    setData((prev) => ({ ...(prev || {}), ...payload }));
  }, []);

  /* ------------------------------------------------------------------ *
   * Boot + session
   * ------------------------------------------------------------------ */
  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const payload = await api.state();
        setData(payload);
        setBootError(null);
        return payload;
      } catch (err) {
        setBootError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    (user) => {
      setSession(user);
      localStorage.setItem(LS_USER, JSON.stringify(user));
    },
    []
  );

  const logout = useCallback(() => {
    setSession(null);
    localStorage.removeItem(LS_USER);
  }, []);

  const switchRole = useCallback((next) => {
    setRole(next);
    localStorage.setItem(LS_ROLE, next);
    setUi((prev) => ({ ...prev, selectedId: null, mobilePane: 'list', segment: 'all', query: '', chips: { ...emptyChips } }));
  }, []);

  const setSegment = useCallback((segment) => {
    setUi((prev) => ({ ...prev, segment, mobilePane: 'list', selectedId: null }));
  }, []);

  const setQuery = useCallback((query) => setUi((prev) => ({ ...prev, query })), []);
  const toggleChip = useCallback(
    (chip) => setUi((prev) => ({ ...prev, chips: { ...prev.chips, [chip]: !prev.chips[chip] } })),
    []
  );
  const clearFilters = useCallback(
    () => setUi((prev) => ({ ...prev, query: '', chips: { ...emptyChips } })),
    []
  );

  const selectThread = useCallback((id) => {
    setUi((prev) => ({ ...prev, selectedId: id, mobilePane: id ? 'detail' : 'list' }));
  }, []);

  const setMobilePane = useCallback((pane) => setUi((prev) => ({ ...prev, mobilePane: pane })), []);
  const setCopilotOpen = useCallback(
    (open, seed = null) => setUi((prev) => ({ ...prev, copilotOpen: open, copilotSeed: seed })),
    []
  );
  const openWizard = useCallback(
    (provider = 'outlook') => setUi((prev) => ({ ...prev, wizardOpen: true, wizardProvider: provider })),
    []
  );
  const closeWizard = useCallback(() => setUi((prev) => ({ ...prev, wizardOpen: false })), []);
  const setAccountsOpen = useCallback((open) => setUi((prev) => ({ ...prev, accountsOpen: open })), []);

  /* ------------------------------------------------------------------ *
   * Thread mutations — every one returns a toast + refreshed state
   * ------------------------------------------------------------------ */
  const runThreadAction = useCallback(
    async (key, fn, { success, failure = 'Something went wrong' } = {}) => {
      setLoadingFlag(key, true);
      try {
        const result = await fn();
        if (result?.state) applyState(result.state);
        else await refresh({ silent: true });
        if (success) {
          const title = typeof success === 'function' ? success(result) : success;
          if (title) notify(title, { type: 'success' });
        }
        return result;
      } catch (err) {
        notify(failure, { type: 'error', detail: err.message });
        return null;
      } finally {
        setLoadingFlag(key, false);
      }
    },
    [applyState, notify, refresh, setLoadingFlag]
  );

  const markRead = useCallback(
    async (threadId, unread = false) => {
      const result = await runThreadAction(`read-${threadId}`, () => api.patchThread(threadId, { unread }), {
        success: unread ? 'Marked as unread' : 'Marked as read',
      });
      return result;
    },
    [runThreadAction]
  );

  const overrideClassification = useCallback(
    async (threadId, classification, note) => {
      const result = await runThreadAction(`classify-${threadId}`, () => api.patchThread(threadId, { classification, note }), {
        success: (r) => `Classification overridden · ${r?.events?.[0] || 'updated'} · “Manually Overridden” flag applied`,
      });
      return result;
    },
    [runThreadAction]
  );

  const reclassifyWithAi = useCallback(
    async (threadId) => {
      const result = await runThreadAction('reclassify', () => api.reclassify(threadId), {
        success: (r) =>
          r?.changed
            ? `AI re-evaluated the thread — now ${r.thread.ai.classification.replace('_', ' ')} at ${r.thread.ai.aiConfidence}%`
            : `AI re-evaluated the thread — responsibility unchanged (${r?.thread?.ai?.aiConfidence}% confidence)`,
      });
      return result;
    },
    [runThreadAction]
  );

  const simulateReply = useCallback(
    async (threadId, body) => {
      const result = await runThreadAction('simulate', () => api.simulateReply(threadId, body ? { body } : {}), {
        success: (r) => {
          const label = r?.thread?.ai?.classification?.replace('_', ' ') || '';
          return r?.changed
            ? `New inbound reply injected — AI moved the thread to ${label} (${r.thread.ai.aiConfidence}% confidence)`
            : `New inbound reply injected — AI kept this at ${label} (${r?.thread?.ai?.aiConfidence}% confidence)`;
        },
        failure: 'Could not simulate the incoming reply',
      });
      return result;
    },
    [runThreadAction]
  );

  const generateDraft = useCallback(
    async (threadId, tone) => {
      const result = await runThreadAction('draft', () => api.draft(threadId, tone), {
        success: (r) => `AI drafted a ${tone.toLowerCase()} reply${r?.simulated ? ' (deterministic engine)' : ` via ${r?.model}`}`,
        failure: 'Draft generation failed',
      });
      return result;
    },
    [runThreadAction]
  );

  const sendReply = useCallback(
    async (threadId, { body, subject, markCompleted }) => {
      const result = await runThreadAction('send', () => api.send(threadId, { body, subject, markCompleted }), {
        success: markCompleted
          ? 'Reply approved & sent — conversation marked completed'
          : 'Reply approved & sent — now waiting for a response',
        failure: 'Sending failed',
      });
      return result;
    },
    [runThreadAction]
  );

  const toggleImportant = useCallback(
    async (threadId, important) => {
      const result = await runThreadAction(`important-${threadId}`, () => api.patchThread(threadId, { important }), {
        success: important ? 'Marked as important' : 'Removed the important flag',
      });
      return result;
    },
    [runThreadAction]
  );

  const archiveThread = useCallback(
    async (threadId, archived = true) => {
      const result = await runThreadAction(`archive-${threadId}`, () => api.patchThread(threadId, { archived }), {
        success: archived ? 'Conversation archived' : 'Conversation restored',
      });
      return result;
    },
    [runThreadAction]
  );

  const completeThread = useCallback(
    async (threadId, completed = true) => {
      const result = await runThreadAction(`complete-${threadId}`, () => api.patchThread(threadId, { completed }), {
        success: completed ? 'Marked as completed — filed under Archived / Completed' : 'Conversation reopened',
      });
      return result;
    },
    [runThreadAction]
  );

  /* Client-facing actions (kept in sync with the assistant dashboard) */
  const clientAction = useCallback(
    async (threadId, action, note) => {
      const result = await runThreadAction(`client-${threadId}`, () => api.clientAction(threadId, action, note), {
        success: () =>
          action === 'handled'
            ? 'Marked as handled — Sarah’s dashboard updated instantly'
            : action === 'reply'
              ? 'Your reply was sent — Sarah’s dashboard marked the thread completed'
              : 'Delegated to Sarah — it is now in her priority queue',
        failure: 'Could not update the thread',
      });
      return result;
    },
    [runThreadAction]
  );

  const connectProvider = useCallback(
    async (provider) => {
      const result = await runThreadAction('connect', () => api.connect(provider), {
        success: (r) => r?.message || 'Mailbox connected',
        failure: 'Connection failed',
      });
      return result;
    },
    [runThreadAction]
  );

  const disconnectAccount = useCallback(
    async (accountId, label) => {
      const result = await runThreadAction('disconnect', () => api.disconnect(accountId), {
        success: `${label} disconnected — its threads are hidden until you reconnect`,
      });
      return result;
    },
    [runThreadAction]
  );

  const syncAccount = useCallback(
    async (accountId) => {
      const result = await runThreadAction('sync', () => api.sync(accountId), {
        success: (r) => r?.message || 'Mailbox synced',
        failure: 'Sync failed',
      });
      return result;
    },
    [runThreadAction]
  );

  const resetDataset = useCallback(async () => {
    const result = await runThreadAction('reset', () => api.reset(), {
      success: 'Demo dataset restored to its seeded state',
      failure: 'Reset failed',
    });
    if (result) {
      setUi((prev) => ({ ...prev, segment: 'all', query: '', chips: { ...emptyChips }, selectedId: null }));
    }
    return result;
  }, [runThreadAction]);

  const askCopilot = useCallback(
    async (message, threadId) => {
      setLoadingFlag('chat', true);
      try {
        const answer = await api.chat(message, threadId);
        return answer;
      } catch (err) {
        notify('The copilot could not answer that', { type: 'error', detail: err.message });
        return null;
      } finally {
        setLoadingFlag('chat', false);
      }
    },
    [notify, setLoadingFlag]
  );

  /* ------------------------------------------------------------------ *
   * Assistant notices pushed over from the client view
   * ------------------------------------------------------------------ */
  useEffect(() => {
    if (!data?.threads || role !== 'assistant') return;
    const pending = data.threads.filter((t) => t.pendingAssistantNotice && !ackedNotices.current.has(t._id));
    if (!pending.length) return;
    pending.forEach((t) => {
      ackedNotices.current.add(t._id);
      notify(t.pendingAssistantNotice.text, { type: 'info', duration: 7000 });
      api.ackNotice(t._id).catch(() => {});
    });
  }, [data?.threads, role, notify]);

  /* ------------------------------------------------------------------ *
   * Derived collections
   * ------------------------------------------------------------------ */
  const threads = data?.threads || [];

  const segmentThreads = useMemo(
    () => threads.filter((t) => matchesSegment(t, ui.segment)),
    [threads, ui.segment]
  );

  const filteredThreads = useMemo(() => {
    const q = ui.query.trim().toLowerCase();
    return segmentThreads.filter((t) => {
      if (ui.chips.unread && !t.unread) return false;
      if (ui.chips.highPriority && !(t.priority === 'high' || t.important)) return false;
      if (ui.chips.gmail && t.provider !== 'gmail') return false;
      if (ui.chips.outlook && t.provider !== 'outlook') return false;
      if (!q) return true;
      const hay = [
        t.subject,
        t.ai?.aiSummary,
        t.ai?.aiReasoning,
        ...(t.participants || []).map((p) => `${p.name} ${p.email}`),
        ...(t.messages || []).map((m) => m.body),
        ...(t.extracted?.actionItems || []).map((a) => a.label),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [segmentThreads, ui.query, ui.chips]);

  const selectedThread = useMemo(
    () => threads.find((t) => t._id === ui.selectedId) || null,
    [threads, ui.selectedId]
  );

  const clientQueue = useMemo(
    () =>
      threads
        .filter((t) => t.ai?.classification === 'client_reply' && !t.completed)
        .sort((a, b) => {
          const flag = Number(b.important) - Number(a.important);
          if (flag !== 0) return flag;
          return new Date(lastStamp(b)) - new Date(lastStamp(a));
        }),
    [threads]
  );

  const value = {
    session,
    role,
    data,
    loading,
    bootError,
    busy,
    toasts,
    ui,
    threads,
    filteredThreads,
    segmentThreads,
    selectedThread,
    clientQueue,
    metrics: data?.metrics || { total: 0, unread: 0, important: 0, actionRequired: 0, waiting: 0, assistantReply: 0, clientReply: 0, needsReview: 0 },
    accounts: data?.accounts || [],
    upcoming: data?.upcoming || [],
    aiStatus: data?.aiStatus || null,
    user: data?.user || null,
    login,
    logout,
    switchRole,
    refresh,
    notify,
    dismissToast,
    setSegment,
    setQuery,
    toggleChip,
    clearFilters,
    selectThread,
    setMobilePane,
    setCopilotOpen,
    openWizard,
    closeWizard,
    setAccountsOpen,
    markRead,
    overrideClassification,
    reclassifyWithAi,
    simulateReply,
    generateDraft,
    sendReply,
    toggleImportant,
    archiveThread,
    completeThread,
    clientAction,
    connectProvider,
    disconnectAccount,
    syncAccount,
    resetDataset,
    askCopilot,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const lastStamp = (thread) => thread.messages[thread.messages.length - 1].receivedAt;
export const lastLabel = (thread) => listStamp(lastStamp(thread));

export function matchesSegment(t, segment) {
  switch (segment) {
    case 'assistant':
      return !t.archived && !t.completed && t.ai.classification === 'assistant_reply';
    case 'client':
      return !t.completed && t.ai.classification === 'client_reply';
    case 'no_reply':
      return !t.completed && t.ai.classification === 'no_reply';
    case 'needs_review':
      return !t.completed && Boolean(t.ai.needsReview);
    case 'action':
      return !t.completed && (t.labels.includes('Action Required') || t.status === 'action_required');
    case 'waiting':
      return !t.completed && (t.status === 'waiting' || t.labels.includes('Waiting for Response'));
    case 'meetings':
      return !t.completed && t.labels.includes('Meetings & Appointments');
    case 'important':
      return !t.completed && t.important;
    case 'general':
      return !t.completed && !t.archived && t.category === 'General' && !t.important;
    case 'archived':
      return Boolean(t.archived || t.completed);
    case 'all':
    default:
      return !t.archived && !t.completed;
  }
}
