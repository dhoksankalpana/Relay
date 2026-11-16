import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Lock, Mail, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useApp } from '../state/AppStore';
import { PROVIDERS, cn } from '../lib/ui';

const SCOPE_COPY = {
  read: { label: 'Read email', detail: 'Read threads, participants and message bodies so Relay can triage them.' },
  organize: { label: 'Organize', detail: 'Apply labels, archive and mark threads as completed on your behalf.' },
  draft: { label: 'Draft replies', detail: 'Create draft replies in your mailbox — never sent without your approval.' },
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ConnectionWizard({ onDone }) {
  const { ui, closeWizard, connectProvider } = useApp();
  const provider = PROVIDERS[ui.wizardProvider] || PROVIDERS.outlook;

  return (
    <AnimatePresence>
      {ui.wizardOpen ? (
        <WizardBody key="wizard" provider={provider} onClose={closeWizard} onDone={onDone} connectProvider={connectProvider} />
      ) : null}
    </AnimatePresence>
  );
}

function WizardBody({ provider, onClose, onDone, connectProvider }) {
  const [step, setStep] = useState('permissions');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  const steps = [
    'Handshake with the identity provider…',
    `Authorising scopes for ${provider.label}…`,
    'Fetching threads from the mailbox…',
    'Running AI Reply Responsibility Classifier…',
    'Extracting meetings, deadlines and action items…',
  ];

  const run = async () => {
    setStep('connecting');
    setProgress(0);
    const call = connectProvider(provider.key);
    for (let index = 0; index < steps.length; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      await wait(520);
      setProgress(Math.round(((index + 1) / steps.length) * 100));
    }
    const answer = await call;
    setResult(answer);
    setStep(answer ? 'complete' : 'error');
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-slate-900/30 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="fixed left-1/2 top-1/2 z-[61] max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto scroller"
        role="dialog"
        aria-modal="true"
      >
        <div className="card overflow-hidden shadow-pop">
          <header className="flex items-center gap-2.5 border-b border-hairline px-4 py-3">
            <span className={cn('grid size-8 place-items-center rounded-lg border text-sm font-bold', provider.badge)}>{provider.glyph}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-slate-900">Connect {provider.label}</p>
              <p className="text-2xs text-slate-400">{provider.sub} · simulated OAuth 2.0 flow</p>
            </div>
            <span className="chip ml-auto border-amber-200 bg-amber-50 text-amber-700">Simulated</span>
          </header>

          <div className="space-y-3.5 p-4">
            {step === 'permissions' ? (
              <>
                <div className="rounded-lg border border-hairline bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-800">Relay is requesting permission to:</p>
                  <ul className="mt-2 space-y-2">
                    {['read', 'organize', 'draft'].map((scope) => (
                      <li key={scope} className="flex items-start gap-2">
                        <ShieldCheck className="mt-px size-3.5 shrink-0 text-accent" />
                        <span className="text-xs text-slate-600">
                          <strong className="font-semibold text-slate-800">{SCOPE_COPY[scope].label}</strong> — {SCOPE_COPY[scope].detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-hairline p-2.5 text-2xs text-slate-500">
                  <Lock className="mt-px size-3 shrink-0 text-slate-400" />
                  <p>
                    This is a simulated consent screen — no real credentials are exchanged and no mail leaves the demo environment. A live
                    provider can be wired up later by adding an OAuth app and a <code className="rounded bg-slate-100 px-1">MONGODB_URI</code>.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-primary flex-1" onClick={run}>
                    <Mail className="size-4" /> Allow &amp; fetch threads
                  </button>
                  <button type="button" className="btn-ghost" onClick={onClose}>
                    Cancel
                  </button>
                </div>
              </>
            ) : null}

            {step === 'connecting' ? (
              <div className="space-y-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <motion.div
                    className="h-full rounded-full bg-accent"
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: 'easeOut', duration: 0.4 }}
                  />
                </div>
                <ul className="space-y-2">
                  {steps.map((label, index) => {
                    const threshold = Math.round(((index + 1) / steps.length) * 100);
                    const done = progress >= threshold;
                    const current = !done && progress >= Math.round((index / steps.length) * 100);
                    return (
                      <li key={label} className="flex items-start gap-2 text-xs">
                        {done ? (
                          <CheckCircle2 className="mt-px size-3.5 shrink-0 text-assistant-text" />
                        ) : current ? (
                          <span className="mt-1 size-3 shrink-0 animate-pulse rounded-full bg-accent" />
                        ) : (
                          <span className="mt-1 size-3 shrink-0 rounded-full border border-slate-200" />
                        )}
                        <span className={cn(done ? 'text-slate-700' : current ? 'font-medium text-slate-800' : 'text-slate-400')}>{label}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {step === 'complete' ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 rounded-lg border border-assistant-border bg-assistant-bg p-3">
                  <CheckCircle2 className="mt-px size-4 shrink-0 text-assistant-text" />
                  <div className="text-xs text-slate-700">
                    <p className="font-semibold text-slate-900">Mailbox connected and triaged</p>
                    <p className="mt-0.5">
                      {result?.fetched ?? 0} thread{(result?.fetched ?? 0) === 1 ? '' : 's'} imported from {provider.label}. Every thread was
                      classified, summarised and scanned for meetings and deadlines.
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-hairline bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="mb-1 font-semibold text-slate-800">What Relay did with the new mail</p>
                  <ul className="space-y-1">
                    <li>• Assigned reply responsibility (assistant / client / no reply)</li>
                    <li>• Flagged anything below 75% confidence for your review</li>
                    <li>• Added extracted appointments to the meetings strip</li>
                  </ul>
                </div>
                <button type="button" className="btn-primary w-full" onClick={onDone}>
                  Open the inbox
                </button>
              </div>
            ) : null}

            {step === 'error' ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  <TriangleAlert className="mt-px size-4 shrink-0" />
                  <p>We could not complete the simulated handshake. Check that the API server is running on port 5050 and try again.</p>
                </div>
                <button type="button" className="btn-ghost w-full" onClick={onClose}>
                  Close
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>
    </>
  );
}
