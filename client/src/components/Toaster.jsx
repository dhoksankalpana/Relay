import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, Sparkles, X } from 'lucide-react';
import { useApp } from '../state/AppStore';
import { cn } from '../lib/ui';

const TYPES = {
  success: { icon: CheckCircle2, ring: 'border-assistant-border bg-assistant-bg/70', iconTone: 'text-assistant-text' },
  info: { icon: Info, ring: 'border-indigo-200 bg-accent-soft/80', iconTone: 'text-accent-deep' },
  ai: { icon: Sparkles, ring: 'border-review-border bg-review-bg/80', iconTone: 'text-review-text' },
  error: { icon: AlertTriangle, ring: 'border-rose-200 bg-rose-50/80', iconTone: 'text-rose-600' },
};

export default function Toaster() {
  const { toasts, dismissToast } = useApp();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:items-end">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const tone = TYPES[toast.type] || TYPES.success;
          const Icon = tone.icon;
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-3.5 py-3 shadow-pop backdrop-blur',
                tone.ring
              )}
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0', tone.iconTone)} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-snug text-slate-900">{toast.title}</p>
                {toast.detail ? <p className="mt-0.5 text-xs leading-snug text-slate-500">{toast.detail}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded-md p-1 text-slate-400 transition hover:bg-white/70 hover:text-slate-700"
                aria-label="Dismiss notification"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
