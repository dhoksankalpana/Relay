/**
 * Pre-seeded executive mailbox.
 *
 * 16 threads in the primary (Gmail) mailbox + 4 held in a second mailbox that is
 * "fetched" when the evaluator connects Outlook. Every thread carries a realistic
 * multi-turn conversation, pre-computed AI triage output and AI-extracted
 * entities, so the dashboard is meaningful the moment it boots.
 */
import { extractEntities } from './extract.js';

const ME = { name: 'Sarah Chen', email: 'sarah.chen@meridianholdings.com', role: 'me' };
const CLIENT = { name: 'Alex Mercer', email: 'alex.mercer@meridianholdings.com', role: 'client' };
const GMAIL_EMAIL = 'sarah.chen@meridianholdings.com';
const OUTLOOK_EMAIL = 'alex.mercer@meridianholdings.com';

/** ISO timestamp `dayOffset` days from now at hh:mm. */
export function at(dayOffset, hh, mm = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

/** Local weekday name of `dayOffset` days from now (Thu → "Thursday"). */
export function weekdayOf(dayOffset) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

export function monthDayOf(dayOffset) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const counterparty = (name, email, title) => ({ name, email, role: 'counterparty', title });
const teammate = (name, email, title) => ({ name, email, role: 'teammate', title });

const msg = (id, from, direction, body, receivedAt, extra = {}) => ({
  id,
  from,
  to: direction === 'outbound' ? [extra.recipient || counterparty('Recipient', 'recipient@example.com')] : [ME],
  direction,
  body: body.trim(),
  snippet: body.replace(/\s+/g, ' ').trim().slice(0, 140),
  receivedAt,
  ...(extra.cc ? { cc: extra.cc } : {}),
});

const AI = (classification, aiConfidence, aiReasoning, aiSummary, aiSummaryBullets, extra = {}) => ({
  classification,
  aiConfidence,
  needsReview: aiConfidence < 75,
  aiReasoning,
  aiSummary,
  aiSummaryBullets,
  overridden: false,
  simulated: false,
  lastReason: 'initial-sync',
  lastEvaluatedAt: new Date().toISOString(),
  ...extra,
});

const APPT = (id, title, dayOffset, hh, mm) => ({ id, title, dayOffset, hh, mm });
const DEADLINE = (id, label, dayOffset) => ({ id, label, hint: `${weekdayOf(dayOffset)}`, dayOffset });

const base = (t) => ({
  unread: false,
  important: false,
  starred: false,
  archived: false,
  completed: false,
  priority: 'normal',
  labels: ['General'],
  status: 'general',
  category: 'General',
  draft: null,
  history: [],
  ...t,
});

/* ------------------------------------------------------------------ *
 * Primary mailbox (Gmail) — 16 threads
 * ------------------------------------------------------------------ */
function gmailThreads() {
  return [
    /* 1 — Board sign-off → CLIENT */
    base({
      _id: 't1',
      accountId: 'acc-gmail',
      accountEmail: GMAIL_EMAIL,
      provider: 'gmail',
      subject: 'Term sheet — need your personal sign-off before Friday',
      participants: [counterparty('Marcus Vance', 'marcus.vance@vancecapital.com', 'Board Member, Meridian Holdings'), ME],
      important: true,
      unread: true,
      priority: 'high',
      labels: ['Action Required', 'Important'],
      status: 'action_required',
      category: 'Action Required',
      clientWhyNeeded: 'Your signature on the Series C term sheet is required — the AI flags this as outside assistant authority.',
      messages: [
        msg(
          't1-m1',
          counterparty('Marcus Vance', 'marcus.vance@vancecapital.com'),
          'inbound',
          `Alex,

The Series C term sheet came back from Argent this morning. Section 3 (liquidation preference) is now at 1.5x and they have moved the board observer seat to a non-voting position, which I think we can live with.

I need your personal sign-off on this — I am not comfortable having anyone else accept the earn-out language on behalf of the board. Please review and countersign before ${weekdayOf(4)} so we can move to definitive documents.

Marcus`,
          at(-4, 7, 42)
        ),
        msg(
          't1-m2',
          ME,
          'outbound',
          `Hi Marcus,

Thanks for the note. I have flagged the term sheet for Alex and it is off the regular queue — Alex will review the earn-out section personally rather than delegate it, given it touches board-level terms.

I will confirm receipt on signature as soon as it is back.

Sarah`,
          at(-4, 9, 15),
          { recipient: counterparty('Marcus Vance', 'marcus.vance@vancecapital.com') }
        ),
        msg(
          't1-m3',
          counterparty('Marcus Vance', 'marcus.vance@vancecapital.com'),
          'inbound',
          `Sarah — understood, but I do need Alex's own signature on this, not a delegated acknowledgement. Our counsel needs it before ${weekdayOf(4)}.

Please have Alex confirm personally.`,
          at(-1, 18, 26)
        ),
      ],
      followUps: [
        {
          from: counterparty('Marcus Vance', 'marcus.vance@vancecapital.com'),
          body: `Alex — flagging once more: the board needs your signature on the term sheet. I have attached the clean PDF with the earn-out clause highlighted.

Marcus`,
          receivedAt: at(0, 8, 12),
        },
        {
          from: counterparty('Marcus Vance', 'marcus.vance@vancecapital.com'),
          body: `Sarah — counsel has confirmed everything except Section 3. Once Alex signs, we are done.`,
          receivedAt: at(1, 11, 5),
        },
      ],
      ai: AI(
        'client_reply',
        95,
        'Classified as Client to Reply because the sender requires a personal countersignature on the Series C term sheet, and the thread covers commercially sensitive deal terms (liquidation preference, earn-out) that sit outside assistant authority. A delegated acknowledgement was explicitly rejected. Confidence 95%.',
        'Marcus Vance needs Alex’s personal signature on the Series C term sheet before Friday; the board will not accept a delegated acknowledgement.',
        [
          '3 messages with Marcus Vance (Board Member) — two asks, one from us.',
          'Latest ask: “I do need Alex’s own signature on this, not a delegated acknowledgement.”',
          'We replied on the thread, but the counter-signature is still outstanding.',
          'Hard deadline: Friday sign-off before definitive documents are drafted.',
        ]
      ),
      seedExtras: {
        deadlines: [DEADLINE('t1-dl1', `${monthDayOf(4)} deadline for counter-signature`, 4)],
        actionItems: ['Alex to personally countersign the Series C term sheet before Friday (earn-out language)'],
      },
    }),

    /* 2 — Confidential recruiter 1:1 → CLIENT */
    base({
      _id: 't2',
      accountId: 'acc-gmail',
      accountEmail: GMAIL_EMAIL,
      provider: 'gmail',
      subject: 'Confidential — brief 1:1 this week?',
      participants: [counterparty('Elena Ross', 'elena.ross@halcyonsearch.com', 'Partner, Halcyon Executive Search'), ME],
      important: true,
      unread: true,
      priority: 'high',
      labels: ['Important'],
      status: 'action_required',
      category: 'Important',
      clientWhyNeeded: 'A confidential, off-the-record conversation with a recruiter — only you should decide whether to take it.',
      messages: [
        msg(
          't2-m1',
          counterparty('Elena Ross', 'elena.ross@halcyonsearch.com'),
          'inbound',
          `Hi Sarah,

I hope you are well. I am reaching out confidentially on a confidential search we are running. I would like 20 minutes with Alex personally — this is not something suited to a scheduled assistant call.

Would ${weekdayOf(3)} at 4:30 PM work for a private call? Nothing needs to be prepared; I would rather keep it informal and off the record.

Thanks,
Elena Ross
Halcyon Executive Search`,
          at(-2, 14, 3)
        ),
        msg(
          't2-m2',
          ME,
          'outbound',
          `Hi Elena,

Thanks for reaching out. I have passed this to Alex directly and flagged it as confidential. I will not place it on the shared team calendar.

Alex will come back to you personally.

Sarah`,
          at(-2, 15, 47),
          { recipient: counterparty('Elena Ross', 'elena.ross@halcyonsearch.com') }
        ),
      ],
      followUps: [
        {
          from: counterparty('Elena Ross', 'elena.ross@halcyonsearch.com'),
          body: `Sarah — just circling back. I would rather not put details in writing. Please have Alex confirm the private 1:1 personally; I can hold ${weekdayOf(3)} at 4:30 PM for another day.`,
          receivedAt: at(0, 10, 20),
        },
      ],
      ai: AI(
        'client_reply',
        88,
        'Classified as Client to Reply because the sender explicitly requests a confidential 1:1 with Alex rather than an assistant-scheduled call, and the content is off the record. Confidentiality plus the personal-invitation signal puts it beyond assistant scope. Confidence 88%.',
        'Elena Ross of Halcyon Executive Search wants a confidential 20-minute 1:1 with Alex, ideally Thursday at 4:30 PM, and will not put details in writing.',
        [
          '2 messages with Elena Ross (Halcyon Executive Search).',
          'Latest ask: “I would rather not put details in writing — please have Alex confirm personally.”',
          'We already acknowledged and kept it off the shared team calendar.',
          'Proposed slot held: Thursday at 4:30 PM (private call).',
        ]
      ),
      seedExtras: {
        appointments: [APPT('t2-ap1', 'Confidential 1:1 — Halcyon Executive Search', 3, 16, 30)],
        actionItems: ['Alex to personally confirm the confidential 1:1 with Elena Ross'],
      },
    }),

    /* 3 — Investor board deck scheduling → ASSISTANT */
    base({
      _id: 't3',
      accountId: 'acc-gmail',
      accountEmail: GMAIL_EMAIL,
      provider: 'gmail',
      subject: 'Q3 board deck — 30 minutes to walk through it?',
      participants: [counterparty('Priya Raman', 'priya@northwind.vc', 'Partner, Northwind Ventures'), ME],
      unread: true,
      labels: ['Meetings & Appointments', 'Action Required'],
      status: 'action_required',
      category: 'Meetings & Appointments',
      messages: [
        msg(
          't3-m1',
          counterparty('Priya Raman', 'priya@northwind.vc'),
          'inbound',
          `Hi Sarah,

Before the Q3 board meeting I would like 30 minutes with Alex to walk through the strategy deck and the updated ARR bridge. Could you find a slot ${weekdayOf(3)} at 2:00 PM? I can be flexible within the afternoon.

If that works, send the calendar invite with a dial-in please.

Priya`,
          at(-3, 9, 30)
        ),
        msg(
          't3-m2',
          ME,
          'outbound',
          `Hi Priya,

${weekdayOf(3)} at 2:00 PM works. I will send the invite with dial-in details shortly and attach the board strategy deck once final internal review is done.

Sarah`,
          at(-3, 11, 2),
          { recipient: counterparty('Priya Raman', 'priya@northwind.vc') }
        ),
        msg(
          't3-m3',
          counterparty('Priya Raman', 'priya@northwind.vc'),
          'inbound',
          `Perfect — one more thing. Please move it to 2:00 PM but on the same day, I have a conflicting portfolio call at 1:00 PM. And could you add the ARR bridge as a separate page?

Priya`,
          at(-1, 16, 40)
        ),
      ],
      followUps: [
        {
          from: counterparty('Priya Raman', 'priya@northwind.vc'),
          body: `Sarah — quick nudge: can you reschedule the deck walkthrough to ${weekdayOf(2)} at 2:00 PM instead? Same dial-in is fine. Also please share the board strategy deck in advance.`,
          receivedAt: at(0, 9, 10),
        },
      ],
      ai: AI(
        'assistant_reply',
        93,
        'Classified as Assistant to Reply because the thread is scheduling and rescheduling coordination (a 2:00 PM deck walkthrough) plus document sharing — exactly the logistics the assistant owns. No decision or sensitive content is requested from the executive. Confidence 93%.',
        'Priya Raman needs a 30-minute board deck walkthrough with Alex, currently held for Thursday at 2:00 PM, plus the ARR bridge page and dial-in invite.',
        [
          '3 messages with Priya Raman (Northwind Ventures) — two asks, one from us.',
          'Latest ask: “Move it to 2:00 PM on the same day and add the ARR bridge as a separate page.”',
          'We already replied; the invite and revised deck are still to be sent.',
          'Proposed meeting: Thursday at 2:00 PM.',
        ]
      ),
      seedExtras: {
        appointments: [APPT('t3-ap1', 'Board Strategy Sync — deck walkthrough', 3, 14, 0)],
        actionItems: ['Send the calendar invite with dial-in for the deck walkthrough', 'Attach the board strategy deck and the new ARR bridge page'],
      },
    }),

    /* 4 — Vendor invoice + renewal → ASSISTANT */
    base({
      _id: 't4',
      accountId: 'acc-gmail',
      accountEmail: GMAIL_EMAIL,
      provider: 'gmail',
      subject: 'Invoice #INV-20841 outstanding — and your renewal terms',
      participants: [counterparty('Vantage Cloud Billing', 'billing@vantagecloud.io', 'Accounts Receivable, Vantage Cloud'), ME],
      unread: true,
      priority: 'high',
      labels: ['Action Required'],
      status: 'action_required',
      category: 'Action Required',
      messages: [
        msg(
          't4-m1',
          counterparty('Vantage Cloud Billing', 'billing@vantagecloud.io'),
          'inbound',
          `Hello Sarah,

Invoice #INV-20841 for $18,450 is now 6 days outstanding. Please process payment before ${monthDayOf(6)} to avoid a service review on the compute cluster.

Separately, your annual contract renews on the same date. Could you confirm whether Meridian is renewing for 12 or 24 months, and whether you need an updated W-9?

Regards,
Vantage Cloud Billing`,
          at(-2, 6, 15)
        ),
        msg(
          't4-m2',
          ME,
          'outbound',
          `Hello,

Thanks for flagging. I have escalated invoice #INV-20841 to our finance team for payment and will confirm the renewal term length this week.

Please send the updated W-9 and a copy of the renewal contract for our records.

Sarah Chen
Executive Assistant, Meridian Holdings`,
          at(-1, 10, 5),
          { recipient: counterparty('Vantage Cloud Billing', 'billing@vantagecloud.io') }
        ),
      ],
      followUps: [
        {
          from: counterparty('Vantage Cloud Billing', 'billing@vantagecloud.io'),
          body: `Sarah — checking in on invoice #INV-20841. Finance has not confirmed payment yet. Also, we still need the renewal term (12 or 24 months). If we do not hear back before ${monthDayOf(6)} the account moves to manual review.`,
          receivedAt: at(0, 7, 25),
        },
      ],
      ai: AI(
        'assistant_reply',
        87,
        'Classified as Assistant to Reply because this is routine billing and contract administration — an outstanding invoice, a renewal term selection and a W-9 request. No executive decision content, and the assistant has already been corresponding. Confidence 87%.',
        'Vantage Cloud says invoice #INV-20841 ($18,450) is outstanding and needs the renewal term length plus a payment date before the service review.',
        [
          '2 messages with Vantage Cloud Billing — one ask, one from us.',
          'We replied and escalated the invoice to finance.',
          'Still open: confirm 12 vs 24-month renewal, obtain the updated W-9.',
          'Deadline: payment before the renewal date, six days out.',
        ]
      ),
      seedExtras: {
        deadlines: [DEADLINE('t4-dl1', `${monthDayOf(6)} payment + renewal confirmation`, 6)],
        actionItems: ['Chase finance on invoice #INV-20841 ($18,450)', 'Confirm 12 vs 24-month Vantage Cloud renewal', 'Request updated W-9 and renewal contract'],
      },
    }),

    /* 5 — Legal awaiting signature → ASSISTANT (waiting) */
    base({
      _id: 't5',
      accountId: 'acc-gmail',
      accountEmail: GMAIL_EMAIL,
      provider: 'gmail',
      subject: 'Re: Mutual NDA — countersignature outstanding',
      participants: [counterparty('David Whitfield', 'd.whitfield@whitfieldlowe.com', 'Partner, Whitfield & Lowe LLP'), ME],
      labels: ['Waiting for Response'],
      status: 'waiting',
      category: 'Waiting for Response',
      messages: [
        msg(
          't5-m1',
          counterparty('David Whitfield', 'd.whitfield@whitfieldlowe.com'),
          'inbound',
          `Sarah,

Attached is the mutual NDA with the counterparty's edits in Schedule 2. We are waiting on their countersignature.

David`,
          at(-6, 13, 20)
        ),
        msg(
          't5-m2',
          ME,
          'outbound',
          `Hi David,

Thanks — I have logged the revised Schedule 2 edits and circulated the document for internal review. Nothing further needed from your side right now; we are waiting on the countersigned copy to come back from you before it is filed.

I will follow up if we have not received it within three business days.

Sarah`,
          at(-5, 9, 45),
          { recipient: counterparty('David Whitfield', 'd.whitfield@whitfieldlowe.com') }
        ),
      ],
      followUps: [
        {
          from: counterparty('David Whitfield', 'd.whitfield@whitfieldlowe.com'),
          body: `Sarah — the countersigned NDA is back from the counterparty. Please confirm Meridian's filing reference so we can close the matter out.`,
          receivedAt: at(0, 12, 15),
        },
      ],
      ai: AI(
        'assistant_reply',
        79,
        'Classified as Assistant to Reply because this is document administration — filing and tracking a countersigned NDA. Sarah has already replied and the thread is parked waiting on the counterparty, so no executive action is required. Confidence 79%.',
        'Counsel sent the revised mutual NDA; we acknowledged it and are waiting on the countersigned copy to be returned and filed.',
        [
          '2 messages with David Whitfield (Whitfield & Lowe LLP).',
          'Our reply asked for nothing and confirmed we are awaiting the countersigned copy.',
          'Thread is parked in Waiting for Response — no executive voice needed.',
        ]
      ),
      seedExtras: {
        actionItems: ['Chase the countersigned NDA if it has not returned within three business days'],
      },
    }),

    /* 6 — Ambiguous partnership intro → NEEDS REVIEW */
    base({
      _id: 't6',
      accountId: 'acc-gmail',
      accountEmail: GMAIL_EMAIL,
      provider: 'gmail',
      subject: 'Intro: possible partnership on infra tooling',
      participants: [counterparty('Daniel Okoye', 'daniel@lumenlabs.co', 'Co-founder, Lumen Labs'), ME],
      labels: ['General'],
      status: 'general',
      category: 'General',
      messages: [
        msg(
          't6-m1',
          counterparty('Daniel Okoye', 'daniel@lumenlabs.co'),
          'inbound',
          `Hi Sarah,

We met briefly at the operator dinner last month. I run Lumen Labs and we have built tooling that overlaps with Meridian's internal platform work.

I would love to explore a partnership, though there is genuinely no rush and no agenda — happy to start with a quick call or just send some context over for whoever is appropriate. If it is easier, I can route this to your partnerships team instead.

Daniel`,
          at(-3, 17, 10)
        ),
        msg(
          't6-m2',
          ME,
          'outbound',
          `Hi Daniel,

Thanks for following up. Could you send over a short overview of Lumen Labs and what a partnership would look like on your side? I will make sure it reaches the right person internally.

Sarah`,
          at(-2, 8, 55),
          { recipient: counterparty('Daniel Okoye', 'daniel@lumenlabs.co') }
        ),
      ],
      followUps: [
        {
          from: counterparty('Daniel Okoye', 'daniel@lumenlabs.co'),
          body: `Hi Sarah — attaching our one-pager. I do think Alex would want to weigh in on the strategic angle, but happy to keep it with you if that is simpler. Let me know what works.`,
          receivedAt: at(0, 15, 35),
        },
      ],
      ai: AI(
        'assistant_reply',
        62,
        'Classified as Assistant to Reply because the sender offers to route through the assistant and asks only for context to be shared. Confidence is 62% — the message also invites Alex to weigh in on the strategic angle, so Client to Reply scores closely and the thread is flagged for assistant review.',
        'Daniel Okoye of Lumen Labs is exploring a partnership and offering to send context, but also hints Alex may want to weigh in on the strategic angle.',
        [
          '2 messages with Daniel Okoye (Lumen Labs).',
          'Latest ask: “Happy to keep it with you if that is simpler.”',
          'Confidence only 62% — responsibility is genuinely ambiguous, both signals fire.',
          'Needs a human decision on who owns the relationship.',
        ]
      ),
      seedExtras: {
        actionItems: ['Decide whether the Lumen Labs partnership intro belongs with Alex or the partnerships team'],
      },
    }),

    /* 7 — Product changelog → NO REPLY */
    base({
      _id: 't7',
      accountId: 'acc-gmail',
      accountEmail: GMAIL_EMAIL,
      provider: 'gmail',
      subject: "What's new in Cadence — November release notes",
      participants: [counterparty('Cadence Product Team', 'changelog@cadencehq.com', 'Product Team, Cadence')],
      unread: true,
      labels: ['General'],
      status: 'general',
      category: 'General',
      messages: [
        msg(
          't7-m1',
          counterparty('Cadence Product Team', 'changelog@cadencehq.com'),
          'inbound',
          `Here is everything new in Cadence this month.

• Shared views with per-member filters
• Calendar sync now honours per-attendee availability
• Faster search (2.4x) and a redesigned command bar

This is an automated product update from the Cadence team. You are receiving it because you are a workspace admin. Unsubscribe at any time.`,
          at(-1, 7, 0)
        ),
      ],
      followUps: [],
      ai: AI(
        'no_reply',
        91,
        'Classified as No Reply Needed because this is an automated product update from a no-reply sender containing release notes and an unsubscribe link. There is no ask or decision. Confidence 91%.',
        'Automated Cadence release notes covering shared views, calendar sync and faster search — informational only.',
        [
          'Single message from the automated Cadence Product Team sender.',
          'Contains release notes and an unsubscribe link — no ask.',
          'Safe to archive after a skim.',
        ]
      ),
    }),

    /* 8 — Flight confirmation → NO REPLY (+ appointment) */
    base({
      _id: 't8',
      accountId: 'acc-gmail',
      accountEmail: GMAIL_EMAIL,
      provider: 'gmail',
      subject: 'Booking confirmed — BA 118 LHR → JFK',
      participants: [counterparty('British Airways', 'no-reply@ba-notifications.com', 'British Airways')],
      labels: ['General', 'Meetings & Appointments'],
      status: 'general',
      category: 'General',
      messages: [
        msg(
          't8-m1',
          counterparty('British Airways', 'no-reply@ba-notifications.com'),
          'inbound',
          `Your booking is confirmed.

Booking reference: K7PQ2D
Flight BA 118 — London Heathrow (LHR) to New York (JFK)
Departs ${weekdayOf(9)} at 9:40 AM, arrives 12:35 PM local.
Traveller: Alex Mercer · Seat 2A

This is an automated message, please do not reply. Manage your booking online.`,
          at(-1, 5, 30)
        ),
      ],
      followUps: [],
      ai: AI(
        'no_reply',
        96,
        'Classified as No Reply Needed because the sender is an automated no-reply address and the content is a flight booking confirmation with a reference number. No action is requested. Confidence 96%.',
        'British Airways confirmed Alex’s LHR → JFK flight (BA 118) for next week, departing 9:40 AM.',
        [
          'Single automated booking confirmation from a no-reply sender.',
          'Contains a booking reference and seat assignment — no ask.',
          'Flight already noted on Alex’s calendar by the assistant.',
        ]
      ),
      seedExtras: {
        appointments: [APPT('t8-ap1', 'Flight BA 118 LHR → JFK (departure)', 9, 9, 40)],
      },
    }),

    /* 9 — Newsletter → NO REPLY */
    base({
      _id: 't9',
      accountId: 'acc-gmail',
      accountEmail: GMAIL_EMAIL,
      provider: 'gmail',
      subject: 'The Operator’s Brief — Issue #214',
      participants: [counterparty('The Operator’s Brief', 'news@operatorsbrief.co', 'The Operator’s Brief')],
      labels: ['General'],
      status: 'general',
      category: 'General',
      messages: [
        msg(
          't9-m1',
          counterparty('The Operator’s Brief', 'news@operatorsbrief.co'),
          'inbound',
          `Issue #214 · This week: why the best operators are deleting dashboards, a teardown of pricing pages that convert, and 11 questions to ask before you sign an enterprise contract.

You are receiving this newsletter because you subscribed. Unsubscribe.`,
          at(-2, 6, 0)
        ),
      ],
      followUps: [],
      ai: AI(
        'no_reply',
        94,
        'Classified as No Reply Needed because this is a subscription newsletter with an unsubscribe footer and no request of any kind. Confidence 94%.',
        'Weekly industry newsletter (Issue #214) covering operator practices and pricing teardowns — no action required.',
        [
          'Newsletter from a bulk sender with an unsubscribe link.',
          'Issues are numbered and clearly subscription-based.',
          'No ask — archive when convenient.',
        ]
      ),
    }),

    /* 10 — Hotel logistics for offsite → ASSISTANT (+ appointment) */
    base({
      _id: 't10',
      accountId: 'acc-gmail',
      accountEmail: GMAIL_EMAIL,
      provider: 'gmail',
      subject: 'The Langham — your reservation for the board offsite',
      participants: [counterparty('The Langham London', 'reservations@langham-london.com', 'Reservations, The Langham London'), ME],
      labels: ['Meetings & Appointments', 'Action Required'],
      status: 'action_required',
      category: 'Meetings & Appointments',
      messages: [
        msg(
          't10-m1',
          counterparty('The Langham London', 'reservations@langham-london.com'),
          'inbound',
          `Dear Ms Chen,

Thank you for booking 6 rooms for the Meridian board offsite. Check-in is ${weekdayOf(8)} at 3:00 PM.

To finalise, please confirm:
1. Arrival times for the two guests using the executive transfer
2. Dietary requirements for the private dining room
3. Whether you require the meeting room set up classroom-style

Once received we will issue the final rooming list.

Reservations, The Langham London`,
          at(-2, 10, 30)
        ),
      ],
      followUps: [
        {
          from: counterparty('The Langham London', 'reservations@langham-london.com'),
          body: `Dear Ms Chen — a gentle reminder: we still need arrival times, dietary requirements and the room set-up preference before ${weekdayOf(8)} check-in so the rooming list can be issued.`,
          receivedAt: at(0, 13, 40),
        },
      ],
      ai: AI(
        'assistant_reply',
        84,
        'Classified as Assistant to Reply because this is travel and logistics coordination — arrival times, dietary requirements and room set-up for the board offsite. Routine administration the assistant owns. Confidence 84%.',
        'The Langham needs arrival times, dietary requirements and the meeting room set-up confirmed for the board offsite before check-in.',
        [
          '1 message with The Langham reservations (the thread is waiting on us).',
          'Three concrete confirmations requested before the checklist closes.',
          'Logistics only — nothing requiring Alex’s judgement.',
          'Check-in: next week at 3:00 PM.',
        ]
      ),
      seedExtras: {
        appointments: [APPT('t10-ap1', 'Board Offsite — hotel check-in (The Langham)', 8, 15, 0)],
        actionItems: ['Confirm guest arrival times for the executive transfer', 'Collect dietary requirements for the private dining room', 'Choose classroom-style set-up for the meeting room'],
      },
    }),

    /* 11 — Personal invitation → CLIENT */
    base({
      _id: 't11',
      accountId: 'acc-gmail',
      accountEmail: GMAIL_EMAIL,
      provider: 'gmail',
      subject: 'Invitation — Winter Gala, Saturday 6 December',
      participants: [counterparty('Grace Whitmore', 'grace@whitmorefoundation.org', 'Chair, Whitmore Foundation'), ME],
      important: true,
      unread: true,
      labels: ['Important'],
      status: 'action_required',
      category: 'Important',
      clientWhyNeeded: 'A personal invitation to Alex and his family — only you can accept or decline.',
      messages: [
        msg(
          't11-m1',
          counterparty('Grace Whitmore', 'grace@whitmorefoundation.org'),
          'inbound',
          `Dear Alex,

Each year we host a small dinner before the Winter Gala and this year I would very much like you and your family to join us — you have been enormously generous to the foundation and I would like to thank you in person.

The gala is on ${weekdayOf(20)}, ${monthDayOf(20)}, black tie, with a private table for twelve. Please let me know personally whether you can make it; it would mean a great deal.

Warmly,
Grace`,
          at(-1, 19, 5)
        ),
      ],
      followUps: [
        {
          from: counterparty('Grace Whitmore', 'grace@whitmorefoundation.org'),
          body: `Alex — I do hope you can join. I would love to hear from you personally rather than through the office; it is a small, personal evening.`,
          receivedAt: at(0, 18, 45),
        },
      ],
      ai: AI(
        'client_reply',
        90,
        'Classified as Client to Reply because this is a personal invitation addressed to Alex and his family, and the sender asks to hear back personally. Personal-invitation and personal-decision signals both fire. Confidence 90%.',
        'Grace Whitmore personally invites Alex and his family to a private pre-gala dinner on 6 December and asks for a personal reply.',
        [
          'Single inbound invitation from Grace Whitmore (Whitmore Foundation).',
          'Latest ask: “Please let me know personally whether you can make it.”',
          'The sender explicitly does not want the office to answer.',
        ]
      ),
      seedExtras: {
        actionItems: ['Alex to personally accept or decline the Winter Gala invitation'],
        appointments: [APPT('t11-ap1', 'Whitmore Winter Gala', 20, 19, 0)],
      },
    }),

    /* 12 — M&A negotiation → CLIENT */
    base({
      _id: 't12',
      accountId: 'acc-gmail',
      accountEmail: GMAIL_EMAIL,
      provider: 'gmail',
      subject: 'Revised draft — Section 4.2 earn-out mechanics',
      participants: [
        counterparty('Reginald Foss', 'r.foss@argentpartners.com', 'Managing Partner, Argent Partners'),
        ME,
        teammate('Maya Lin', 'maya.lin@meridianholdings.com', 'Head of Operations, Meridian'),
      ],
      important: true,
      unread: true,
      priority: 'high',
      labels: ['Action Required', 'Important'],
      status: 'action_required',
      category: 'Action Required',
      clientWhyNeeded: 'Negotiation position on the earn-out structure — a decision only you can set.',
      messages: [
        msg(
          't12-m1',
          counterparty('Reginald Foss', 'r.foss@argentpartners.com'),
          'inbound',
          `Alex,

We have worked Section 4.2 into something we can both live with, but the earn-out trigger still assumes the current revenue split. Our position is that the trigger should be measured on contribution margin instead, with a 24-month window.

I am not going to put a red line in writing before we speak. I would like 20 minutes with you directly to settle the last two points, because I do not want this bouncing through teams.

Reginald`,
          at(-2, 15, 50),
          { cc: [teammate('Maya Lin', 'maya.lin@meridianholdings.com')] }
        ),
        msg(
          't12-m2',
          ME,
          'outbound',
          `Reginald,

Thanks for the revised draft. I have logged it and moved it out of the standard queue — this needs Alex personally given it touches earn-out mechanics.

I will coordinate timing for the direct call once Alex has reviewed Section 4.2.

Sarah`,
          at(-1, 9, 12),
          { recipient: counterparty('Reginald Foss', 'r.foss@argentpartners.com') }
        ),
      ],
      followUps: [
        {
          from: counterparty('Reginald Foss', 'r.foss@argentpartners.com'),
          body: `Sarah — I need Alex's position on the earn-out trigger, and I need it from Alex rather than the deal team. Marking this as sensitive: it is our final position on Section 4.2 and it should not be circulated further.`,
          receivedAt: at(0, 11, 30),
        },
      ],
      ai: AI(
        'client_reply',
        91,
        'Classified as Client to Reply because the sender requires Alex’s own negotiating position on sensitive earn-out mechanics, marks the thread final-position and confidential, and explicitly declines to route it through the team. Confidence 91%.',
        'Argent Partners wants a direct call with Alex to settle Section 4.2 earn-out mechanics; the revised trigger would move from revenue split to contribution margin over 24 months.',
        [
          '2 messages with Reginald Foss (Argent Partners), Maya Lin cc’d.',
          'Latest ask: “I need Alex’s position, from Alex rather than the deal team.”',
          'We have already acknowledged and taken it out of the standard queue.',
          'Commercially sensitive — flagged as final position for this round.',
        ]
      ),
      seedExtras: {
        actionItems: ['Alex to set Meridian’s position on the Section 4.2 earn-out trigger', 'Coordinate a direct 20-minute call with Reginald Foss'],
      },
    }),

    /* 13 — Vendor quote follow-up, we replied → ASSISTANT (waiting) */
    base({
      _id: 't13',
      accountId: 'acc-gmail',
      accountEmail: GMAIL_EMAIL,
      provider: 'gmail',
      subject: 'Re: Q4 media plan — awaiting your revised quote',
      participants: [counterparty('Nathan Cole', 'nathan.cole@brightline.media', 'Account Director, Brightline Media'), ME],
      labels: ['Waiting for Response', 'Action Required'],
      status: 'waiting',
      category: 'Waiting for Response',
      messages: [
        msg(
          't13-m1',
          counterparty('Nathan Cole', 'nathan.cole@brightline.media'),
          'inbound',
          `Hi Sarah,

Here is the Q4 media plan with the budget we discussed. Total commitment is 28% above Q3, mostly driven by the podcast allocation.

I need sign-off from Meridian to hold the inventory — some of it goes live early next month.

Nathan`,
          at(-4, 11, 25)
        ),
        msg(
          't13-m2',
          ME,
          'outbound',
          `Hi Nathan,

Thanks for the plan. Before this can go for approval I need a revised quote that separates the podcast allocation from the rest, plus the performance data from the Q3 pilot.

Once those two things arrive I will move this forward on our side.

Sarah`,
          at(-3, 16, 5),
          { recipient: counterparty('Nathan Cole', 'nathan.cole@brightline.media') }
        ),
      ],
      followUps: [],
      ai: AI(
        'assistant_reply',
        76,
        'Classified as Assistant to Reply because the open item is a routine vendor follow-up — extracting a revised quote and Q3 performance data. Sarah has replied and is waiting on Brightline, so no executive action is currently required. Confidence 76%.',
        'Brightline Media’s Q4 media plan needs approval to hold inventory; we asked for a split-out podcast quote and Q3 pilot data before it moves forward.',
        [
          '2 messages with Nathan Cole (Brightline Media).',
          'We replied asking for a revised quote and pilot performance data.',
          'Parked in Waiting for Response until Brightline comes back.',
        ]
      ),
      seedExtras: {
        actionItems: ['Chase the revised Brightline quote separating podcast spend', 'Request Q3 pilot performance data'],
      },
    }),

    /* 14 — Internal FYI → NO REPLY */
    base({
      _id: 't14',
      accountId: 'acc-gmail',
      accountEmail: GMAIL_EMAIL,
      provider: 'gmail',
      subject: 'FYI — office move timeline updated',
      participants: [
        teammate('Maya Lin', 'maya.lin@meridianholdings.com', 'Head of Operations, Meridian'),
        ME,
      ],
      labels: ['General'],
      status: 'general',
      category: 'General',
      messages: [
        msg(
          't14-m1',
          teammate('Maya Lin', 'maya.lin@meridianholdings.com'),
          'inbound',
          `Hi Sarah,

FYI only, no action needed from you: we have shifted the third-floor move to the second week of next month. Facilities will handle packing and the exec floor is unaffected.

Just keeping you in the loop so the calendar is not a surprise.

Maya`,
          at(-2, 12, 0)
        ),
      ],
      followUps: [],
      ai: AI(
        'no_reply',
        92,
        'Classified as No Reply Needed because the sender explicitly labels it FYI with “no action needed from you” and the content is an internal timeline update. Confidence 92%.',
        'Ops has moved the third-floor office move to the second week of next month; the exec floor is unaffected and no action is needed.',
        [
          'Single internal update from Maya Lin (Head of Operations).',
          'Explicitly flagged “no action needed from you”.',
          'Informational only — exec floor unaffected.',
        ]
      ),
    }),

    /* 15 — Payment receipt → NO REPLY */
    base({
      _id: 't15',
      accountId: 'acc-gmail',
      accountEmail: GMAIL_EMAIL,
      provider: 'gmail',
      subject: 'Payment received — $12,400.00 USD',
      participants: [counterparty('Stripe', 'receipts@stripe.com', 'Stripe')],
      labels: ['General'],
      status: 'general',
      category: 'General',
      messages: [
        msg(
          't15-m1',
          counterparty('Stripe', 'receipts@stripe.com'),
          'inbound',
          `Payment received: $12,400.00 USD
Invoice: INV-20832 · Meridian Holdings
Paid via ACH transfer on ${monthDayOf(-4)}

This is an automated receipt. No action is required. Do not reply to this email.`,
          at(-4, 4, 0)
        ),
      ],
      followUps: [],
      ai: AI(
        'no_reply',
        97,
        'Classified as No Reply Needed because this is an automated payment receipt from a no-reply billing address that states no action is required. Confidence 97%.',
        'Stripe confirmed receipt of $12,400.00 against invoice INV-20832 — an automated receipt with no action required.',
        [
          'Automated receipt from Stripe billing.',
          'Explicitly says no action is required and not to reply.',
          'File for finance records.',
        ]
      ),
    }),

    /* 16 — Already resolved → NO REPLY / archived */
    base({
      _id: 't16',
      accountId: 'acc-gmail',
      accountEmail: GMAIL_EMAIL,
      provider: 'gmail',
      subject: 'Re: Exec offsite agenda — resolved',
      participants: [counterparty('Tom Bradley', 'tom.bradley@meridianholdings.com', 'Chief of Staff, Meridian'), ME],
      archived: true,
      completed: true,
      labels: ['Archived / Completed'],
      status: 'archived',
      category: 'Archived / Completed',
      messages: [
        msg(
          't16-m1',
          counterparty('Tom Bradley', 'tom.bradley@meridianholdings.com'),
          'inbound',
          `Sarah,

Can you lock the offsite agenda today? I want to send it to the leadership team.

Tom`,
          at(-9, 10, 0)
        ),
        msg(
          't16-m2',
          ME,
          'outbound',
          `Hi Tom,

Agenda is locked and sent to the leadership distribution list. All sessions confirmed, including the afternoon working block.

Nothing further needed — closing this out.

Sarah`,
          at(-8, 9, 20),
          { recipient: counterparty('Tom Bradley', 'tom.bradley@meridianholdings.com') }
        ),
        msg(
          't16-m3',
          counterparty('Tom Bradley', 'tom.bradley@meridianholdings.com'),
          'inbound',
          `Perfect, all set — thanks Sarah. No further action needed on this one.`,
          at(-8, 9, 45)
        ),
      ],
      followUps: [],
      ai: AI(
        'no_reply',
        90,
        'Classified as No Reply Needed because both parties have confirmed the agenda is locked and the sender states no further action is needed. The thread is completed and archived. Confidence 90%.',
        'The exec offsite agenda was locked and distributed; Tom confirmed no further action and the thread is closed.',
        [
          '3 messages with Tom Bradley (Chief of Staff).',
          'Our reply locked and distributed the agenda.',
          'Sender confirmed “no further action needed” — thread completed.',
        ]
      ),
    }),
  ];
}

/* ------------------------------------------------------------------ *
 * Secondary mailbox (Outlook) — fetched on connect
 * ------------------------------------------------------------------ */
function outlookThreads() {
  const oc = (name, email, title) => ({ name, email, role: 'counterparty', title });
  return [
    base({
      _id: 'o1',
      accountId: 'acc-outlook',
      accountEmail: OUTLOOK_EMAIL,
      provider: 'outlook',
      subject: 'Can we move Wednesday 10:00 AM to next week?',
      participants: [oc('Belinda Hart', 'belinda@hartandoo.com', 'Principal, Hart & Co'), CLIENT],
      unread: true,
      labels: ['Meetings & Appointments'],
      status: 'action_required',
      category: 'Meetings & Appointments',
      messages: [
        msg(
          'o1-m1',
          oc('Belinda Hart', 'belinda@hartandoo.com'),
          'inbound',
          `Hi Sarah,

I am double-booked on ${weekdayOf(2)} at 10:00 AM — could we move the operations review session to next week? Any morning except Monday works for me.

Belinda`,
          at(-1, 8, 40)
        ),
      ],
      followUps: [],
      ai: AI(
        'assistant_reply',
        90,
        'Classified as Assistant to Reply because this is a rescheduling request for an operations review session with clear availability windows. Confidence 90%.',
        'Belinda Hart needs the Wednesday 10:00 AM operations review session moved to next week, any morning except Monday.',
        ['Rescheduling request with stated availability.', 'No decision content — pure calendar coordination.'],
      ),
      seedExtras: {
        appointments: [APPT('o1-ap1', 'Operations Review session (reschedule pending)', 2, 10, 0)],
        actionItems: ['Re-book the Hart & Co operations review for next week (not Monday)'],
      },
    }),
    base({
      _id: 'o2',
      accountId: 'acc-outlook',
      accountEmail: OUTLOOK_EMAIL,
      provider: 'outlook',
      subject: 'Your AWS invoice for October is available',
      participants: [oc('AWS Billing', 'aws-billing@amazon.com', 'Amazon Web Services')],
      labels: ['General'],
      status: 'general',
      category: 'General',
      messages: [
        msg(
          'o2-m1',
          oc('AWS Billing', 'aws-billing@amazon.com'),
          'inbound',
          `Your AWS invoice for October 2026 is now available in the billing console. Total: $41,220.18, charged automatically to the card on file.

This is an automated notification. Do not reply.`,
          at(-3, 3, 10)
        ),
      ],
      followUps: [],
      ai: AI(
        'no_reply',
        96,
        'Classified as No Reply Needed because this is an automated billing notification charged automatically, with no action requested. Confidence 96%.',
        'AWS October invoice ($41,220.18) is available and was auto-charged — notification only.',
        ['Automated billing notification.', 'No action requested; auto-pay already applied.'],
      ),
    }),
    base({
      _id: 'o3',
      accountId: 'acc-outlook',
      accountEmail: OUTLOOK_EMAIL,
      provider: 'outlook',
      subject: 'Need Alex’s signature on the Vertex MSA',
      participants: [oc('Tobias Green', 'tobias.green@vertexlegal.com', 'Counsel, Vertex Legal'), CLIENT],
      important: true,
      unread: true,
      labels: ['Action Required', 'Important'],
      status: 'action_required',
      category: 'Action Required',
      clientWhyNeeded: 'A master services agreement requires your signature as CEO.',
      messages: [
        msg(
          'o3-m1',
          oc('Tobias Green', 'tobias.green@vertexlegal.com'),
          'inbound',
          `Alex,

The Vertex MSA is ready for signature. As this is a master agreement with unlimited liability caps removed, I need Alex's signature as CEO — I cannot accept a delegated approval on it.

Please arrange for Alex to sign and return.`,
          at(-1, 14, 20)
        ),
      ],
      followUps: [],
      ai: AI(
        'client_reply',
        93,
        'Classified as Client to Reply because counsel requires the CEO’s signature on a master services agreement and explicitly rejects a delegated approval. Confidence 93%.',
        'Vertex Legal needs Alex’s signature as CEO on the master services agreement; delegated approval will not be accepted.',
        ['CEO signature required on a master agreement.', 'Delegated approval explicitly rejected.'],
      ),
      seedExtras: {
        actionItems: ['Alex to sign and return the Vertex MSA'],
      },
    }),
    base({
      _id: 'o4',
      accountId: 'acc-outlook',
      accountEmail: OUTLOOK_EMAIL,
      provider: 'outlook',
      subject: 'Reminder: benefits enrolment closes Friday',
      participants: [oc('People Ops', 'people@meridianholdings.com', 'People Operations, Meridian')],
      unread: true,
      labels: ['Action Required'],
      status: 'action_required',
      category: 'Action Required',
      messages: [
        msg(
          'o4-m1',
          oc('People Ops', 'people@meridianholdings.com'),
          'inbound',
          `Hi Sarah,

Reminder that exec benefits enrolment closes on ${weekdayOf(4)}. Please make sure Alex's selections are submitted on the portal — the default plan will apply automatically if nothing is submitted, which typically is not what the exec team chooses.

People Ops`,
          at(-1, 9, 15)
        ),
      ],
      followUps: [],
      ai: AI(
        'assistant_reply',
        85,
        'Classified as Assistant to Reply because this is an administrative enrolment task with a clear deadline that the assistant can complete on the portal. Confidence 85%.',
        'Exec benefits enrolment closes Friday and Alex’s selections must be submitted on the portal or the default plan applies.',
        ['Administrative deadline-driven task.', 'Assistant has portal access to submit selections.'],
      ),
      seedExtras: {
        deadlines: [DEADLINE('o4-dl1', `${weekdayOf(4)} benefits enrolment closes`, 4)],
        actionItems: ['Submit Alex’s benefits selections on the People Ops portal'],
      },
    }),
  ];
}

/* ------------------------------------------------------------------ *
 * Assembler
 * ------------------------------------------------------------------ */
function hydrate(thread) {
  const { seedExtras, ...rest } = thread;
  const extracted = extractEntities(rest);

  if (seedExtras) {
    const actionItems = (seedExtras.actionItems || []).map((label, i) => ({
      id: `${thread._id}-seed-ai-${i}`,
      label,
      from: thread.messages[0].from.name,
    }));
    const appointments = (seedExtras.appointments || []).map((a) => {
      const date = new Date();
      date.setDate(date.getDate() + a.dayOffset);
      date.setHours(a.hh, a.mm || 0, 0, 0);
      return {
        id: a.id,
        title: a.title,
        label: `${a.title} – ${date.toLocaleDateString('en-US', { weekday: 'short' })}, ${date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })}`,
        start: date.toISOString(),
        timeLabel: `${date.toLocaleDateString('en-US', { weekday: 'long' })} at ${date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })}`,
        from: thread.messages[0].from.name,
      };
    });
    const deadlines = (seedExtras.deadlines || []).map((d) => {
      const date = new Date();
      date.setDate(date.getDate() + d.dayOffset);
      date.setHours(18, 0, 0, 0);
      return { id: d.id, label: d.label, dueDate: date.toISOString(), from: thread.messages[0].from.name };
    });
    extracted.actionItems = dedupeById([...actionItems, ...extracted.actionItems]).slice(0, 5);
    if (appointments.length) extracted.appointments = dedupeById(appointments).slice(0, 3);
    if (deadlines.length) extracted.deadlines = dedupeById(deadlines).slice(0, 3);
  }

  return { ...rest, extracted, followUps: rest.followUps || [], history: rest.history || [] };
}

function dedupeById(list) {
  const seen = new Set();
  return list.filter((item) => {
    const key = `${item.title || item.label}`.toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildSeed() {
  const threads = [...gmailThreads(), ...outlookThreads()].map(hydrate);
  const accounts = [
    {
      _id: 'acc-gmail',
      provider: 'gmail',
      email: GMAIL_EMAIL,
      displayName: 'Sarah Chen (Assistant workspace)',
      status: 'connected',
      connected: true,
      scopes: ['read', 'organize', 'draft'],
      lastSyncedAt: new Date().toISOString(),
      simulated: true,
    },
    {
      _id: 'acc-outlook',
      provider: 'outlook',
      email: OUTLOOK_EMAIL,
      displayName: 'Alex Mercer (Executive mailbox)',
      status: 'disconnected',
      connected: false,
      scopes: [],
      lastSyncedAt: null,
      simulated: true,
    },
  ];
  return { threads, accounts };
}
