import { Archive, ArchiveRestore, CalendarClock, CheckCheck, MailOpen, Star } from 'lucide-react';
import { useApp } from '../state/AppStore';
import { Avatar, ClassificationBadge, ClassificationSelect, ConfidenceMeter, OverrideFlag, ReviewFlag } from './Badges';
import EmptyState from './EmptyState';
import { ThreadListSkeleton } from './Skeletons';
import { cn, listStamp } from '../lib/ui';

function Row({ thread, active, onSelect }) {
  const { ui, markRead, archiveThread, overrideClassification, toggleImportant, busy, notify } = useApp();
  const counterparty = thread.participants.find((p) => p.role === 'counterparty') || thread.participants[0];
  const last = thread.messages[thread.messages.length - 1];
  const others = thread.participants.length - 1;
  const isBusy = busy[`classify-${thread._id}`];
  const hasAppointment = (thread.extracted?.appointments || []).length > 0;
  const hasDeadline = (thread.extracted?.deadlines || []).length > 0;
  const waiting = thread.status === 'waiting';

  const handleOverride = async (value) => {
    if (value === thread.ai.classification) return;
    await overrideClassification(thread._id, value, 'Changed from the conversation list');
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(thread._id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(thread._id);
        }
      }}
      className={cn(
        'group relative cursor-pointer border-b border-hairline px-3.5 py-3 transition',
        active ? 'bg-accent-soft/60' : 'bg-white hover:bg-slate-50/80'
      )}
    >
      {active ? <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" /> : null}

      <div className="flex items-start gap-3">
        <Avatar name={counterparty.name} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className={cn('truncate text-[13px]', thread.unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700')}>
              {counterparty.name}
            </p>
            {others > 0 ? <span className="shrink-0 text-2xs text-slate-400">+{others}</span> : null}
            <span className="ml-auto shrink-0 text-2xs tabular-nums text-slate-400">{listStamp(last.receivedAt)}</span>
          </div>

          <p className={cn('mt-0.5 truncate text-[13px]', thread.unread ? 'font-semibold text-slate-900' : 'text-slate-700')}>
            {thread.unread ? <span className="mr-1.5 inline-block size-1.5 -translate-y-px rounded-full bg-accent align-middle" /> : null}
            {thread.subject}
          </p>

          <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-500">{thread.ai.aiSummary || last.snippet}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <ClassificationBadge value={thread.ai.classification} size="sm" />
            {thread.ai.needsReview ? <ReviewFlag compact /> : null}
            {thread.ai.overridden ? <OverrideFlag thread={thread} /> : null}
            {waiting && !thread.completed ? <span className="chip border-hairline bg-slate-50 text-slate-500">Waiting</span> : null}
            {hasAppointment ? (
              <span className="chip border-indigo-200 bg-accent-soft text-accent-deep">
                <CalendarClock className="size-2.5" /> Meeting
              </span>
            ) : null}
            {hasDeadline ? <span className="chip border-amber-200 bg-amber-50 text-amber-700">Deadline</span> : null}
            {thread.priority === 'high' && !thread.important ? <span className="chip border-rose-200 bg-rose-50 text-rose-600">High priority</span> : null}
            <span className="ml-auto hidden sm:block">
              <ConfidenceMeter value={thread.ai.aiConfidence} />
            </span>
          </div>
        </div>
      </div>

      {/* Hover / focus quick actions */}
      <div className="mt-2 flex items-center gap-1.5 opacity-100 transition lg:mt-0 lg:absolute lg:right-3 lg:top-3 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleImportant(thread._id, !thread.important);
          }}
          className={cn('btn-subtle bg-white/80 ring-1 ring-hairline', thread.important && 'text-amber-500')}
          title={thread.important ? 'Remove important flag' : 'Mark important'}
        >
          <Star className={cn('size-3.5', thread.important && 'fill-amber-400')} />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            markRead(thread._id, !thread.unread);
          }}
          className="btn-subtle bg-white/80 ring-1 ring-hairline"
          title={thread.unread ? 'Mark as read' : 'Mark as unread'}
        >
          {thread.unread ? <CheckCheck className="size-3.5" /> : <MailOpen className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={async (event) => {
            event.stopPropagation();
            const result = await archiveThread(thread._id, !thread.archived);
            if (result && thread.archived === false) {
              notify('Archived — find it under Archived / Completed', { type: 'info', duration: 3200 });
            }
          }}
          className="btn-subtle bg-white/80 ring-1 ring-hairline"
          title={thread.archived ? 'Restore conversation' : 'Archive conversation'}
        >
          {thread.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
        </button>
        <div className="hidden lg:block">
          <ClassificationSelect thread={thread} onChange={handleOverride} busy={isBusy} size="sm" />
        </div>
      </div>
    </div>
  );
}

export default function ThreadList() {
  const { filteredThreads, loading, selectThread, ui, clearFilters, setSegment } = useApp();

  if (loading && filteredThreads.length === 0) return <ThreadListSkeleton />;

  if (filteredThreads.length === 0) {
    return (
      <EmptyState
        icon={Archive}
        title="Nothing in this segment"
        description="No conversations match the current segment and filters. Try clearing the filters, or switch to All Inbox to see everything Relay has triaged."
        action={
          <button type="button" className="btn-ghost" onClick={clearFilters}>
            Clear filters
          </button>
        }
        secondary={
          <button type="button" className="btn-primary" onClick={() => setSegment('all')}>
            Go to All Inbox
          </button>
        }
      />
    );
  }

  return (
    <div className="pb-2">
      {filteredThreads.map((thread) => (
        <Row key={thread._id} thread={thread} active={ui.selectedId === thread._id} onSelect={selectThread} />
      ))}
    </div>
  );
}
