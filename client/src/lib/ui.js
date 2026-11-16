import { ClipboardCheck, Inbox, Sparkles, UserRound } from 'lucide-react';

export const cn = (...parts) => parts.filter(Boolean).join(' ');

/* ---------------------------------------------------------------- *
 * Reply-responsibility presentation
 * ---------------------------------------------------------------- */
export const CLASSIFICATIONS = {
  assistant_reply: {
    key: 'assistant_reply',
    label: 'Assistant to Reply',
    short: 'Assistant',
    chip: 'bg-assistant-bg text-assistant-text border-assistant-border',
    dot: 'bg-assistant-text',
    solid: 'bg-emerald-600 text-white',
    soft: 'bg-assistant-bg',
    text: 'text-assistant-text',
    border: 'border-assistant-border',
    icon: ClipboardCheck,
    helper: 'Sarah owns the next reply',
  },
  client_reply: {
    key: 'client_reply',
    label: 'Client to Reply',
    short: 'Client',
    chip: 'bg-client-bg text-client-text border-client-border',
    dot: 'bg-client-text',
    solid: 'bg-amber-600 text-white',
    soft: 'bg-client-bg',
    text: 'text-client-text',
    border: 'border-client-border',
    icon: UserRound,
    helper: 'Needs Alex’s own voice',
  },
  no_reply: {
    key: 'no_reply',
    label: 'No Reply Needed',
    short: 'No reply',
    chip: 'bg-none-bg text-none-text border-none-border',
    dot: 'bg-none-text',
    solid: 'bg-slate-500 text-white',
    soft: 'bg-none-bg',
    text: 'text-none-text',
    border: 'border-none-border',
    icon: Inbox,
    helper: 'Informational — file it',
  },
};

export const CLASSIFICATION_ORDER = ['assistant_reply', 'client_reply', 'no_reply'];

export const meta = (key) => CLASSIFICATIONS[key] || CLASSIFICATIONS.no_reply;

export const REVIEW = {
  key: 'review',
  label: 'Needs Assistant Review',
  short: 'Review',
  chip: 'bg-review-bg text-review-text border-review-border',
  dot: 'bg-review-text',
  text: 'text-review-text',
  soft: 'bg-review-bg',
  border: 'border-review-border',
  icon: Sparkles,
};

export const confidenceTone = (value) => {
  if (value >= 85) return { text: 'text-assistant-text', bg: 'bg-assistant-bg', border: 'border-assistant-border' };
  if (value >= 75) return { text: 'text-accent-deep', bg: 'bg-accent-soft', border: 'border-indigo-200' };
  return { text: 'text-review-text', bg: 'bg-review-bg', border: 'border-review-border' };
};

/* ---------------------------------------------------------------- *
 * Segments
 * ---------------------------------------------------------------- */
export const SEGMENT_GROUPS = [
  {
    title: 'Responsibility',
    items: [
      { key: 'all', label: 'All Inbox', countKey: 'all' },
      { key: 'assistant', label: 'Assistant to Reply', countKey: 'assistant', tone: 'assistant' },
      { key: 'client', label: 'Client to Reply', countKey: 'client', tone: 'client' },
      { key: 'no_reply', label: 'No Reply Needed', countKey: 'no_reply', tone: 'none' },
      { key: 'needs_review', label: 'Needs Review', countKey: 'needs_review', tone: 'review' },
    ],
  },
  {
    title: 'Workflow',
    items: [
      { key: 'action', label: 'Action Required', countKey: 'action' },
      { key: 'waiting', label: 'Waiting for Response', countKey: 'waiting' },
      { key: 'meetings', label: 'Meetings & Appointments', countKey: 'meetings' },
      { key: 'important', label: 'Important', countKey: 'important' },
      { key: 'general', label: 'General', countKey: 'general' },
      { key: 'archived', label: 'Archived / Completed', countKey: 'archived' },
    ],
  },
];

export const SEGMENT_LABELS = Object.fromEntries(SEGMENT_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label])));

export const TONE_DOT = {
  assistant: 'bg-assistant-text',
  client: 'bg-client-text',
  none: 'bg-none-text',
  review: 'bg-review-text',
};

/* ---------------------------------------------------------------- *
 * Metric cards
 * ---------------------------------------------------------------- */
export const METRIC_CARDS = [
  { key: 'total', label: 'Total Emails', segment: 'all', hint: 'Everything in scope' },
  { key: 'unread', label: 'Unread', segment: 'all', chip: 'unread', hint: 'Not opened yet' },
  { key: 'important', label: 'Important', segment: 'important', hint: 'Flagged as important' },
  { key: 'actionRequired', label: 'Action Required', segment: 'action', hint: 'Someone owes an action' },
  { key: 'waiting', label: 'Waiting for Response', segment: 'waiting', hint: 'Ball is in their court' },
  { key: 'assistantReply', label: 'Assistant to Reply', segment: 'assistant', tone: 'assistant', hint: 'Assigned to me' },
  { key: 'clientReply', label: 'Client to Reply', segment: 'client', tone: 'client', hint: 'Needs client attention' },
];

/* ---------------------------------------------------------------- *
 * Formatting
 * ---------------------------------------------------------------- */
export const timeOf = (iso) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export const dayOf = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const fullStamp = (iso) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const meetingStamp = (iso) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const relativeTime = (iso) => {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return dayOf(iso);
};

export const listStamp = (iso) => {
  const d = new Date(iso);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDay = new Date(d);
  startOfDay.setHours(0, 0, 0, 0);
  const days = Math.round((startOfToday - startOfDay) / 86400000);
  if (days <= 0) return timeOf(iso);
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return dayOf(iso);
};

export const untilLabel = (iso) => {
  const target = new Date(iso);
  const now = new Date();
  const days = Math.round((target.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 0) return 'Past due';
  if (days < 7) return `In ${days} days`;
  return `${Math.round(days / 7)} week${days >= 14 ? 's' : ''}`;
};

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
  'bg-slate-200 text-slate-700',
];

export const avatarTone = (seed = '') => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

export const PROVIDERS = {
  gmail: {
    key: 'gmail',
    label: 'Google Workspace',
    sub: 'Gmail · Calendar',
    ring: 'ring-rose-100',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    glyph: 'G',
  },
  outlook: {
    key: 'outlook',
    label: 'Microsoft 365',
    sub: 'Outlook · Exchange',
    ring: 'ring-sky-100',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    glyph: 'O',
  },
};

export const TONES = ['Professional', 'Concise', 'Warm', 'Firm'];

export const COPILOT_PROMPTS = [
  'Show me emails that need my attention.',
  'Summarize this conversation.',
  'What am I waiting for a response on?',
  'Which emails require the client’s attention?',
  'Why has this email been assigned to the client?',
  'Draft a reply to this conversation.',
];
