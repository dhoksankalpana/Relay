import { AlertCircle, Check, ChevronDown, Sparkles } from 'lucide-react';
import { CLASSIFICATIONS, CLASSIFICATION_ORDER, PROVIDERS, REVIEW, avatarTone, cn, confidenceTone, initials, meta } from '../lib/ui';

export function Avatar({ name, size = 'md', tone }) {
  const sizes = {
    sm: 'size-7 text-2xs',
    md: 'size-9 text-xs',
    lg: 'size-10 text-sm',
  };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-inset ring-black/[0.04]',
        sizes[size],
        tone || avatarTone(name)
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function ClassificationBadge({ value, size = 'md', showIcon = true, withReview = false }) {
  const m = meta(value);
  const Icon = m.icon;
  return (
    <span className={cn('chip', m.chip, size === 'sm' ? 'px-1.5 text-[10px]' : '')}>
      {showIcon ? <Icon className={size === 'sm' ? 'size-2.5' : 'size-3'} /> : null}
      {m.label}
      {withReview ? <span className="ml-0.5 text-review-text">•</span> : null}
    </span>
  );
}

export function ReviewFlag({ compact = false }) {
  return (
    <span className={cn('chip', REVIEW.chip)}>
      <span className="relative inline-flex size-1.5 items-center justify-center">
        <span className="absolute inline-flex size-1.5 animate-pulse-ring rounded-full bg-review-text/70" />
        <span className="relative inline-flex size-1.5 rounded-full bg-review-text" />
      </span>
      {compact ? 'Review' : REVIEW.label}
    </span>
  );
}

export function ConfidenceMeter({ value, className, label = true }) {
  const tone = confidenceTone(value);
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} title={`AI confidence ${value}%`}>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
        <span className={cn('block h-full rounded-full', value >= 75 ? 'bg-accent' : 'bg-review-text')} style={{ width: `${value}%` }} />
      </span>
      {label ? (
        <span className={cn('text-2xs font-semibold tabular-nums', tone.text)}>{value}%</span>
      ) : null}
    </span>
  );
}

export function ProviderPill({ provider, compact = false }) {
  const p = PROVIDERS[provider] || PROVIDERS.gmail;
  return (
    <span className={cn('chip', p.badge)} title={p.sub}>
      <span className="font-bold">{p.glyph}</span>
      {compact ? null : p.label}
    </span>
  );
}

export function StatePill({ tone = 'simulated', children, className, dot = true }) {
  const tones = {
    simulated: 'border-amber-200 bg-amber-50 text-amber-700',
    live: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    neutral: 'border-hairline bg-slate-50 text-slate-600',
  };
  return (
    <span className={cn('chip', tones[tone], className)}>
      {dot ? (
        <span className={cn('size-1.5 rounded-full', tone === 'live' ? 'bg-emerald-500' : tone === 'simulated' ? 'bg-amber-500' : 'bg-slate-400')} />
      ) : null}
      {children}
    </span>
  );
}

/** Inline override selector used on rows and in the thread header. */
export function ClassificationSelect({ thread, onChange, busy, size = 'md' }) {
  const current = thread.ai.classification;
  const overridden = thread.ai.overridden;

  return (
    <div className="relative inline-flex items-center">
      <select
        aria-label="Override reply responsibility"
        className={cn(
          'cursor-pointer appearance-none rounded-lg border pr-7 font-semibold transition',
          size === 'sm' ? 'py-1 pl-2 text-2xs' : 'py-1.5 pl-2.5 text-xs',
          'bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
          overridden ? 'border-accent ring-1 ring-accent/20' : 'border-hairline',
          busy ? 'opacity-60' : ''
        )}
        value={current}
        disabled={busy}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => event.stopPropagation()}
      >
        {CLASSIFICATION_ORDER.map((key) => (
          <option key={key} value={key}>
            {overridden && key === current ? '✓ ' : ''}
            {CLASSIFICATIONS[key].label}
          </option>
        ))}
      </select>
      <ChevronDown className={cn('pointer-events-none absolute right-2 text-slate-400', size === 'sm' ? 'size-3' : 'size-3.5')} />
    </div>
  );
}

export function OverrideFlag({ thread, onReset, busy }) {
  if (!thread.ai.overridden) return null;
  return (
    <span className="chip border-accent bg-accent-soft text-accent-deep">
      <Check className="size-3" /> Manually Overridden
      {onReset ? (
        <button
          type="button"
          className="ml-1 underline decoration-dotted hover:text-accent"
          onClick={(event) => {
            event.stopPropagation();
            onReset();
          }}
          disabled={busy}
        >
          let AI decide
        </button>
      ) : null}
    </span>
  );
}

export function AiChip({ children, tone = 'ai' }) {
  return (
    <span
      className={cn(
        'chip',
        tone === 'ai' ? 'border-review-border bg-review-bg text-review-text' : 'border-hairline bg-slate-50 text-slate-600'
      )}
    >
      <Sparkles className="size-3" />
      {children}
    </span>
  );
}

export function NoteBanner({ children, tone = 'neutral', className }) {
  const tones = {
    neutral: 'border-hairline bg-slate-50 text-slate-600',
    ai: 'border-review-border bg-review-bg text-review-text',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    indigo: 'border-indigo-200 bg-accent-soft text-accent-deep',
    error: 'border-rose-200 bg-rose-50 text-rose-700',
  };
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-snug', tones[tone], className)}>
      <AlertCircle className="mt-px size-3.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
