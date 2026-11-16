import { Archive, CalendarClock, Clock, Flag, Inbox, Mail, RotateCcw, Settings2, ShieldAlert, Sparkles, Users2 } from 'lucide-react';
import { useApp } from '../state/AppStore';
import { SEGMENT_GROUPS, SEGMENT_LABELS, TONE_DOT, cn } from '../lib/ui';
import { StatePill } from './Badges';

const SEGMENT_ICONS = {
  all: Inbox,
  assistant: Mail,
  client: Users2,
  no_reply: Archive,
  needs_review: ShieldAlert,
  action: Sparkles,
  waiting: Clock,
  meetings: CalendarClock,
  important: Flag,
  general: Inbox,
  archived: Archive,
};

export default function NavRail({ onClose }) {
  const { ui, setSegment, metrics, segments, accounts, resetDataset, busy, setAccountsOpen, aiStatus, upcoming } = useApp();

  const counts =
    segments && Object.keys(segments).length
      ? segments
      : { all: metrics.total, assistant: metrics.assistantReply, client: metrics.clientReply, no_reply: 0, needs_review: metrics.needsReview, action: metrics.actionRequired, waiting: metrics.waiting, meetings: 0, important: metrics.important, general: 0, archived: 0 };

  const connected = accounts.filter((a) => a.connected);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-3 py-4 scroller">
      <div>
        <p className="px-2.5 pb-1.5 label-caps">Mailboxes</p>
        <div className="space-y-1">
          {accounts.map((account) => (
            <div
              key={account._id}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs',
                account.connected ? 'border-hairline bg-white shadow-card' : 'border-dashed border-slate-200 bg-slate-50/60'
              )}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-800">{account.provider === 'gmail' ? 'Google Workspace' : 'Microsoft 365'}</p>
                <p className="truncate text-2xs text-slate-400">{account.connected ? account.email : 'Not connected'}</p>
              </div>
              <span className={cn('size-1.5 shrink-0 rounded-full', account.connected ? 'bg-emerald-500' : 'bg-slate-300')} />
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost mt-2 w-full py-1.5 text-xs" onClick={() => setAccountsOpen(true)}>
          <Settings2 className="size-3.5" /> Manage accounts
        </button>
      </div>

      {SEGMENT_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-2.5 pb-1.5 label-caps">{group.title}</p>
          <nav className="space-y-0.5">
            {group.items.map((item) => {
              const active = ui.segment === item.key;
              const count = counts[item.countKey] ?? 0;
              const Icon = SEGMENT_ICONS[item.key] || Inbox;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setSegment(item.key);
                    onClose?.();
                  }}
                  className={cn('group nav-item', active && 'nav-item-active')}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="relative">
                    <Icon className={cn('size-4', active ? 'text-accent' : 'text-slate-400 group-hover:text-slate-600')} />
                    {item.tone ? <span className={cn('absolute -right-0.5 -top-0.5 size-1.5 rounded-full', TONE_DOT[item.tone])} /> : null}
                  </span>
                  <span className="flex-1 truncate text-left">{item.label}</span>
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-2xs font-semibold tabular-nums',
                      active ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-400 group-hover:bg-white'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      ))}

      <div className="mt-auto space-y-2 border-t border-hairline pt-3">
        <div className="rounded-lg border border-hairline bg-white p-2.5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-2xs font-semibold text-slate-700">Extracted this week</p>
            <StatePill tone={aiStatus?.live ? 'live' : 'simulated'} dot={false}>
              {aiStatus?.live ? 'Live' : 'Simulated'}
            </StatePill>
          </div>
          <p className="mt-1 text-2xs leading-snug text-slate-500">
            {upcoming.length} dates and deadlines pulled out of email threads and mirrored into the meetings strip.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost w-full py-1.5 text-xs"
          onClick={resetDataset}
          disabled={busy.reset}
          title="Restore the seeded demo dataset"
        >
          <RotateCcw className={cn('size-3.5', busy.reset && 'animate-spin')} /> Reset demo data
        </button>
        <p className="px-1 text-[10px] leading-snug text-slate-400">
          Viewing “{SEGMENT_LABELS[ui.segment] || 'All Inbox'}” · {connected.length} of {accounts.length} mailboxes connected
        </p>
      </div>
    </div>
  );
}
