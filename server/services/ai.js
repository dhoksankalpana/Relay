/**
 * AI layer.
 *
 * Every AI capability (reply-responsibility classification, explainable reasoning,
 * thread summarisation, entity extraction, reply drafting and the copilot) is
 * implemented twice:
 *   1. `llm*`  — used when an LLM API key is configured (OpenAI or Gemini).
 *   2. `mock*` — a deterministic, context-aware rule engine that reads the actual
 *                conversation (senders, direction, keywords, entities, tone) so
 *                results are stable and realistic during evaluation.
 *
 * The public functions always return a complete, well-formed object; if the live
 * model fails, times out, or returns unusable JSON we fall back to the mock and
 * record the reason in `ai.lastError`.
 */
import { extractEntities } from './extract.js';

export const CLASSIFICATIONS = {
  assistant_reply: {
    key: 'assistant_reply',
    label: 'Assistant to Reply',
    short: 'Assistant',
    blurb: 'Routine, logistics or vendor follow-through — Sarah handles it.',
  },
  client_reply: {
    key: 'client_reply',
    label: 'Client to Reply',
    short: 'Client',
    blurb: 'Sensitive, personal or decision-heavy — needs Alex\u2019s voice.',
  },
  no_reply: {
    key: 'no_reply',
    label: 'No Reply Needed',
    short: 'No reply',
    blurb: 'FYI / automated traffic — file it and move on.',
  },
};

/* ------------------------------------------------------------------ *
 * Signal dictionary — powers the deterministic engine and reasoning.
 * ------------------------------------------------------------------ */
