import { cn } from '../lib/ui';

export default function EmptyState({ icon: Icon, title, description, action, secondary, className, compact = false }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-6 py-10' : 'px-6 py-16', className)}>
      {Icon ? (
        <div className="mb-3.5 flex size-11 items-center justify-center rounded-xl border border-hairline bg-white shadow-card">
          <Icon className="size-5 text-slate-400" />
        </div>
      ) : null}
      <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-slate-500">{description}</p> : null}
      {action || secondary ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondary}
        </div>
      ) : null}
    </div>
  );
}
