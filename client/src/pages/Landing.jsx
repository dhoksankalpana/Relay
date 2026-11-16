import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Lock,
  Mail,
  Sparkles,
  UserRound,
  Zap,
} from 'lucide-react';
import { useApp } from '../state/AppStore';
import { ClassificationBadge, ConfidenceMeter } from '../components/Badges';
import { cn } from '../lib/ui';

const SAMPLES = [
  {
    id: 's1',
    who: 'Marcus Vance · Board director',
    subject: 'Term sheet — I need your personal sign-off',
    cls: 'client_reply',
    conf: 93,
    note: 'Sensitive equity terms require Alex’s own voice',
  },
  {
    id: 's2',
    who: 'Priya Raman · Investor',
    subject: 'Q3 board deck — can we book a slot?',
    cls: 'assistant_reply',
    conf: 91,
    note: 'Scheduling is routine — the assistant owns this',
  },
  {
    id: 's3',
    who: 'Northwind SaaS · no-reply',
    subject: 'Your May product changelog',
    cls: 'no_reply',
    conf: 97,
    note: 'Automated digest — nothing to answer',
  },
];

const PILLARS = [
  {
    icon: Zap,
    title: 'Reply responsibility, decided for you',
    body: 'Every thread lands in Assistant to reply, Client to reply, or No reply needed — with a confidence score and the reasoning behind it.',
  },
  {
    icon: Sparkles,
    title: 'Drafts that never send themselves',
    body: 'Relay prepares summaries, extracts meetings and deadlines, and drafts replies — you review and approve every message before it leaves.',
  },
  {
    icon: UserRound,
    title: 'Two views, one source of truth',
    body: 'You get the command centre. Your client gets an ultra-clean queue of only what genuinely needs their personal voice.',
  },
];

