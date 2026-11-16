import { AnimatePresence, motion } from 'framer-motion';
import { Database, Link2, PlugZap, RefreshCw, Sparkles, Unplug, X } from 'lucide-react';
import { useApp } from '../state/AppStore';
import { PROVIDERS, cn, relativeTime } from '../lib/ui';
import { StatePill } from './Badges';

const syncedLabel = (iso) => {
  if (!iso) return 'Never synced';
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins < 1) return 'Synced just now';
  return `Synced ${relativeTime(iso)}`;
};

export default function AccountsModal() {
  const { ui, setAccountsOpen, accounts, syncAccount, disconnectAccount, openWizard, busy, aiStatus } = useApp();
  const open = ui.accountsOpen;

  const connected = accounts.filter((a) => a.connected);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="accounts-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAccountsOpen(false)}
            className="fixed inset-0 z-[55] bg-slate-900/25 backdrop-blur-[2px]"
          />
          <motion.aside
            key="accounts"
            initial={{ x: 28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 28, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="fixed bottom-0 right-0 top-0 z-[56] flex w-full max-w-md flex-col border-l border-hairline bg-white shadow-pop"
            role="dialog"
            aria-modal="true"
            aria-label="Connected accounts"
          >
            <header className="flex items-center gap-2.5 border-b border-hairline px-4 py-3">
              <span className="grid size-7 place-items-center rounded-lg bg-accent-soft">
                <Link2 className="size-4 text-accent" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight text-slate-900">Accounts &amp; connections</p>
                <p className="text-2xs text-slate-400">
                  {connected.length} of {accounts.length} mailboxes connected · simulated OAuth
                </p>
              </div>
              <button type="button" className="btn-subtle ml-auto" onClick={() => setAccountsOpen(false)} aria-label="Close">
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 scroller">
              <section className="space-y-2">
                <p className="label-caps">Connected mailboxes</p>
                {accounts.map((account) => {
                  const provider = PROVIDERS[account.provider] || PROVIDERS.gmail;
                  const isBusy = busy.sync || busy.disconnect;
                  return (
                    <div key={account._id} className="card p-3">
                      <div className="flex items-start gap-2.5">
                        <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg border text-sm font-bold', provider.badge)}>
                          {provider.glyph}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[13px] font-semibold text-slate-800">{provider.label}</p>
                            <StatePill tone={account.connected ? 'live' : 'neutral'}>
                              {account.connected ? 'Connected' : 'Not connected'}
                            </StatePill>
                          </div>
                          <p className="truncate text-2xs text-slate-400">{account.connected ? account.email : 'No mailbox linked'}</p>
                          <p className="mt-0.5 text-2xs tabular-nums text-slate-400">
                            {account.connected ? syncedLabel(account.lastSyncedAt) : 'Connect to import and triage threads'}
                            {account.scopes?.length ? ` · ${account.scopes.length} scopes granted` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {account.connected ? (
                          <>
                            <button
                              type="button"
                              className="btn-ghost py-1.5 text-xs"
                              disabled={isBusy}
                              onClick={() => syncAccount(account._id)}
                            >
                              <RefreshCw className={cn('size-3.5', busy.sync && 'animate-spin')} /> Sync now
                            </button>
                            <button
                              type="button"
                              className="btn-subtle text-xs"
                              disabled={isBusy}
                              onClick={() => disconnectAccount(account._id, provider.label)}
                            >
                              <Unplug className="size-3.5" /> Disconnect
                            </button>
                          </>
                        ) : (
                          <button type="button" className="btn-primary py-1.5 text-xs" onClick={() => openWizard(account.provider)}>
                            <PlugZap className="size-3.5" /> Connect {provider.label}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>

              <section className="space-y-2">
                <p className="label-caps">Add another mailbox</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.values(PROVIDERS).map((provider) => (
                    <button
                      key={provider.key}
                      type="button"
                      onClick={() => openWizard(provider.key)}
                      className="card flex flex-col items-start gap-2 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-lift"
                    >
                      <span className={cn('grid size-8 place-items-center rounded-lg border text-sm font-bold', provider.badge)}>
                        {provider.glyph}
                      </span>
                      <span>
                        <span className="block text-xs font-semibold text-slate-800">{provider.label}</span>
                        <span className="block text-2xs text-slate-400">{provider.sub}</span>
                      </span>
                      <span className="chip border-hairline bg-slate-50 text-slate-500">
                        <PlugZap className="size-3" /> Run setup
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-hairline bg-slate-50 p-3">
                <p className="label-caps mb-2">Simulated vs. live</p>
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                      <Sparkles className="size-3.5 text-review-text" /> AI processing
                    </span>
                    <StatePill tone={aiStatus?.live ? 'live' : 'simulated'}>{aiStatus?.live ? `Live LLM · ${aiStatus.provider}` : 'Simulated AI'}</StatePill>
                  </div>
                  <p className="text-2xs leading-snug text-slate-500">{aiStatus?.detail}</p>
                  <div className="flex items-start justify-between gap-2 border-t border-hairline pt-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                      <Database className="size-3.5 text-slate-400" /> Storage
                    </span>
                    <StatePill tone="neutral" dot={false}>
                      {aiStatus?.storage === 'mongodb' ? 'MongoDB' : 'In-memory store'}
                    </StatePill>
                  </div>
                  <p className="text-2xs leading-snug text-slate-500">
                    {aiStatus?.storage === 'mongodb'
                      ? 'Threads and accounts are persisted to MongoDB.'
                      : 'No MONGODB_URI set — Relay is running a seeded in-memory store so the prototype works out of the box.'}
                  </p>
                </div>
              </section>
            </div>

            <footer className="border-t border-hairline px-4 py-3">
              <button type="button" className="btn-ghost w-full" onClick={() => setAccountsOpen(false)}>
                Done
              </button>
            </footer>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
