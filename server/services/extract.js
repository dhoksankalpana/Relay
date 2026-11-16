/**
 * Deterministic entity extraction: action items, deadlines and appointments.
 * Runs over the real conversation text so the "extracted" pills are always
 * grounded in what the emails actually say.
 */

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const TIME_RE = /\b(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/i;
const WEEKDAY_RE = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i;
const MONTHDAY_RE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i;
const ACTION_RE = /(?:please|could you|can you|need you to|needs? to|we need|kindly|i need|requiring|requires|let me know|confirm|review and|sign off on)/i;
const DEADLINE_RE = /\b(by|before|due|deadline|no later than|eod|end of (day|week|month))\b/i;

function sentenceSplit(text) {
  return text
    .replace(/\r/g, '')
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.replace(/^[-•*\d.\s]+/, '').trim())
    .filter(Boolean);
}

function nextWeekdayIndex(target) {
  const now = new Date();
  const today = now.getDay();
  let diff = (target - today + 7) % 7;
  if (diff === 0) diff = 7;
  return diff;
}

function weekdayLabel(target) {
  return WEEKDAYS[target].replace(/^\w/, (c) => c.toUpperCase());
}

/** Resolves a loose date phrase inside a sentence to a concrete Date. */
function resolveWhen(sentence) {
  const base = new Date();
  base.setSeconds(0, 0);
  const time = sentence.match(TIME_RE);
  let hour = time ? Number(time[1]) : 9;
  const minute = time && time[2] ? Number(time[2]) : 0;
  if (time && /pm/i.test(time[3]) && hour < 12) hour += 12;
  if (time && /am/i.test(time[3]) && hour === 12) hour = 0;

  const wd = sentence.match(WEEKDAY_RE);
  const md = sentence.match(MONTHDAY_RE);

  if (wd) {
    const idx = WEEKDAYS.findIndex((d) => d.startsWith(wd[1].toLowerCase().slice(0, 3)));
    const diff = nextWeekdayIndex(idx);
    const d = new Date(base);
    d.setDate(d.getDate() + diff);
    d.setHours(hour, minute, 0, 0);
    return { date: d, label: `${weekdayLabel(idx)}${time ? ` at ${fmtTime(hour, minute)}` : ''}` };
  }
  if (md) {
    const idx = MONTHS.findIndex((m) => m.startsWith(md[1].toLowerCase().slice(0, 3)));
    const d = new Date(base);
    d.setMonth(idx, Number(md[2]));
    d.setHours(hour, minute, 0, 0);
    if (d < base) d.setFullYear(d.getFullYear() + 1);
    return { date: d, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
  }
  if (/tomorrow/i.test(sentence)) {
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    d.setHours(hour, minute, 0, 0);
    return { date: d, label: `Tomorrow${time ? ` at ${fmtTime(hour, minute)}` : ''}` };
  }
  if (/today|eod|end of day/i.test(sentence)) {
    const d = new Date(base);
    d.setHours(hour === 9 ? 18 : hour, minute, 0, 0);
    return { date: d, label: `Today${time ? ` at ${fmtTime(hour, minute)}` : ' (EOD)'}` };
  }
  if (time) {
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    d.setHours(hour, minute, 0, 0);
    return { date: d, label: `Next available slot at ${fmtTime(hour, minute)}` };
  }
  return null;
}

function fmtTime(h, m) {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${suffix}`;
}

function isMeetingSentence(s) {
  return /(meeting|call|sync|catch[-\s]?up|stand[-\s]?up|1[:\-]on[:\-]1|board (meeting|deck|session)|walkthrough|lunch|dinner|appointment|session|interview|offsite|check[-\s]?in|demo|briefing|kick[-\s]?off|gala)/i.test(
    s
  );
}

/** Financial / administrative sentences are handled as deadlines, never meetings. */
function isAdminSentence(s) {
  return /(invoice|payment|receipt|billing|outstanding|renewal date|auto[-\s]?pay|w[-\s]?9|balance due)/i.test(s);
}

export function extractEntities(thread) {
  const actionItems = [];
  const deadlines = [];
  const appointments = [];

  // Completed threads are historical — nothing to schedule or chase.
  if (thread.completed || thread.archived) {
    return { actionItems: [], deadlines: [], appointments: [], processedAt: new Date().toISOString() };
  }

  thread.messages.forEach((msg) => {
    if (msg.direction === 'outbound') return;
    sentenceSplit(msg.body).forEach((sentence) => {
      const short = sentence.length > 150 ? `${sentence.slice(0, 147)}…` : sentence;
      const when = resolveWhen(sentence);

      if (isMeetingSentence(sentence) && when && !isAdminSentence(sentence)) {
        appointments.push({
          id: `${thread._id}-appt-${appointments.length}`,
          title: deriveTitle(sentence, thread),
          label: `${deriveTitle(sentence, thread)} – ${when.label}`,
          start: when.date.toISOString(),
          timeLabel: when.label,
          from: msg.from.name,
          messageId: msg.id,
        });
      }

      if (DEADLINE_RE.test(sentence) && when && !isMeetingSentence(sentence)) {
        deadlines.push({
          id: `${thread._id}-dl-${deadlines.length}`,
          label: when.label === 'Today (EOD)' || when.label.startsWith('Today') ? 'Today, end of day' : when.label,
          dueDate: when.date.toISOString(),
          from: msg.from.name,
        });
      }

      if (ACTION_RE.test(sentence) && sentence.length > 18) {
        actionItems.push({ id: `${thread._id}-ai-${actionItems.length}`, label: short, from: msg.from.name });
      }
    });
  });

  const dedupe = (arr, key) => {
    const seen = new Set();
    return arr.filter((item) => {
      const k = item[key].toLowerCase().slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  return {
    actionItems: dedupe(actionItems, 'label').slice(0, 5),
    deadlines: dedupe(deadlines, 'label').slice(0, 3),
    appointments: dedupe(appointments, 'title').slice(0, 3),
    processedAt: new Date().toISOString(),
  };
}

function deriveTitle(sentence, thread) {
  const m = sentence.match(
    /\b((?:[A-Z][\w&'-]+\s){1,3}(?:Board|Strategy|Budget|Planning|Quarterly|Q[1-4]|Kick[-\s]?off|Onboarding|Vendor|Legal|Design|Product|Partnership|Hiring|Executive|Offsite|Travel|Review|Sync|Call|Meeting|Catch[-\s]?up|Lunch|Dinner|Demo|Interview|Session|Briefing|Renewal|Deal|Term Sheet|Walkthrough|Gala|Check[-\s]?in)[\w\s'-]{0,32})/
  );
  const raw = (m ? m[1] : thread.subject).replace(/^(re|fwd?):\s*/i, '').trim();
  const tidy = raw.replace(/\s+/g, ' ');
  return tidy.length > 52 ? `${tidy.slice(0, 49)}…` : tidy;
}