export default function Landing() {
  const { login } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState('signup');
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const enter = (user) => {
    login(user);
    navigate('/assistant');
  };

  const submit = (event) => {
    event.preventDefault();
    const email = form.email.trim() || 'sarah.chen@meridianholdings.com';
    const name = mode === 'signup' ? form.name.trim() || 'Sarah Chen' : 'Sarah Chen';
    enter({ name, email, role: 'Executive Assistant' });
  };

  return (
    <div className="min-h-full bg-canvas">
      <div className="mx-auto grid min-h-screen max-w-[1440px] grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        {/* ---------------------------------------------------------- *
         * Value proposition / auth
         * ---------------------------------------------------------- */}
        <div className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-14">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-md">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-accent text-base font-bold text-white shadow-card">R</span>
              <div className="leading-none">
                <p className="text-base font-bold tracking-tight text-slate-900">Relay</p>
                <p className="text-2xs text-slate-400">AI reply-responsibility triage</p>
              </div>
            </div>

            <h1 className="mt-7 text-[28px] font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-[34px]">
              Know who owes a reply —
              <span className="text-accent"> you, your client, or nobody.</span>
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
              Relay triages a high-volume executive inbox, classifies reply responsibility with explainable AI, and keeps the assistant and the
              client perfectly in sync.
            </p>

            <div className="mt-6 space-y-3">
              {PILLARS.map((pillar, index) => (
                <motion.div
                  key={pillar.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index + 0.1, duration: 0.26 }}
                  className="flex items-start gap-3"
                >
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-hairline bg-white shadow-card">
                    <pillar.icon className="size-3.5 text-accent" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">{pillar.title}</p>
                    <p className="text-xs leading-snug text-slate-500">{pillar.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-7 card p-4">
              <div className="mb-3 inline-flex rounded-lg border border-hairline bg-slate-50 p-0.5">
                {[
                  { key: 'signup', label: 'Sign up' },
                  { key: 'login', label: 'Log in' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setMode(tab.key)}
                    className={cn(
                      'rounded-md px-3.5 py-1.5 text-xs font-semibold transition',
                      mode === tab.key ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500 hover:text-slate-800'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <form className="space-y-2.5" onSubmit={submit}>
                {mode === 'signup' ? (
                  <label className="block">
                    <span className="label-caps">Full name</span>
                    <input
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      placeholder="Sarah Chen"
                      className="mt-1 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-accent/15"
                    />
                  </label>
                ) : null}
                <label className="block">
                  <span className="label-caps">Work email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="sarah.chen@meridianholdings.com"
                    className="mt-1 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-accent/15"
                  />
                </label>
                <label className="block">
                  <span className="label-caps">Password</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-accent/15"
                  />
                </label>
                <button type="submit" className="btn-primary w-full">
                  {mode === 'signup' ? 'Create workspace' : 'Log in'} <ArrowRight className="size-4" />
                </button>
              </form>

              <div className="my-3 flex items-center gap-3">
                <span className="h-px flex-1 bg-hairline" />
                <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-slate-400">or</span>
                <span className="h-px flex-1 bg-hairline" />
              </div>

              <button
                type="button"
                className="btn-ghost w-full border-indigo-200 bg-accent-soft text-accent-deep hover:bg-accent-soft"
                onClick={() => enter({ name: 'Sarah Chen', email: 'sarah.chen@meridianholdings.com', role: 'Executive Assistant' })}
              >
                <Bot className="size-4" /> Demo login as Sarah (Executive Assistant)
              </button>

              <p className="mt-3 flex items-start gap-1.5 text-2xs leading-snug text-slate-400">
                <Lock className="mt-px size-3 shrink-0" />
                Credentials are not verified in this prototype — the demo loads a fully seeded executive mailbox with 20 realistic threads.
              </p>
            </div>
          </motion.div>
        </div>

        {/* ---------------------------------------------------------- *
         * Product preview
         * ---------------------------------------------------------- */}
        <div className="relative hidden overflow-hidden border-l border-hairline bg-gradient-to-b from-accent-soft/70 via-canvas to-canvas lg:block">
          <div className="absolute -right-24 -top-24 size-72 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 size-72 rounded-full bg-client-border/30 blur-3xl" />
          <div className="relative flex h-full flex-col justify-center gap-4 px-12">
            <div className="flex items-center gap-2">
              <span className="chip border-hairline bg-white text-slate-500">
                <Sparkles className="size-3 text-review-text" /> Relay triage engine
              </span>
              <span className="chip border-hairline bg-white text-slate-500">Simulated AI · deterministic fallback</span>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.35 }}
              className="card overflow-hidden shadow-pop"
            >
              <header className="flex items-center gap-2 border-b border-hairline bg-white px-4 py-2.5">
                <Mail className="size-3.5 text-accent" />
                <p className="text-xs font-semibold tracking-tight text-slate-800">Assistant inbox — triaged</p>
                <span className="ml-auto text-2xs text-slate-400">3 of 20 threads</span>
              </header>
              <div className="divide-y divide-hairline">
                {SAMPLES.map((sample, index) => (
                  <motion.div
                    key={sample.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + index * 0.08, duration: 0.3 }}
                    className="flex items-start gap-3 bg-white px-4 py-3"
                  >
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-2xs font-semibold text-slate-600">
                      {sample.who.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-2xs text-slate-400">{sample.who}</p>
                      <p className="truncate text-[13px] font-medium text-slate-800">{sample.subject}</p>
                      <p className="mt-0.5 truncate text-2xs text-slate-500">{sample.note}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <ClassificationBadge value={sample.cls} size="sm" />
                        <ConfidenceMeter value={sample.conf} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.35 }}
              className="card max-w-md overflow-hidden shadow-lift"
            >
              <header className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
                <Building2 className="size-3.5 text-client-text" />
                <p className="text-xs font-semibold tracking-tight text-slate-800">Client view — Alex Mercer</p>
                <span className="ml-auto chip border-client-border bg-client-bg text-client-text">1 needs you</span>
              </header>
              <div className="px-4 py-3">
                <p className="text-[13px] font-semibold text-slate-800">Term sheet — I need your personal sign-off</p>
                <p className="mt-1 text-xs leading-snug text-slate-500">
                  Marcus needs your approval on the Q4 equity allocation before Thursday. Sarah prepared the summary and flagged it here because
                  the terms require your own voice.
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="chip border-client-border bg-client-bg text-client-text">
                    <UserRound className="size-3" /> Why your input is needed
                  </span>
                  <span className="chip border-assistant-border bg-assistant-bg text-assistant-text">
                    <CheckCircle2 className="size-3" /> Sarah can take the rest
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
