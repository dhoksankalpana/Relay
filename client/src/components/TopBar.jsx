import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bot,
  Building2,
  Database,
  LogOut,
  Menu,
  PanelRightOpen,
  RefreshCw,
  Settings2,
  Sparkles,
  Sparkles as SparklesIcon,
  Zap,
} from 'lucide-react';
import { useApp } from '../state/AppStore';
import { Avatar, StatePill } from './Badges';
import { cn } from '../lib/ui';

function RoleSwitcher({ role, onChange, compact = false }) {
  const options = [
    { key: 'assistant', label: 'Assistant', sub: 'Sarah', icon: Bot },
    { key: 'client', label: 'Client View', sub: 'Alex Mercer', icon: Building2 },
  ];
  return (
    <div className="inline-flex items-center rounded-full border border-hairline bg-slate-100/80 p-0.5 shadow-inner">
      {options.map((option) => {
        const active = role === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={cn(
              'relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition',
              active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
            )}
            aria-pressed={active}
          >
            {active ? (
              <motion.span
                layoutId="role-pill"
                className="absolute inset-0 rounded-full bg-white shadow-card ring-1 ring-hairline"
                transition={{ type: 'spring', stiffness: 480, damping: 34 }}
              />
            ) : null}
            <option.icon className="relative size-3.5" />
            <span className="relative">{compact ? option.sub : option.label}</span>
            {!compact ? <span className={cn('relative text-2xs font-medium', active ? 'text-slate-400' : 'text-slate-400')}>· {option.sub}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export default function TopBar({ onOpenNav, onOpenAccounts }) {
  const { role, switchRole, session, user, aiStatus, accounts, refresh, busy, setCopilotOpen, ui, notify, logout } = useApp();
  const navigate = useNavigate();

  const handleRole = (next) => {
    switchRole(next);
    navigate(next === 'client' ? '/client' : '/assistant');
    notify(next === 'client' ? 'Previewing the client view as Alex Mercer' : 'Back in the assistant command center', {
      type: 'info',
      duration: 2600,
    });
  };

  const handleSync = async () => {
    const target = accounts.find((a) => a.connected);
    if (!target) {
      notify('No connected mailbox', { type: 'error', detail: 'Connect Gmail or Outlook to sync.' });
      return;
    }
    const result = await refresh({ silent: true });
    if (result) {
      notify('Inbox synced — AI classifier re-ran on new mail', { type: 'info', detail: 'No new messages arrived in this demo mailbox.' });
    }
  };

  const live = Boolean(aiStatus?.live);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
        <button type="button" className="btn-subtle lg:hidden" onClick={onOpenNav} aria-label="Open navigation">
          <Menu className="size-4" />
        </button>

        <div className="flex items-center gap-2 lg:w-[248px]">
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-xs font-bold text-white shadow-card">R</span>
          <div className="leading-none">
            <p className="text-sm font-semibold tracking-tight text-slate-900">Relay</p>
            <p className="hidden text-2xs text-slate-400 sm:block">AI reply-responsibility triage</p>
          </div>
        </div>

        <div className="ml-1 hidden md:block">
          <RoleSwitcher role={role} onChange={handleRole} />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <StatePill tone={live ? 'live' : 'simulated'} className="hidden xl:inline-flex">
            {live ? `Live LLM · ${aiStatus?.provider}` : 'Simulated AI'}
          </StatePill>
          <StatePill tone="neutral" className="hidden 2xl:inline-flex">
            <Database className="size-3" />
            {aiStatus?.storage === 'mongodb' ? 'MongoDB' : 'In-memory store'}
          </StatePill>

          <button
            type="button"
            onClick={() => setCopilotOpen(!ui.copilotOpen)}
            className={cn('btn-ghost hidden sm:inline-flex', ui.copilotOpen ? 'border-indigo-200 bg-accent-soft text-accent-deep' : '')}
            title="Toggle the AI copilot"
          >
            <SparklesIcon className="size-4" />
            <span className="hidden lg:inline">Ask AI</span>
            <PanelRightOpen className="size-3.5 opacity-60" />
          </button>

          <button type="button" onClick={handleSync} className="btn-ghost" disabled={busy.sync} title="Sync all connected mailboxes">
            <RefreshCw className={cn('size-4', busy.sync && 'animate-spin')} />
            <span className="hidden lg:inline">Sync</span>
          </button>

          <button type="button" onClick={onOpenAccounts} className="btn-ghost px-2" title="Connected accounts & settings">
            <Settings2 className="size-4" />
          </button>

          <div className="ml-1 hidden items-center gap-2 rounded-full border border-hairline bg-white py-1 pl-1 pr-2.5 shadow-card sm:flex">
            <Avatar name={role === 'client' ? user?.client?.name || 'Alex Mercer' : user?.assistant?.name || 'Sarah Chen'} size="sm" />
            <div className="leading-none">
              <p className="text-2xs font-semibold text-slate-800">
                {role === 'client' ? user?.client?.name || 'Alex Mercer' : user?.assistant?.name || 'Sarah Chen'}
              </p>
              <p className="text-[10px] text-slate-400">
                {busy.reset ? 'resetting…' : accounts.some((a) => a.connected) ? 'Synced just now' : 'No mailbox'}
              </p>
            </div>
          </div>

          {session ? (
            <button
              type="button"
              className="btn-subtle hidden sm:inline-flex"
              onClick={() => {
                logout();
                navigate('/');
              }}
              title="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-hairline px-3 py-2 md:hidden">
        <RoleSwitcher role={role} onChange={handleRole} compact />
        <div className="flex items-center gap-1.5">
          <StatePill tone={live ? 'live' : 'simulated'}>{live ? 'Live LLM' : 'Simulated AI'}</StatePill>
          <button type="button" className="btn-subtle" onClick={() => setCopilotOpen(!ui.copilotOpen)} title="AI copilot">
            {ui.copilotOpen ? <Zap className="size-4" /> : <Sparkles className="size-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
