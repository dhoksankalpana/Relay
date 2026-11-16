import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock3,
  CornerDownLeft,
  Inbox,
  MailOpen,
  Send,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { useApp, lastStamp } from '../state/AppStore';
import { Avatar, ClassificationBadge, StatePill } from '../components/Badges';
import EmptyState from '../components/EmptyState';
import { ClientCardSkeleton } from '../components/Skeletons';
import { cn, fullStamp, timeOf } from '../lib/ui';

const twoSentences = (text = '') => {
  const parts = String(text).replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/);
  return parts.slice(0, 2).join(' ');
};

function ClientHeader() {
  const { switchRole, user, role } = useApp();
  const navigate = useNavigate();

  const toAssistant = () => {
    switchRole('assistant');
    navigate('/assistant');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2.5 px-4">
        <span className="grid size-7 place-items-center rounded-lg bg-accent text-xs font-bold text-white shadow-card">R</span>
        <div className="leading-none">
          <p className="text-sm font-semibold tracking-tight text-slate-900">Relay</p>
          <p className="hidden text-2xs text-slate-400 sm:block">Client view · only what needs you</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <StatePill tone="neutral" className="hidden sm:inline-flex">
            <UserRound className="size-3" /> Alex Mercer
          </StatePill>
          <button
            type="button"
            onClick={toAssistant}
            className={cn('btn-ghost py-1.5 text-xs', role === 'client' && 'border-indigo-200 bg-accent-soft text-accent-deep')}
          >
            <Building2 className="size-3.5" /> Assistant workspace
          </button>
        </div>
      </div>
    </header>
  );
}

