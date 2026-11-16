import { motion } from 'framer-motion';
import { ArrowUpRight, CalendarClock, Clock3, Flag, Inbox, MailCheck, MailOpen, Users2 } from 'lucide-react';
import { useApp } from '../state/AppStore';
import { METRIC_CARDS, cn, meta, untilLabel } from '../lib/ui';
import { MetricsSkeleton } from './Skeletons';

const ICONS = {
  total: Inbox,
  unread: MailOpen,
  important: Flag,
  actionRequired: MailCheck,
  waiting: Clock3,
  assistantReply: MailCheck,
  clientReply: Users2,
};

export default function MetricsRow() {
  const { metrics, ui, setSegment, loading, toggleChip, upcoming, selectThread, setSegment: setSeg } = useApp();

  if (loading && !metrics.total) return <MetricsSkeleton />;

  const handleCard = (card) => {
    if (card.chip === 'unread') {
      setSegment('all');
      if (!ui.chips.unread) toggleChip('unread');
      return;
    }
    setSegment(card.segment);
    if (ui.chips.unread) toggleChip('unread');
  };

  const isActive = (card) => {
    if (card.chip === 'unread') return ui.segment === 'all' && ui.chips.unread;
    if (card.key === 'total') return ui.segment === 'all' && !ui.chips.unread;
    return ui.segment === card.segment;
  };

  const jump = (item) => {
    setSeg('all');
    selectThread(item.threadId);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
        {METRIC_CARDS.map((card, index) => {
          const Icon = ICONS[card.key] || Inbox;
          const active = isActive(card);
          const tone = card.tone ? meta(card.tone === 'assistant' ? 'assistant_reply' : 'client_reply') : null;
          return (
            <motion.button
              key={card.key}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.025, duration: 0.22 }}
              onClick={() => handleCard(card)}
              className={cn(
                'group card flex flex-col items-start gap-1 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-lift',
                active && 'border-indigo-200 ring-2 ring-accent/15'
              )}
              title={`Filter the inbox by ${card.label}`}
            >
              <span className="flex w-full items-center justify-between">
                <span className="label-caps truncate">{card.label}</span>
                <Icon className={cn('size-3.5 shrink-0', tone ? tone.text : active ? 'text-accent' : 'text-slate-300')} />
              </span>
              <span className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{metrics[card.key] ?? 0}</span>
              <span className="text-2xs text-slate-400">{card.hint}</span>
            </motion.button>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-3.5 text-accent" />
            <p className="text-xs font-semibold tracking-tight text-slate-800">Upcoming meetings &amp; appointments</p>
            <span className="chip border-hairline bg-slate-50 text-slate-500">AI-extracted</span>
          </div>
          <p className="hidden text-2xs text-slate-400 sm:block">Pulled automatically from email threads</p>
        </div>

        {upcoming.length === 0 ? (
          <p className="px-3.5 py-4 text-xs text-slate-400">No dates detected in the current mailbox.</p>
        ) : (
          <div className="flex gap-2.5 overflow-x-auto px-3.5 py-3 scroller">
            {upcoming.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'group flex min-w-[220px] max-w-[260px] shrink-0 flex-col gap-1.5 rounded-lg border p-2.5 transition hover:shadow-card',
                  item.deadline ? 'border-amber-200 bg-amber-50/60' : 'border-hairline bg-white'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('chip', item.deadline ? 'border-amber-200 bg-white text-amber-700' : 'border-indigo-200 bg-accent-soft text-accent-deep')}>
                    {item.deadline ? 'Deadline' : 'Meeting'}
                  </span>
                  <span className="text-2xs font-semibold tabular-nums text-slate-500">{untilLabel(item.start)}</span>
                </div>
                <p className="line-clamp-2 text-xs font-semibold leading-snug text-slate-800">{item.title}</p>
                <p className="text-2xs tabular-nums text-slate-500">
                  {new Date(item.start).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                </p>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-hairline/80 pt-1.5">
                  <span className="truncate text-2xs text-slate-400">Extracted from email with {item.sender}</span>
                  <button type="button" onClick={() => jump(item)} className="inline-flex shrink-0 items-center gap-0.5 text-2xs font-semibold text-accent hover:text-accent-deep">
                    Open <ArrowUpRight className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
