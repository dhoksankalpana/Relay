import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, CornerDownLeft, Loader2, MessageSquareQuote, Sparkles, Wand2, X } from 'lucide-react';
import { useApp } from '../state/AppStore';
import { COPILOT_PROMPTS, cn, relativeTime } from '../lib/ui';

let counter = 0;
const nextId = () => `m-${(counter += 1)}`;

export default function CopilotPanel() {
  const { ui, setCopilotOpen, askCopilot, busy, threads, selectThread, generateDraft, notify, aiStatus } = useApp();
  const [input, setInput] = useState('');
  const [log, setLog] = useState([
    {
      id: nextId(),
      role: 'ai',
      text:
        'Hi Sarah — I have read all threads in the mailbox. Ask me who owes a reply, what is waiting on someone, or ask me to draft something for the conversation you have open.',
      bullets: [],
      threadIds: [],
      at: new Date().toISOString(),
      intro: true,
    },
  ]);
  const scrollRef = useRef(null);
  const lastSeed = useRef(null);

  const open = ui.copilotOpen;

  const send = async (message) => {
    const text = String(message || '').trim();
    if (!text) return;
    setLog((entries) => [...entries, { id: nextId(), role: 'user', text, bullets: [], threadIds: [], at: new Date().toISOString() }]);
    setInput('');
    const answer = await askCopilot(text, ui.selectedId);
    setLog((entries) => [
      ...entries,
      {
        id: nextId(),
        role: 'ai',
        text: answer?.answer || 'I could not reach the triage engine for that question.',
        bullets: answer?.bullets || [],
        threadIds: answer?.threadIds || [],
        action: answer?.action || null,
        model: answer?.model,
        at: new Date().toISOString(),
      },
    ]);
  };

  // Auto-run a prompt seeded from elsewhere in the UI (e.g. “Why this classification?”)
  useEffect(() => {
    if (!open) {
      lastSeed.current = null;
      return;
    }
    if (ui.copilotSeed && ui.copilotSeed !== lastSeed.current) {
      lastSeed.current = ui.copilotSeed;
      send(ui.copilotSeed);
    }
  }, [open, ui.copilotSeed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [log, open]);

  const openThread = (id) => {
    selectThread(id);
    if (window.innerWidth < 1024) setCopilotOpen(false);
  };

  const draftFor = async (threadId, tone = 'Professional') => {
    selectThread(threadId);
    setCopilotOpen(false);
    await generateDraft(threadId, tone);
    notify('Draft ready for review in the composer', { type: 'ai', duration: 4200 });
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="copilot-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCopilotOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[2px] lg:hidden"
          />
          <motion.aside
            key="copilot"
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-[400px] flex-col border-l border-hairline bg-white shadow-pop lg:top-14"
            role="complementary"
            aria-label="AI copilot"
          >
            <header className="flex items-center gap-2 border-b border-hairline px-3.5 py-3">
              <span className="grid size-7 place-items-center rounded-lg bg-accent-soft">
                <Sparkles className="size-4 text-accent" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight text-slate-900">Ask AI Assistant</p>
                <p className="text-2xs text-slate-400">
                  {aiStatus?.live ? `Live · ${aiStatus.provider}` : 'Simulated copilot'} · knows all {threads.length} threads
                </p>
              </div>
              <button type="button" className="btn-subtle ml-auto" onClick={() => setCopilotOpen(false)} aria-label="Close copilot">
                <X className="size-4" />
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3.5 py-3.5 scroller">
              {log.map((entry) => (
                <div key={entry.id} className={cn('flex', entry.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[92%] rounded-xl border px-3 py-2.5 text-[13px] leading-relaxed',
                      entry.role === 'user'
                        ? 'border-indigo-200 bg-accent text-white'
                        : 'border-hairline bg-white text-slate-700 shadow-card'
                    )}
                  >
                    <p className="whitespace-pre-line">{entry.text}</p>

                    {entry.bullets?.length ? (
                      <ul className="mt-2 space-y-1.5 border-t border-hairline/80 pt-2">
                        {entry.bullets.map((bullet, index) => (
                          <li key={index} className="flex items-start gap-1.5 text-xs text-slate-600">
                            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {entry.threadIds?.length ? (
                      <div className="mt-2 border-t border-hairline/80 pt-2">
                        <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.12em] text-slate-400">Referenced threads</p>
                        <div className="flex flex-wrap gap-1.5">
                          {entry.threadIds.map((id) => {
                            const thread = threads.find((t) => t._id === id);
                            if (!thread) return null;
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => openThread(id)}
                                className="group inline-flex max-w-full items-center gap-1 rounded-full border border-hairline bg-slate-50 px-2 py-0.5 text-2xs font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-accent-soft hover:text-accent-deep"
                                title={thread.subject}
                              >
                                <MessageSquareQuote className="size-2.5 shrink-0" />
                                <span className="max-w-[190px] truncate">{thread.subject}</span>
                                <ArrowUpRight className="size-2.5 shrink-0 opacity-0 transition group-hover:opacity-100" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {entry.action?.type === 'draft' ? (
                      <button
                        type="button"
                        className="btn-primary mt-2 w-full py-1.5 text-xs"
                        onClick={() => draftFor(ui.selectedId || entry.threadIds?.[0], entry.action.tone)}
                      >
                        <Wand2 className="size-3.5" /> Draft it in the composer
                      </button>
                    ) : null}

                    {entry.role === 'ai' && !entry.intro ? (
                      <p className="mt-1.5 text-2xs text-slate-400">
                        {relativeTime(entry.at)} · {entry.model || 'relay-engine'}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}

              {busy.chat ? (
                <div className="flex items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs text-slate-500 shadow-card">
                  <Loader2 className="size-3.5 animate-spin text-accent" /> Reading the mailbox…
                </div>
              ) : null}
            </div>

            <div className="border-t border-hairline px-3.5 py-3">
              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5 scroller">
                {COPILOT_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => send(prompt)}
                    disabled={busy.chat}
                    className="shrink-0 rounded-full border border-hairline bg-white px-2.5 py-1 text-2xs font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-accent-soft hover:text-accent-deep disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <form
                className="flex items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  send(input);
                }}
              >
                <textarea
                  rows={1}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder="Ask about this inbox or thread…"
                  className="max-h-28 flex-1 resize-none rounded-lg border border-hairline bg-white px-2.5 py-2 text-[13px] text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-accent/15"
                />
                <button type="submit" className="btn-primary px-2.5 py-2" disabled={busy.chat || !input.trim()} aria-label="Send question">
                  <CornerDownLeft className="size-4" />
                </button>
              </form>
              <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
                The copilot only reads mailboxes you have connected and never sends anything on your behalf.
              </p>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