function ThreadSlideOver({ thread, onClose }) {
  const { clientAction, busy } = useApp();
  const [reply, setReply] = useState('');

  if (!thread) return null;
  const counterparty = thread.participants.find((p) => p.role === 'counterparty') || thread.participants[0];

  const sendReply = async () => {
    if (!reply.trim()) return;
    const result = await clientAction(thread._id, 'reply', reply.trim());
    if (result) {
      setReply('');
      onClose();
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-slate-900/30 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ y: '100%', opacity: 0.6 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0.6 }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        className="fixed inset-x-0 bottom-0 top-6 z-[61] mx-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-hairline bg-white shadow-pop sm:top-10"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start gap-2.5 border-b border-hairline px-4 py-3">
          <Avatar name={counterparty.name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-slate-900">{thread.subject}</p>
            <p className="truncate text-2xs text-slate-400">
              {counterparty.name} · {counterparty.email}
            </p>
          </div>
          <button type="button" className="btn-subtle" onClick={onClose} aria-label="Close thread">
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 scroller">
          <div className="rounded-lg border border-client-border bg-client-bg p-3">
            <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.12em] text-client-text">
              <UserRound className="size-3" /> Why your input is needed
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-700">{thread.ai.aiReasoning}</p>
          </div>

          {thread.messages.map((message) => {
            const outbound = message.direction === 'outbound';
            return (
              <div key={message.id} className={cn('card overflow-hidden', outbound && 'border-indigo-100 bg-accent-soft/35')}>
                <div className="flex items-center gap-2.5 border-b border-hairline/80 px-3.5 py-2.5">
                  <Avatar name={message.from.name} tone={outbound ? 'bg-indigo-100 text-indigo-700' : undefined} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">{message.from.name}</p>
                    <p className="truncate text-2xs text-slate-400">{message.from.email}</p>
                  </div>
                  <span className="shrink-0 text-2xs tabular-nums text-slate-400">{fullStamp(message.receivedAt)}</span>
                </div>
                <div className="px-3.5 py-3">
                  <p className="prose-mail">{message.body}</p>
                  {message.approvedBy ? (
                    <p className="mt-2 text-2xs text-slate-400">Sent by {message.approvedBy}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <footer className="border-t border-hairline px-4 py-3">
          <label className="label-caps">Quick personal reply (optional)</label>
          <div className="mt-1.5 flex items-end gap-2">
            <textarea
              rows={2}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder={`Reply to ${counterparty.name.split(' ')[0]} in your own words. Relay will send it from your mailbox and close this out.`}
              className="max-h-40 flex-1 resize-y rounded-lg border border-hairline bg-white px-3 py-2 text-[13px] leading-relaxed text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-accent/15"
            />
            <button type="button" className="btn-primary" disabled={busy[`client-${thread._id}`] || !reply.trim()} onClick={sendReply}>
              <Send className="size-3.5" /> Send
            </button>
          </div>
          <p className="mt-1.5 text-2xs text-slate-400">
            Sending a personal reply marks the thread completed and notifies Sarah in the assistant dashboard.
          </p>
        </footer>
      </motion.div>
    </>
  );
}

function ClientCard({ thread, onOpen }) {
  const { clientAction, busy } = useApp();
  const [delegating, setDelegating] = useState(false);
  const [note, setNote] = useState('');
  const counterparty = thread.participants.find((p) => p.role === 'counterparty') || thread.participants[0];
  const working = busy[`client-${thread._id}`];

  const delegate = async () => {
    const result = await clientAction(thread._id, 'delegate', note.trim() || undefined);
    if (result) {
      setNote('');
      setDelegating(false);
    }
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="card p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <Avatar name={counterparty.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">{counterparty.name}</p>
            {thread.important ? <span className="chip border-amber-200 bg-amber-50 text-amber-700">High priority</span> : null}
          </div>
          <p className="text-2xs text-slate-400">
            {counterparty.email} · received {fullStamp(lastStamp(thread))} · {timeOf(lastStamp(thread))}
          </p>
        </div>
      </div>

      <h2 className="mt-3.5 text-[17px] font-semibold leading-snug tracking-tight text-slate-900">{thread.subject}</h2>

      <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{twoSentences(thread.ai.aiSummary)}</p>

      <div className="mt-3.5 rounded-lg border border-client-border bg-client-bg p-3">
        <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.12em] text-client-text">
          <Sparkles className="size-3" /> Why your input is needed
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-700">{thread.ai.aiReasoning}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={() => onOpen(thread._id)}>
          <MailOpen className="size-3.5" /> Read original thread
        </button>
        <button type="button" className="btn-ghost" disabled={working} onClick={() => clientAction(thread._id, 'handled')}>
          <CheckCircle2 className="size-3.5" /> Mark as handled
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={working}
          onClick={() => setDelegating((value) => !value)}
        >
          <ArrowUpRight className="size-3.5" /> Delegate to assistant
        </button>
        <span className="ml-auto hidden sm:block">
          <ClassificationBadge value={thread.ai.classification} size="sm" />
        </span>
      </div>

      <AnimatePresence initial={false}>
        {delegating ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-lg border border-dashed border-slate-200 p-3">
              <label className="label-caps">Optional note for Sarah</label>
              <div className="mt-1.5 flex items-end gap-2">
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="e.g. Book the earliest slot and confirm with Priya."
                  className="flex-1 rounded-lg border border-hairline bg-white px-2.5 py-2 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-accent/15"
                />
                <button type="button" className="btn-primary" disabled={working} onClick={delegate}>
                  <CornerDownLeft className="size-3.5" /> Send to Sarah
                </button>
                <button type="button" className="btn-ghost" onClick={() => setDelegating(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}

export default function ClientView() {
  const { clientQueue, loading, data, bootError, refresh, role, switchRole } = useApp();
  const [openId, setOpenId] = useState(null);
  const openThread = clientQueue.find((t) => t._id === openId) || null;

  // Keep the global role in sync so the assistant header reflects where we are.
  useEffect(() => {
    if (role !== 'client') switchRole('client');
  }, [role, switchRole]);

  if (bootError) {
    return (
      <div className="min-h-screen bg-canvas">
        <ClientHeader />
        <EmptyState
          icon={Inbox}
          title="Relay cannot reach the triage server"
          description="Start the API server on port 5050 (npm run dev from the project root) and try again — the client queue is loaded from the server."
          action={
            <button type="button" className="btn-primary" onClick={() => refresh()}>
              Try again
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <ClientHeader />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Good to see you, Alex</h1>
            <p className="mt-1 text-sm text-slate-500">
              Sarah has triaged everything else. Below is only what genuinely needs your personal voice.
            </p>
          </div>
          <span className="chip border-hairline bg-white text-slate-600">
            <Clock3 className="size-3 text-slate-400" /> {clientQueue.length} waiting on you
          </span>
        </div>

        <div className="mt-7 space-y-4">
          {loading && !data ? (
            <>
              <ClientCardSkeleton />
              <ClientCardSkeleton />
            </>
          ) : clientQueue.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={CheckCircle2}
                title="You're completely caught up"
                description="Nothing is waiting on your personal voice right now. Sarah is handling the rest and will surface anything that needs you here."
                action={
                  <button type="button" className="btn-ghost" onClick={() => refresh()}>
                    Check for new items
                  </button>
                }
              />
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {clientQueue.map((thread) => (
                <ClientCard key={thread._id} thread={thread} onOpen={setOpenId} />
              ))}
            </AnimatePresence>
          )}
        </div>

        <p className="mt-8 flex items-center justify-center gap-1.5 text-2xs text-slate-400">
          <Sparkles className="size-3" />
          Summaries and routing are produced by Relay’s AI engine · no messages are ever sent without approval.
        </p>
      </main>

      <AnimatePresence>
        {openThread ? <ThreadSlideOver key={openThread._id} thread={openThread} onClose={() => setOpenId(null)} /> : null}
      </AnimatePresence>
    </div>
  );
}
