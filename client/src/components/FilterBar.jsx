import { Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { useApp } from '../state/AppStore';
import { SEGMENT_LABELS, cn } from '../lib/ui';

const CHIPS = [
  { key: 'unread', label: 'Unread Only' },
  { key: 'highPriority', label: 'High Priority' },
  { key: 'gmail', label: 'Gmail' },
  { key: 'outlook', label: 'Outlook' },
];

export default function FilterBar({ resultCount }) {
  const { ui, setQuery, toggleChip, clearFilters, accounts } = useApp();
  const activeChips = Object.values(ui.chips).filter(Boolean).length;
  const hasOutlook = accounts.some((a) => a.provider === 'outlook' && a.connected);

  return (
    <div className="border-b border-hairline bg-canvas/90 px-3 py-2.5 backdrop-blur sm:px-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={ui.query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sender, subject, body or AI summary…"
            className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-8 text-sm text-slate-800 shadow-card outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-accent/15"
          />
          {ui.query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <span className="hidden items-center gap-1.5 rounded-lg border border-hairline bg-white px-2.5 py-2 text-2xs font-medium text-slate-500 shadow-card sm:inline-flex">
          <SlidersHorizontal className="size-3.5 text-slate-400" />
          <span className="tabular-nums">{resultCount}</span> in {SEGMENT_LABELS[ui.segment] || 'All Inbox'}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5 scroller">
        <span className="inline-flex shrink-0 items-center gap-1 text-2xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          <Filter className="size-3" /> Filters
        </span>
        {CHIPS.map((chip) => {
          const disabled = chip.key === 'outlook' && !hasOutlook;
          const active = ui.chips[chip.key];
          return (
            <button
              key={chip.key}
              type="button"
              disabled={disabled}
              onClick={() => toggleChip(chip.key)}
              title={disabled ? 'Connect Microsoft 365 to enable this filter' : undefined}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition',
                active
                  ? 'border-indigo-200 bg-accent-soft text-accent-deep shadow-card'
                  : 'border-hairline bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800',
                disabled && 'cursor-not-allowed opacity-40 hover:border-hairline'
              )}
            >
              {chip.label}
            </button>
          );
        })}
        {activeChips > 0 || ui.query ? (
          <button type="button" onClick={clearFilters} className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-slate-500 underline decoration-dotted hover:text-slate-800">
            Clear ({activeChips + (ui.query ? 1 : 0)})
          </button>
        ) : null}
      </div>
    </div>
  );
}