const SIGNALS = {
  client_reply: [
    { re: /\bterm sheet\b/i, w: 6, note: 'references a term sheet that needs personal sign-off' },
    { re: /\b(equity|shareholding|valuation|earn[-\s]?out|merger|acquisition|m&a|cap table|dilution)\b/i, w: 5, note: 'covers commercially sensitive deal terms only the executive can approve' },
    { re: /\bcountersign|signature|sign[-\s]?off|sign the|your signature\b/i, w: 4, note: 'requires a signature or formal sign-off from the executive' },
    { re: /\bconfidential\b/i, w: 3, note: 'marked confidential, which should stay in the executive\u2019s inbox' },
    { re: /\b1[:\-\s]?on[:\-\s]?1\b|one[-\s]on[-\s]one|private call|personal call|off the record\b/i, w: 4, note: 'requests a private conversation with the executive directly' },
    { re: /\b(invit|gala|dinner invitation|wedding|anniversary|holiday party)\b/i, w: 4, note: 'personal invitation addressed to the executive' },
    { re: /\b(your (personal|decision|call|view|commitment|consent|blessing)|you personally)\b/i, w: 4, note: 'explicitly asks for the executive\u2019s personal decision' },
    { re: /\b(offer letter|candidate|counter[-\s]?offer|compensation package)\b/i, w: 3, note: 'involves hiring or compensation details the executive owns' },
    { re: /\bnegotiat|walk away|red line|final position\b/i, w: 3, note: 'requires a negotiation position the executive must set' },
    { re: /\bbudget (sign[-\s]?off|approval)|approve the budget\b/i, w: 4, note: 'needs formal budget approval' },
    { re: /\b(strategic|board seat|restructur|shareholder)\b/i, w: 2, note: 'strategic scope that exceeds assistant authority' },
  ],
  assistant_reply: [
    { re: /\b(schedul|reschedul|calendar invite|availability|time slot|find a time|move the (call|meeting))\b/i, w: 5, note: 'is scheduling or rescheduling logistics' },
    { re: /\b(invoice|billing|payment terms|purchase order|po number|renewal|contract copy|w[-\s]?9)\b/i, w: 4, note: 'is routine billing or contract administration' },
    { re: /\b(logistics|travel|flight change|hotel|itinerary|visa|ground transport|airport pickup)\b/i, w: 4, note: 'is travel and logistics coordination' },
    { re: /\b(follow(ing)? up|circling back|gentle reminder|chasing|as discussed)\b/i, w: 3, note: 'is a follow-up on an already agreed action' },
    { re: /\b(vendor|supplier|service provider|onboarding|access request|login|password reset|setup)\b/i, w: 3, note: 'is a vendor or account administration request' },
    { re: /\b(send over|share the|forward the|attach|documents|deck|agenda|brief)\b/i, w: 2, note: 'asks for material the assistant can send' },
    { re: /\b(confirm|confirmation|double[-\s]?check|reconcile|verify)\b/i, w: 2, note: 'needs a straightforward confirmation' },
    { re: /\b(routine|standard turnaround|as usual)\b/i, w: 2, note: 'is explicitly routine' },
  ],
  no_reply: [
    { re: /\b(newsletter|unsubscribe|issue #?\d+)\b/i, w: 7, note: 'is a newsletter or subscription send' },
    { re: /\b(changelog|release notes|what'?s new|product update|version \d)\b/i, w: 7, note: 'is an automated product update' },
    { re: /\b(no action (needed|required)|nothing needed from you|for your information|for your awareness|fyi)\b/i, w: 8, note: 'is explicitly flagged FYI with no action needed' },
    { re: /\b(do not reply|no[-\s]?reply|automated (message|notification)|this is an automated)\b/i, w: 8, note: 'comes from a no-reply automated sender' },
    { re: /\b(booking reference|e[-\s]?ticket|itinerary attached|confirmation (number|code))\b/i, w: 5, note: 'is a system-generated confirmation' },
    { re: /\b(resolved|closing this out|closing the loop|all set|no further action)\b/i, w: 6, note: 'is an already-resolved thread' },
    { re: /\b(receipt|payment received|auto[-\s]?pay|your order)\b/i, w: 6, note: 'is a payment or receipt notification' },
  ],
};

const RESPONSIBILITY_LABELS = {
  assistant_reply: 'Assistant to Reply',
  client_reply: 'Client to Reply',
  no_reply: 'No Reply Needed',
};

const AUTOMATED_SENDER = /(no-?reply|notifications?@|billing@|receipts?@|updates?@|news@|changelog@|hello@.*\.(news|io)$)/i;

/* ------------------------------------------------------------------ *
 * Live LLM plumbing
 * ------------------------------------------------------------------ */
export function llmConfig() {
  const key = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || '';
  const provider =
    process.env.LLM_PROVIDER ||
    (process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.LLM_API_KEY?.startsWith('sk-')
      ? 'gemini'
      : 'openai');
  const model = process.env.LLM_MODEL || (provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini');
  return { key: key.trim(), provider, model, live: Boolean(key.trim()) };
}

async function callLLM(system, user, { json = true, timeout = 15000 } = {}) {
  const { key, provider, model, live } = llmConfig();
  if (!live) throw new Error('no-llm-key');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    let text = '';
    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { temperature: 0.2, responseMimeType: json ? 'application/json' : 'text/plain' },
          }),
        }
      );
      if (!res.ok) throw new Error(`gemini ${res.status}`);
      const data = await res.json();
      text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    } else {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          ...(json ? { response_format: { type: 'json_object' } } : {}),
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`openai ${res.status}`);
      const data = await res.json();
      text = data?.choices?.[0]?.message?.content || '';
    }
    return json ? parseJson(text) : text;
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(text) {
  if (!text) throw new Error('empty-llm-response');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('non-json-llm-response');
  return JSON.parse(raw.slice(start, end + 1));
}

/* ------------------------------------------------------------------ *
 * Thread → prompt helpers
 * ------------------------------------------------------------------ */
