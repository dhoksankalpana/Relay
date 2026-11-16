import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, PanelRightOpen, PlugZap, Sparkles, X } from 'lucide-react';
import { useApp } from '../state/AppStore';
import { cn } from '../lib/ui';
import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import FilterBar from '../components/FilterBar';
import MetricsRow from '../components/MetricsRow';
import ThreadList from '../components/ThreadList';
import ThreadDetail from '../components/ThreadDetail';
import CopilotPanel from '../components/CopilotPanel';
import ConnectionWizard from '../components/ConnectionWizard';
import AccountsModal from '../components/AccountsModal';
import { StatePill } from '../components/Badges';
import { MetricsSkeleton, ThreadListSkeleton, ThreadDetailSkeleton } from '../components/Skeletons';

function WorkspaceSkeleton() {
  return (
    <div className="flex h-screen flex-col bg-canvas">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-hairline px-4">
        <div className="skel size-7 rounded-lg" />
        <div className="skel h-4 w-24" />
        <div className="ml-auto skel h-7 w-40 rounded-full" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[252px] shrink-0 space-y-3 border-r border-hairline p-3 lg:block">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="skel h-7 w-full rounded-lg" />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-hairline p-3">
            <MetricsSkeleton />
          </div>
          <div className="flex min-h-0 flex-1">
            <div className="w-full border-r border-hairline lg:w-[400px]">
              <ThreadListSkeleton />
            </div>
            <div className="hidden flex-1 lg:block">
              <ThreadDetailSkeleton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AssistantWorkspace() {
  const {
    loading,
    data,
    accounts,
    openWizard,
    closeWizard,
    setAccountsOpen,
    aiStatus,
    filteredThreads,
    ui,
    setCopilotOpen,
  } = useApp();
  const [navOpen, setNavOpen] = useState(false);
  const [pulseOpen, setPulseOpen] = useState(false);

  if (loading && !data) return <WorkspaceSkeleton />;

  const outlook = accounts.find((a) => a.provider === 'outlook');
  const showConnect = outlook && !outlook.connected;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <TopBar onOpenNav={() => setNavOpen(true)} onOpenAccounts={() => setAccountsOpen(true)} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="hidden w-[252px] shrink-0 border-r border-hairline bg-white/50 lg:block">
          <NavRail />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Executive pulse overview */}
          <section className="shrink-0 border-b border-hairline px-3 py-3 sm:px-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold tracking-tight text-slate-900">Executive pulse</p>
                <p className="text-2xs text-slate-400">
                  Click any metric to filter the inbox · triaged by {aiStatus?.live ? `live LLM (${aiStatus.provider})` : 'the deterministic engine'}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <StatePill tone={aiStatus?.live ? 'live' : 'simulated'} className="hidden sm:inline-flex">
                  {aiStatus?.live ? 'Live LLM' : 'Simulated AI'}
                </StatePill>
                {showConnect ? (
                  <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => openWizard('outlook')}>
                    <PlugZap className="size-3.5" /> Connect Outlook
                  </button>
                ) : null}
                <button
                  type="button"
                  className={cn('btn-ghost py-1.5 text-xs lg:hidden', pulseOpen && 'border-indigo-200 bg-accent-soft text-accent-deep')}
                  onClick={() => setPulseOpen((value) => !value)}
                  aria-expanded={pulseOpen}
                >
                  <Sparkles className="size-3.5" /> Metrics
                  <ChevronDown className={cn('size-3 transition', pulseOpen && 'rotate-180')} />
                </button>
                <button
                  type="button"
                  className="btn-ghost hidden py-1.5 text-xs sm:inline-flex xl:hidden"
                  onClick={() => setCopilotOpen(true)}
                >
                  <PanelRightOpen className="size-3.5" /> Ask AI
                </button>
              </div>
            </div>

            <div className={cn('mt-3', pulseOpen ? 'block' : 'hidden lg:block')}>
              <MetricsRow />
            </div>
          </section>

          {/* Conversation list + detail */}
          <div className="flex min-h-0 flex-1">
            <section
              className={cn(
                'min-h-0 w-full flex-col border-r border-hairline bg-white lg:flex lg:w-[400px] xl:w-[420px]',
                ui.mobilePane === 'detail' ? 'hidden lg:flex' : 'flex'
              )}
              aria-label="Conversation list"
            >
              <FilterBar resultCount={filteredThreads.length} />
              <div className="min-h-0 flex-1 overflow-y-auto scroller">
                <ThreadList />
              </div>
            </section>

            <section
              className={cn('min-h-0 flex-1 flex-col', ui.mobilePane === 'detail' ? 'flex' : 'hidden lg:flex')}
              aria-label="Thread detail"
            >
              <ThreadDetail />
            </section>
          </div>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      <AnimatePresence>
        {navOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[45] bg-slate-900/25 backdrop-blur-[2px] lg:hidden"
              onClick={() => setNavOpen(false)}
            />
            <motion.div
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="fixed bottom-0 left-0 top-0 z-[46] flex w-[280px] flex-col border-r border-hairline bg-canvas lg:hidden"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center gap-2 border-b border-hairline px-3 py-3">
                <span className="grid size-7 place-items-center rounded-lg bg-accent text-xs font-bold text-white">R</span>
                <p className="text-sm font-semibold tracking-tight text-slate-900">Navigation</p>
                <button type="button" className="btn-subtle ml-auto" onClick={() => setNavOpen(false)} aria-label="Close navigation">
                  <X className="size-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <NavRail onClose={() => setNavOpen(false)} />
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <CopilotPanel />
      <ConnectionWizard onDone={closeWizard} />
      <AccountsModal />
    </div>
  );
}
