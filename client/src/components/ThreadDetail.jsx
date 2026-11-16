import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  Archive,
  ArchiveRestore,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  History,
  Info,
  MailOpen,
  PenLine,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../state/AppStore';
import {
  Avatar,
  ClassificationBadge,
  ClassificationSelect,
  ConfidenceMeter,
  NoteBanner,
  OverrideFlag,
  ProviderPill,
  ReviewFlag,
} from './Badges';
import EmptyState from './EmptyState';
import { ThreadDetailSkeleton } from './Skeletons';
import { TONES, cn, fullStamp, listStamp, meta, relativeTime } from '../lib/ui';

/* ------------------------------------------------------------------ *
 * AI intelligence card
 * ------------------------------------------------------------------ */
function AiIntelligenceCard({ thread }) {
  const { reclassifyWithAi, simulateReply, busy, setCopilotOpen } = useApp();
  const [simOpen, setSimOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const m = meta(thread.ai.classification);
  const { extracted } = thread;

  const runSim = async (body) => {
    const result = await simulateReply(thread._id, body || undefined);
    if (result) {
      setSimOpen(false);
      setCustom('');
    }
  };

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b border-hairline bg-gradient-to-r from-accent-soft/70 via-white to-white px-3.5 py-2.5">
        <Sparkles className="size-3.5 text-accent" />
        <h2 className="text-xs font-semibold tracking-tight text-slate-800">AI Intelligence</h2>
        <span className="chip border-hairline bg-white text-slate-500">
          {thread.ai.simulated || !thread.ai.lastError ? 'Relay Triage Engine v2' : 'fallback engine'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <ConfidenceMeter value={thread.ai.aiConfidence} />
          {thread.ai.needsReview ? <ReviewFlag compact /> : null}
        </div>
      </header>

      <div className="space-y-3 p-3.5">
        <div>
          <p className="label-caps mb-1.5">Conversation summary</p>
          <ul className="space-y-1.5">
            {(thread.ai.aiSummaryBullets || []).map((bullet, index) => (
              <li key={index} className="flex items-start gap-2 text-[13px] leading-snug text-slate-700">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={cn('rounded-lg border p-3', m.border, m.soft)}>
          <div className="flex items-center justify-between gap-2">
            <p className={cn('flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.12em]', m.text)}>
              <Info className="size-3" /> Why this classification
            </p>
            <span className={cn('chip border-white/70 bg-white/80', m.text)}>{m.label}</span>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-700">{thread.ai.aiReasoning}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {thread.ai.overridden ? <OverrideFlag thread={thread} /> : null}
            <button
              type="button"
              onClick={() => reclassifyWithAi(thread._id)}
              disabled={busy.reclassify}
              className="btn-ghost bg-white/80 py-1 text-2xs"
            >
              <Zap className={cn('size-3', busy.reclassify && 'animate-pulse')} /> Re-evaluate with AI
            </button>
            <button
              type="button"
              onClick={() => setCopilotOpen(true, 'Why has this email been assigned to the client?')}
              className="btn-ghost bg-white/80 py-1 text-2xs"
            >
              <Sparkles className="size-3" /> Ask the copilot why
            </button>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <ExtractColumn
            title="Action items"
            icon={CheckCircle2}
            tone="border-hairline bg-slate-50 text-slate-600"
            items={(extracted?.actionItems || []).map((item) => item.label)}
            empty="No action items detected"
          />
          <ExtractColumn
            title="Deadlines"
            icon={Clock3}
            tone="border-amber-200 bg-amber-50 text-amber-700"
            items={(extracted?.deadlines || []).map((item) => item.label)}
            empty="No deadlines detected"
          />
          <ExtractColumn
            title="Appointments"
            icon={CalendarClock}
            tone="border-indigo-200 bg-accent-soft text-accent-deep"
            items={(extracted?.appointments || []).map((item) => `${item.title} · ${item.timeLabel || ''}`)}
            empty="No dates detected"
          />
        </div>

        <div className="rounded-lg border border-dashed border-slate-200 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSimOpen((open) => !open)}
              className={cn('btn-ghost py-1.5 text-xs', simOpen && 'border-indigo-200 bg-accent-soft text-accent-deep')}
            >
              <MailOpen className="size-3.5" /> Simulate new incoming reply
              <ChevronDown className={cn('size-3 transition', simOpen && 'rotate-180')} />
            </button>
            <p className="text-2xs leading-snug text-slate-400">
              Injects a new inbound message and re-runs the classifier on the updated history.
            </p>
          </div>
          <AnimatePresence initial={false}>
            {simOpen ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2.5 space-y-2">
                  <textarea
                    value={custom}
                    onChange={(event) => setCustom(event.target.value)}
                    rows={3}
                    placeholder={`Optional: write the incoming reply yourself. Leave blank to fire a pre-built follow-up from ${
                      thread.participants.find((p) => p.role === 'counterparty')?.name || 'the sender'
                    }.`}
                    className="w-full resize-y rounded-lg border border-hairline bg-white p-2.5 text-[13px] leading-relaxed text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-accent/15"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-primary py-1.5 text-xs" disabled={busy.simulate} onClick={() => runSim(custom)}>
                      <Zap className={cn('size-3.5', busy.simulate && 'animate-pulse')} />
                      {busy.simulate ? 'Injecting & re-classifying…' : custom.trim() ? 'Inject my reply' : 'Trigger pre-built follow-up'}
                    </button>
                    <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => setSimOpen(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function ExtractColumn({ title, icon: Icon, tone, items, empty }) {
  return (
    <div className="rounded-lg border border-hairline bg-white p-2.5">
      <p className="label-caps mb-1.5 flex items-center gap-1">
        <Icon className="size-3" /> {title}
      </p>
      {items.length === 0 ? (
        <p className="text-2xs text-slate-400">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, index) => (
            <span key={index} className={cn('chip max-w-full text-left', tone)}>
              <span className="truncate">{item}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Message stream
 * ------------------------------------------------------------------ */
function MessageBubble({ message, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const outbound = message.direction === 'outbound';

  return (
    <div className={cn('card overflow-hidden', outbound && 'border-indigo-100 bg-accent-soft/35')}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
      >
        <Avatar name={message.from.name} tone={outbound ? 'bg-indigo-100 text-indigo-700' : undefined} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="truncate text-xs font-semibold text-slate-800">{message.from.name}</p>
            {outbound ? <span className="chip border-indigo-200 bg-white text-accent-deep">Us · Assistant</span> : null}
            {message.simulated ? <span className="chip border-review-border bg-review-bg text-review-text">Simulated inbound</span> : null}
            <span className="ml-auto shrink-0 text-2xs tabular-nums text-slate-400">{fullStamp(message.receivedAt)}</span>
          </div>
          <p className="truncate text-2xs text-slate-400">{message.from.email}</p>
        </div>
        <ChevronDown className={cn('size-3.5 shrink-0 text-slate-400 transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-hairline/80 px-3.5 py-3">
              <p className="prose-mail">{message.body}</p>
              {message.subject ? <p className="mt-2 text-2xs text-slate-400">Subject: {message.subject}</p> : null}
              {message.approvedBy ? (
                <p className="mt-2 inline-flex items-center gap-1 text-2xs text-assistant-text">
                  <ShieldCheck className="size-3" /> Approved &amp; sent by {message.approvedBy} (human-in-the-loop)
                </p>
              ) : null}
            </div>
          </motion.div>
        ) : (
          <p className="border-t border-hairline/80 px-3.5 py-2 text-xs italic text-slate-400">{message.snippet}</p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Composer
 * ------------------------------------------------------------------ */
function Composer({ thread }) {
  const { generateDraft, sendReply, busy, notify } = useApp();
  const [tone, setTone] = useState('Professional');
  const [body, setBody] = useState(thread.draft?.body || '');
  const [subject, setSubject] = useState(thread.draft?.subject || `Re: ${thread.subject}`);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setBody(thread.draft?.body || '');
    setSubject(thread.draft?.subject || `Re: ${thread.subject}`);
    setTouched(false);
  }, [thread._id, thread.draft?.generatedAt, thread.subject, thread.draft?.body, thread.draft?.subject]);

  const composed = body.trim().length > 0;

  const handleDraft = async () => {
    const result = await generateDraft(thread._id, tone);
    if (result?.draft) {
      setBody(result.draft.body);
      setSubject(result.draft.subject);
      setTouched(false);
    }
  };

  const handleSend = async (markCompleted) => {
    if (!composed) {
      notify('Nothing to send yet', { type: 'error', detail: 'Draft a reply or write one before approving.' });
      return;
    }
    const result = await sendReply(thread._id, { body, subject, markCompleted });
    if (result) {
      setBody('');
      setTouched(false);
    }
  };

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b border-hairline px-3.5 py-2.5">
        <PenLine className="size-3.5 text-slate-400" />
        <h2 className="text-xs font-semibold tracking-tight text-slate-800">Reply composer</h2>
        <span className="chip border-hairline bg-slate-50 text-slate-500">Human approval required</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {TONES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTone(option)}
              className={cn(
                'rounded-full border px-2 py-0.5 text-2xs font-medium transition',
                tone === option ? 'border-indigo-200 bg-accent-soft text-accent-deep' : 'border-hairline bg-white text-slate-500 hover:text-slate-800'
              )}
            >
              {option}
            </button>
          ))}
          <button type="button" className="btn-primary py-1.5 text-xs" onClick={handleDraft} disabled={busy.draft}>
            <Wand2 className={cn('size-3.5', busy.draft && 'animate-pulse')} />
            {busy.draft ? 'Drafting…' : 'Draft reply with AI'}
          </button>
        </div>
      </header>

      <div className="space-y-2.5 p-3.5">
        <NoteBanner tone="indigo">
          <strong className="font-semibold">Review &amp; approve before sending.</strong> Relay never sends on its own — edit the draft,
          then approve it. Sending moves the thread to <em>Waiting for Response</em>, or straight to <em>Completed</em> if you choose.
        </NoteBanner>

        <input
          value={subject}
          onChange={(event) => {
            setSubject(event.target.value);
            setTouched(true);
          }}
          className="w-full rounded-lg border border-hairline bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-700 outline-none focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-accent/15"
        />
        <textarea
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            setTouched(true);
          }}
          rows={body ? 14 : 5}
          placeholder="Draft with AI, or write your reply manually. The thread history, extracted action items and your chosen tone are all used as context."
          className="w-full resize-y rounded-lg border border-hairline bg-white p-3 text-[13px] leading-relaxed text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-accent/15"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" onClick={() => handleSend(false)} disabled={busy.send || !composed}>
            <Send className={cn('size-3.5', busy.send && 'animate-pulse')} />
            {busy.send ? 'Sending…' : 'Approve & send'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => handleSend(true)} disabled={busy.send || !composed}>
            <CheckCircle2 className="size-3.5" /> Approve, send &amp; complete
          </button>
          {composed ? (
            <button
              type="button"
              className="btn-subtle text-xs"
              onClick={() => {
                setBody('');
                setTouched(false);
              }}
            >
              <X className="size-3.5" /> Discard draft
            </button>
          ) : null}
          <span className="ml-auto text-2xs text-slate-400">
            {thread.draft?.tone ? `AI draft tone: ${thread.draft.tone}` : 'No AI draft yet'}
            {touched ? ' · edited by you' : ''}
          </span>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Detail pane
 * ------------------------------------------------------------------ */
export default function ThreadDetail() {
  const {
    selectedThread: thread,
    loading,
    ui,
    setMobilePane,
    toggleImportant,
    markRead,
    archiveThread,
    completeThread,
    overrideClassification,
    busy,
    setCopilotOpen,
  } = useApp();

  const expandedDefaults = useMemo(() => {
    if (!thread) return {};
    const map = {};
    const lastInbound = [...thread.messages].reverse().find((m) => m.direction === 'inbound');
    thread.messages.forEach((message, index) => {
      map[message.id] = message.id === (lastInbound?.id || thread.messages[thread.messages.length - 1]?.id) || index === 0;
    });
    return map;
  }, [thread?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !thread) return <ThreadDetailSkeleton />;

  if (!thread) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Select a conversation"
        description="Relay has already triaged every thread in this mailbox. Pick one to see the AI summary, why it was assigned that responsibility, and a ready-to-approve reply."
        className="h-full"
        action={
          <button type="button" className="btn-ghost" onClick={() => setCopilotOpen(true)}>
            <Sparkles className="size-4" /> Ask the AI copilot instead
          </button>
        }
      />
    );
  }

  const counterparty = thread.participants.find((p) => p.role === 'counterparty') || thread.participants[0];
  const m = meta(thread.ai.classification);

  const handleOverride = async (value) => {
    if (value === thread.ai.classification) return;
    await overrideClassification(thread._id, value, 'Changed from the thread header');
  };

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/95 px-3 py-2.5 backdrop-blur sm:px-4">
        <div className="flex items-start gap-2">
          <button type="button" className="btn-subtle lg:hidden" onClick={() => setMobilePane('list')} aria-label="Back to list">
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold tracking-tight text-slate-900">{thread.subject}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Avatar name={counterparty.name} size="sm" />
              <span className="text-xs font-medium text-slate-700">{counterparty.name}</span>
              <span className="hidden truncate text-2xs text-slate-400 sm:inline">{counterparty.email}</span>
              <span className="text-2xs text-slate-300">·</span>
              <span className="text-2xs tabular-nums text-slate-400">{listStamp(thread.messages[thread.messages.length - 1].receivedAt)}</span>
              <ProviderPill provider={thread.provider} compact />
              {thread.completed ? <span className="chip border-assistant-border bg-assistant-bg text-assistant-text">Completed</span> : null}
              {thread.archived ? <span className="chip border-hairline bg-slate-50 text-slate-500">Archived</span> : null}
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <ClassificationSelect thread={thread} onChange={handleOverride} busy={busy[`classify-${thread._id}`]} />
          <button
            type="button"
            className={cn('btn-ghost py-1.5 text-xs', thread.important && 'border-amber-200 bg-amber-50 text-amber-700')}
            onClick={() => toggleImportant(thread._id, !thread.important)}
          >
            <Star className={cn('size-3.5', thread.important && 'fill-amber-400')} />
            {thread.important ? 'Important' : 'Mark important'}
          </button>
          <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => markRead(thread._id, !thread.unread)}>
            {thread.unread ? <CheckCircle2 className="size-3.5" /> : <MailOpen className="size-3.5" />}
            {thread.unread ? 'Mark read' : 'Mark unread'}
          </button>
          <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => archiveThread(thread._id, !thread.archived)}>
            {thread.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
            {thread.archived ? 'Restore' : 'Archive'}
          </button>
          <button
            type="button"
            className={cn('btn-ghost py-1.5 text-xs', thread.completed && 'border-emerald-200 bg-emerald-50 text-emerald-700')}
            onClick={() => completeThread(thread._id, !thread.completed)}
          >
            <CheckCircle2 className="size-3.5" />
            {thread.completed ? 'Reopen' : 'Mark completed'}
          </button>
          <button
            type="button"
            className="btn-ghost py-1.5 text-xs sm:ml-auto"
            onClick={() => setCopilotOpen(true, 'Summarize this conversation.')}
          >
            <Sparkles className="size-3.5" /> Summarize with AI
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3.5 scroller sm:px-4 sm:py-4">
        <AiIntelligenceCard thread={thread} />

        {thread.clientAction ? (
          <NoteBanner tone={thread.clientAction.type === 'handled' ? 'ai' : 'warning'}>
            <strong className="font-semibold">
              {thread.clientAction.type === 'handled' ? 'Alex marked this handled in the client view' : 'Alex delegated this back to you'}
            </strong>{' '}
            {thread.clientAction.note ? `—“${thread.clientAction.note}” ` : ''}
            <span className="text-slate-400">({relativeTime(thread.clientAction.at)})</span>
          </NoteBanner>
        ) : null}

        <div className="flex items-center gap-2 px-1 pt-1">
          <p className="label-caps">
            Thread · {thread.messages.length} message{thread.messages.length === 1 ? '' : 's'}
          </p>
          <span className="h-px flex-1 bg-hairline" />
          <span className={cn('chip', m.chip)}>
            <UserRound className="size-2.5" /> {m.helper}
          </span>
        </div>

        <div className="space-y-2.5">
          {thread.messages.map((message) => (
            <MessageBubble key={message.id} message={message} defaultOpen={expandedDefaults[message.id]} />
          ))}
        </div>

        <Composer thread={thread} />

        {thread.history?.length ? (
          <section className="card p-3.5">
            <p className="label-caps mb-2 flex items-center gap-1.5">
              <History className="size-3" /> Activity &amp; AI decisions
            </p>
            <ol className="space-y-2">
              {thread.history.slice(0, 6).map((entry) => (
                <li key={entry.id} className="flex items-start gap-2.5 text-xs text-slate-600">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" />
                  <span className="min-w-0 flex-1">
                    {entry.text}
                    <span className="ml-1.5 text-2xs text-slate-400">{relativeTime(entry.at)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {thread.ai.lastError ? (
          <NoteBanner tone="warning">
            <AlertTriangle className="mr-1 inline size-3" />
            Live model unavailable ({thread.ai.lastError}) — this thread was triaged by the deterministic engine.
          </NoteBanner>
        ) : null}
      </div>
    </div>
  );
}