export function threadToPrompt(thread) {
  const lines = thread.messages.map((m, i) => {
    const who = m.direction === 'outbound' ? 'US (Sarah, assistant)' : `${m.from.name} <${m.from.email}>`;
    return `[${i + 1}] ${m.receivedAt} — ${who}\n${m.body}`;
  });
  return [
    `SUBJECT: ${thread.subject}`,
    `MAILBOX: ${thread.provider} (${thread.accountEmail})`,
    `CLIENT: Alex Mercer, CEO Meridian Holdings. ASSISTANT: Sarah Chen.`,
    `FLAGS: ${thread.important ? 'flagged important; ' : ''}${thread.completed ? 'already completed' : ''}`,
    `CONVERSATION:`,
    ...lines,
  ].join('\n');
}

/* ------------------------------------------------------------------ *
 * 1. Reply-responsibility classification (deterministic engine)
 * ------------------------------------------------------------------ */
function scoreBuckets(thread) {
  const haystack = [
    thread.subject,
    ...thread.messages.map((m) => m.body),
  ].join('\n');

  const scores = { assistant_reply: 0, client_reply: 0, no_reply: 0 };
  const hits = { assistant_reply: [], client_reply: [], no_reply: [] };

  for (const [bucket, signals] of Object.entries(SIGNALS)) {
    for (const s of signals) {
      if (s.re.test(haystack)) {
        scores[bucket] += s.w;
        hits[bucket].push(s.note);
      }
    }
  }

  const last = thread.messages[thread.messages.length - 1];
  const lastFromAutomated = last && AUTOMATED_SENDER.test(last.from?.email || '');
  if (lastFromAutomated && last.direction === 'inbound') {
    scores.no_reply += 6;
    hits.no_reply.push('the latest message was dispatched by an automated system sender');
  }
  if (last?.direction === 'outbound') {
    // We already answered: responsibility stays with us until they come back.
    scores.assistant_reply += 2;
  }
  if (thread.completed) {
    scores.no_reply += 5;
    hits.no_reply.push('the thread is already marked completed on our side');
  }
  if (thread.important && scores.client_reply > 0) scores.client_reply += 2;

  return { scores, hits };
}

export function mockClassify(thread) {
  const { scores, hits } = scoreBuckets(thread);
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  let [topKey, topScore] = ranked[0];
  const [, secondScore] = ranked[1];

  const noSignal = topScore === 0;
  if (noSignal) topKey = 'assistant_reply';

  const margin = topScore - secondScore;
  let confidence = 54 + topScore * 5 + margin * 3;
  if (noSignal) confidence = 51;
  if (thread.completed) confidence = Math.max(confidence, 88);
  if (thread.important && topKey === 'client_reply') confidence += 3;
  confidence = Math.max(41, Math.min(96, Math.round(confidence)));
  if (margin <= 2 && !noSignal) confidence = Math.min(confidence, 71);

  const needsReview = confidence < 75;
  const notes = hits[topKey].slice(0, 2);
  const label = RESPONSIBILITY_LABELS[topKey];

  let reasoning = noSignal
    ? `No strong responsibility signal was found in ${thread.messages.length} message(s), so the thread defaults to ${label} pending a human check.`
    : `Classified as ${label} because the thread ${notes.join(', and ')}.`;

  if (needsReview) {
    const runnerUp = RESPONSIBILITY_LABELS[ranked.find(([k]) => k !== topKey)?.[0]] || 'another segment';
    reasoning += ` Confidence is ${confidence}% — ${runnerUp} also scored closely, so it is flagged for assistant review.`;
  } else {
    reasoning += ` Confidence ${confidence}%.`;
  }

  return { classification: topKey, aiConfidence: confidence, needsReview, aiReasoning: reasoning };
}

/* ------------------------------------------------------------------ *
 * 2. Summarisation
 * ------------------------------------------------------------------ */
const firstSentence = (text = '', max = 170) => {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  const s = clean.split(/(?<=[.!?])\s/)[0] || clean;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

/** Drops greetings and sign-off blocks so drafts quote the actual substance. */
const bodyCore = (text = '') =>
  String(text)
    .split(/\n/)
    .filter(
      (line) =>
        !/^\s*(hi|hello|hey|dear|good (morning|afternoon|evening))\b[^.!?]{0,40},?\s*$/i.test(line) &&
        !/^\s*(best|kind|warm) (regards|wishes|thx)?,?\s*$/i.test(line) &&
        !/^\s*(thanks|thank you|regards|cheers|sincerely)[,.!]?\s*$/i.test(line)
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

export function mockSummarize(thread) {
  const inbound = thread.messages.filter((m) => m.direction === 'inbound');
  const outbound = thread.messages.filter((m) => m.direction === 'outbound');
  const lastInbound = inbound[inbound.length - 1];
  const bullets = [];

  bullets.push(
    `${inbound.length} inbound and ${outbound.length} outbound message${thread.messages.length === 1 ? '' : 's'} with ${
      lastInbound ? lastInbound.from.name : 'the counterparty'
    }${inbound.length > 1 ? ` and ${new Set(inbound.map((m) => m.from.name)).size - 1 || 0} other(s)` : ''}.`
  );

  if (lastInbound) bullets.push(`Latest ask: “${firstSentence(lastInbound.body)}”`);

  if (outbound.length) {
    const last = outbound[outbound.length - 1];
    bullets.push(`We replied on ${shortDate(last.receivedAt)}; now waiting on ${lastInbound ? lastInbound.from.name : 'the sender'}.`);
  } else {
    bullets.push('No reply has been sent from our side yet.');
  }

  const extracted = thread.extracted || extractEntities(thread);
  if (extracted.deadlines?.length) bullets.push(`Deadline on the table: ${extracted.deadlines[0].label}.`);
  else if (extracted.appointments?.length) bullets.push(`Meeting referenced: ${extracted.appointments[0].title}.`);

  if (thread.completed) bullets.push('Marked completed — kept for the record only.');

  const summary = `${thread.subject.replace(/^(re|fwd?):\s*/i, '')} — ${
    lastInbound ? firstSentence(lastInbound.body, 200) : 'no inbound message yet'
  }`;

  return { aiSummary: summary, aiSummaryBullets: bullets.slice(0, 4) };
}

/* ------------------------------------------------------------------ *
 * 3. Reply drafting
 * ------------------------------------------------------------------ */
const TONES = {
  Professional: {
    open: 'Thank you for reaching out.',
    bridge: 'I have reviewed this with Alex and can confirm the following:',
    close: 'Please let me know if you need anything further from our side.',
    join: '\n\n',
  },
  Concise: {
    open: 'Thanks for the note.',
    bridge: 'Quick update:',
    close: 'Happy to help further.',
    join: '\n',
  },
  Warm: {
    open: 'Thanks so much for reaching out — I hope your week is going well.',
    bridge: 'I\u2019ve picked this up for Alex and here\u2019s where things stand:',
    close: 'Really appreciate your patience, and please don\u2019t hesitate to reach out.',
    join: '\n\n',
  },
  Firm: {
    open: 'Thank you for following up.',
    bridge: 'To keep this moving, I need to be direct about next steps:',
    close: 'We need your confirmation by the stated deadline so we can proceed.',
    join: '\n\n',
  },
};

export function mockDraft(thread, tone = 'Professional') {
  const t = TONES[tone] || TONES.Professional;
  const lastInbound = [...thread.messages].reverse().find((m) => m.direction === 'inbound');
  const extracted = thread.extracted || extractEntities(thread);
  const recipient = lastInbound?.from?.name?.split(' ')[0] || 'there';
  const lines = [];

  lines.push(`Hi ${recipient},`);
  lines.push('');
  lines.push(t.open);
  lines.push('');
  lines.push(
    `Following up on “${thread.subject.replace(/^(re|fwd?):\s*/i, '')}” — ${firstSentence(
      bodyCore(lastInbound?.body || ''),
      150
    )}`
  );
  lines.push('');
  lines.push(t.bridge);

  const actions = extracted.actionItems?.length
    ? extracted.actionItems.map((a) => (typeof a === 'string' ? a : a.label))
    : ['Review the detail below and confirm the next step.'];
  actions.slice(0, 3).forEach((a) => lines.push(`• ${a}`));

  if (extracted.appointments?.length) {
    const a = extracted.appointments[0];
    lines.push('');
    lines.push(`I have held ${a.label} in Alex\u2019s calendar — Calendar invite to follow once you confirm.`);
  } else if (extracted.deadlines?.length) {
    lines.push('');
    lines.push(`We are working to the ${extracted.deadlines[0].label} deadline, so a line back before then would help.`);
  }

  if (tone === 'Firm') {
    lines.push('');
    lines.push('If I don\u2019t hear back by end of day tomorrow I\u2019ll escalate this to Alex directly.');
  }

  lines.push('');
  lines.push(t.close);
  lines.push('');
  lines.push('Best regards,');
  lines.push('Sarah Chen');
  lines.push('Executive Assistant to Alex Mercer\nMeridian Holdings');

  return {
    tone,
    subject: /^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`,
    body: lines.join('\n'),
  };
}

/* ------------------------------------------------------------------ *
 * 4. Copilot
 * ------------------------------------------------------------------ */
const STOPWORDS = new Set([
  'the', 'this', 'that', 'what', 'whats', 'with', 'from', 'have', 'has', 'are', 'was', 'were', 'and', 'for', 'about',
  'tell', 'show', 'give', 'list', 'mail', 'mails', 'email', 'emails', 'inbox', 'please', 'need', 'needs', 'needed',
  'should', 'would', 'could', 'does', 'did', 'can', 'will', 'you', 'your', 'yours', 'our', 'ours', 'them', 'they',
  'there', 'then', 'than', 'when', 'where', 'which', 'who', 'whom', 'how', 'any', 'all', 'some', 'more', 'most',
  'into', 'over', 'under', 'again', 'still', 'just', 'only', 'also', 'very', 'much', 'many', 'been', 'being',
]);

export function mockCopilot({ message, threads, currentThread }) {
  const q = (message || '').toLowerCase();
  const active = threads.filter((t) => !t.completed);
  const pick = (list, limit = 4) => list.slice(0, limit);

  const attention = active.filter(
    (t) => t.ai.needsReview || (t.ai.classification === 'assistant_reply' && (t.unread || t.labels.includes('Action Required')))
  );
  const waiting = active.filter((t) => t.status === 'waiting');
  const clientOwned = active.filter((t) => t.ai.classification === 'client_reply');
  const meetings = active.filter((t) => (t.extracted?.appointments || []).length);

  const asBullets = (list) =>
    pick(list).map(
      (t) => `${t.subject} — ${t.participants.find((p) => p.role === 'counterparty')?.name || 'Unknown'} · ${
        CLASSIFICATIONS[t.ai.classification].label
      }${t.ai.needsReview ? ' · needs review' : ''}`
    );

  const respond = (answer, list, extra = {}) => ({
    answer,
    bullets: asBullets(list),
    threadIds: pick(list).map((t) => t._id),
    ...extra,
  });

  // 1. Current-thread intents
  if (currentThread) {
    if (/\bwhy\b.*\b(client|assistant|no reply|assigned|classified|segment)\b|\bwhy this\b/.test(q) || /why has this email/.test(q)) {
      return {
        answer: `${currentThread.subject} is currently assigned to ${CLASSIFICATIONS[currentThread.ai.classification].label} at ${
          currentThread.ai.aiConfidence
        }% confidence. ${currentThread.ai.aiReasoning}`,
        bullets: [
          `Responsibility: ${CLASSIFICATIONS[currentThread.ai.classification].label}`,
          `Confidence: ${currentThread.ai.aiConfidence}%${currentThread.ai.needsReview ? ' · flagged for review' : ''}`,
          currentThread.ai.overridden ? 'A human overrode the AI suggestion on this thread.' : 'No manual override applied.',
        ],
        threadIds: [currentThread._id],
      };
    }
    if (/\bsummar/.test(q)) {
      return {
        answer: `Here is the short version of “${currentThread.subject}”.`,
        bullets: currentThread.ai.aiSummaryBullets,
        threadIds: [currentThread._id],
      };
    }
    if (/\bdraft|reply|respond|write back\b/.test(q)) {
      return {
        answer: 'I drafted a reply using the thread context and your default tone. Review it in the composer below the thread — nothing is sent until you approve it.',
        bullets: [
          `Recipient: ${currentThread.participants.find((p) => p.role === 'counterparty')?.name}`,
          `Tone: Professional · ${currentThread.ai.aiSummaryBullets.length} context points used`,
          'Human approval required before send.',
        ],
        threadIds: [currentThread._id],
        action: { type: 'draft', tone: 'Professional' },
      };
    }
  }

  // 2. Inbox-wide intents
  if (/\bwaiting|await|chasing|pending response\b/.test(q)) {
    return respond(`You are waiting on ${waiting.length} thread${waiting.length === 1 ? '' : 's'} — I have replied and the ball is in their court.`, waiting);
  }
  if (/\bclient\b.*\b(attention|reply|needs?|requires?|queue)\b|\bwhich emails require (the )?client\b/.test(q)) {
    return respond(
      `${clientOwned.length} threads need Alex\u2019s own voice — these are sensitive, personal or decision-level items.`,
      clientOwned,
      {
        bullets: pick(clientOwned).map(
          (t) => `${t.subject} · ${t.participants.find((p) => p.role === 'counterparty')?.name} — ${t.clientWhyNeeded || 'needs the executive\u2019s judgement'}`
        ),
      }
    );
  }
  if (/\bmeeting|calendar|appointment|schedule|upcoming\b/.test(q)) {
    const appts = meetings
      .flatMap((t) => (t.extracted.appointments || []).map((a) => ({ t, a })))
      .sort((x, y) => new Date(x.a.start) - new Date(y.a.start));
    return {
      answer: `I extracted ${appts.length} appointments from your inbox. Nearest first:`,
      bullets: appts.slice(0, 5).map(({ t, a }) => `${a.label} — extracted from “${t.subject}”`),
      threadIds: pick(appts.map((x) => x.t)).map((t) => t._id),
    };
  }
  if (/\breview|low confidence|ambiguous|uncertain|override\b/.test(q)) {
    return respond(`${attention.length} thread${attention.length === 1 ? '' : 's'} need a human decision from you.`, attention);
  }
  if (/\b(action required|action items?|todo|to-?do)\b/.test(q)) {
    const list = active.filter((t) => t.labels.includes('Action Required'));
    const items = list.flatMap((t) => (t.extracted.actionItems || []).map((i) => `${i} · from “${t.subject}”`));
    return {
      answer: `${items.length} concrete action items are open across ${list.length} thread${list.length === 1 ? '' : 's'}.`,
      bullets: items.slice(0, 5),
      threadIds: pick(list).map((t) => t._id),
    };
  }
  if (/\bimportant|priority|urgent\b/.test(q)) {
    const list = active.filter((t) => t.important || t.priority === 'high');
    return respond(`${list.length} threads are flagged important or high priority.`, list);
  }
  if (/\bno reply|fyi|newsletter|archive\b/.test(q)) {
    const list = active.filter((t) => t.ai.classification === 'no_reply');
    return respond(`${list.length} threads need no reply — safe to archive after a skim.`, list);
  }
  if (/\battention|need(s)? me|my attention|handle|inbox\b/.test(q) || /\bshow me emails\b/.test(q)) {
    return respond(
      `${attention.length} threads want your attention right now: low-confidence classifications and action-required items.`,
      attention
    );
  }
  if (/\bsummar|overview|status|brief\b/.test(q)) {
    return {
      answer: `Inbox overview: ${threads.length} threads — ${clientOwned.length} need Alex, ${
        active.filter((t) => t.ai.classification === 'assistant_reply').length
      } are yours, ${active.filter((t) => t.ai.classification === 'no_reply').length} need no reply, ${waiting.length} awaiting a response, ${
        attention.length
      } flagged for review.`,
      bullets: [],
      threadIds: [],
    };
  }

  // 3. Fallback: keyword/name search across the mailbox
  const tokens = Array.from(
    new Set(
      q
        .replace(/[^a-z0-9@.\s']/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    )
  );
  if (tokens.length) {
    const scored = threads
      .map((t) => {
        const hay = `${t.subject} ${t.participants
          .map((p) => `${p.name} ${p.email}`)
          .join(' ')} ${t.messages.map((m) => m.body).join(' ')} ${t.ai.aiSummary}`.toLowerCase();
        const score = tokens.reduce((sum, tok) => sum + (hay.includes(tok) ? (t.subject.toLowerCase().includes(tok) ? 3 : 1) : 0), 0);
        return { t, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.t);
    if (scored.length) {
      return {
        answer: `Found ${scored.length} thread${scored.length === 1 ? '' : 's'} matching ${tokens.slice(0, 3).join(', ')}.`,
        bullets: asBullets(scored),
        threadIds: pick(scored).map((t) => t._id),
      };
    }
  }

  return {
    answer:
      'I can triage the whole inbox or dig into this thread. Try one of the quick prompts — for example “Show me emails that need my attention” or “What am I waiting for a response on?”.',
    bullets: [
      'Ask about responsibility, deadlines, meetings or who owes a reply.',
      'Ask me to summarise or draft for the thread you have open.',
    ],
    threadIds: [],
  };
}

export function shortDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const days = Math.round((d.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return 'today';
  if (days === -1) return 'yesterday';
  if (days === 1) return 'tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ------------------------------------------------------------------ *
 * Public facade — live LLM first, deterministic engine as the safety net.
 * ------------------------------------------------------------------ */
const SYSTEM = `You are Relay, an AI triage engine for an executive assistant named Sarah Chen who manages the inbox of Alex Mercer, CEO of Meridian Holdings.
You decide whether the ASSISTANT (Sarah), the CLIENT (Alex, the executive) or NOBODY should reply.
Rules of thumb: scheduling, logistics, vendor billing, routine follow-ups and document requests belong to the assistant.
Sensitive negotiations, deal terms, signatures, budgets, hiring/comp details, confidential or personal invitations belong to the client.
Newsletters, receipts, automated notifications, FYI updates and resolved threads need no reply.
Always answer with strict JSON matching the requested keys.`;

async function tryLLM(userPrompt, validator, mockFn) {
  try {
    const parsed = await callLLM(SYSTEM, userPrompt);
    const ok = validator(parsed);
    if (!ok) throw new Error('invalid-llm-shape');
    return { value: ok, simulated: false, error: null };
  } catch (err) {
    return { value: mockFn(), simulated: true, error: err.message };
  }
}

export async function classifyThread(thread) {
  const prompt = `${threadToPrompt(thread)}

Return JSON:
{"classification":"assistant_reply|client_reply|no_reply","aiConfidence":<0-100 integer>,"needsReview":<boolean>,"aiReasoning":"<one or two sentences explaining why, naming the evidence from the thread>"}`;

  const res = await tryLLM(
    prompt,
    (p) => {
      if (!CLASSIFICATIONS[p.classification]) return null;
      const conf = Math.max(0, Math.min(100, Math.round(Number(p.aiConfidence) || 0)));
      return {
        classification: p.classification,
        aiConfidence: conf,
        needsReview: typeof p.needsReview === 'boolean' ? p.needsReview : conf < 75,
        aiReasoning: String(p.aiReasoning || '').trim() || mockClassify(thread).aiReasoning,
      };
    },
    () => mockClassify(thread)
  );
  return res;
}

export async function summarizeThread(thread) {
  const prompt = `${threadToPrompt(thread)}

Return JSON:
{"aiSummary":"<2 sentence executive summary>","aiSummaryBullets":["<3 to 4 short bullets: who, what is being asked, where it stands, deadline or meeting if any>"]}`;

  const res = await tryLLM(
    prompt,
    (p) => {
      if (!p.aiSummary || !Array.isArray(p.aiSummaryBullets)) return null;
      return {
        aiSummary: String(p.aiSummary).slice(0, 400),
        aiSummaryBullets: p.aiSummaryBullets.slice(0, 4).map((b) => String(b).slice(0, 260)),
      };
    },
    () => mockSummarize(thread)
  );
  return res;
}

export async function draftReply(thread, tone = 'Professional') {
  const prompt = `${threadToPrompt(thread)}

Write a reply as Sarah Chen, Executive Assistant to Alex Mercer, in a ${tone} tone.
Return JSON: {"subject":"Re: ...","body":"<full plain-text email body with greeting, bullets where useful, and signature>"}`;

  const res = await tryLLM(
    prompt,
    (p) => {
      if (!p.body) return null;
      return { tone, subject: p.subject || `Re: ${thread.subject}`, body: String(p.body) };
    },
    () => mockDraft(thread, tone)
  );
  return res;
}

export async function copilotAnswer(input) {
  const { message, threads, currentThread } = input;
  const context = currentThread ? `\nCURRENT OPEN THREAD:\n${threadToPrompt(currentThread)}` : '';
  const compact = threads
    .slice(0, 40)
    .map(
      (t) =>
        `- id=${t._id} | ${t.subject} | with ${t.participants
          .filter((p) => p.role === 'counterparty')
          .map((p) => p.name)
          .join(', ')} | responsibility=${t.ai.classification} (${t.ai.aiConfidence}%) | status=${t.status} | unread=${t.unread} | important=${t.important}${t.ai.needsReview ? ' | needsReview' : ''}`
    )
    .join('\n');

  const prompt = `MAILBOX SNAPSHOT (${threads.length} threads):
${compact}${context}

ASSISTANT QUESTION: ${message}

Return JSON: {"answer":"<2-4 sentence natural reply>","bullets":["<0-5 short supporting lines>"],"threadIds":["<ids of referenced threads>"],"action":{"type":"draft"|"none","tone":"Professional"}}`;

  const res = await tryLLM(
    prompt,
    (p) => {
      if (!p.answer) return null;
      const valid = new Set(threads.map((t) => t._id));
      return {
        answer: String(p.answer),
        bullets: Array.isArray(p.bullets) ? p.bullets.slice(0, 5).map((b) => String(b).slice(0, 240)) : [],
        threadIds: Array.isArray(p.threadIds) ? p.threadIds.filter((id) => valid.has(id)) : [],
        action: p.action && p.action.type === 'draft' ? { type: 'draft', tone: p.action.tone || 'Professional' } : { type: 'none' },
      };
    },
    () => mockCopilot(input)
  );
  return res;
}

/** Re-runs classification + summary + extraction over a thread. */
export async function enrichThread(thread, { reason = 'sync' } = {}) {
  const extracted = extractEntities(thread);
  const [cls, sum] = await Promise.all([classifyThread(thread), summarizeThread(thread)]);
  const previous = thread.ai?.classification;
  thread.ai = {
    ...thread.ai,
    classification: cls.value.classification,
    aiConfidence: cls.value.aiConfidence,
    needsReview: cls.value.needsReview,
    aiReasoning: cls.value.aiReasoning,
    aiSummary: sum.value.aiSummary,
    aiSummaryBullets: sum.value.aiSummaryBullets,
    simulated: cls.simulated && sum.simulated,
    lastError: cls.simulated ? cls.error : null,
    lastReason: reason,
    lastEvaluatedAt: new Date().toISOString(),
    changedFrom: previous && previous !== cls.value.classification ? previous : thread.ai?.changedFrom || null,
  };
  thread.extracted = extracted;
  return thread;
}
