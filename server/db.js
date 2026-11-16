/**
 * Storage layer.
 *
 * The application logic always talks to the in-memory collections below, which
 * guarantees the app boots and works with zero configuration. If MONGODB_URI is
 * provided we transparently mirror every write to MongoDB (Mongoose) and
 * hydrate the in-memory cache from it on boot.
 */
import mongoose from 'mongoose';

const ThreadSchema = new mongoose.Schema(
  {
    _id: { type: String },
    accountId: String,
    accountEmail: String,
    provider: String,
    subject: String,
    participants: { type: Array, default: [] },
    messages: { type: Array, default: [] },
    labels: { type: Array, default: [] },
    extracted: { type: Object, default: {} },
    draft: { type: Object, default: null },
    ai: { type: Object, default: {} },
    followUps: { type: Array, default: [] },
  },
  { strict: false, timestamps: true, _id: false, minimize: false }
);

const AccountSchema = new mongoose.Schema(
  {
    _id: { type: String },
    provider: String,
    email: String,
    displayName: String,
    status: String,
    connected: Boolean,
    scopes: { type: Array, default: [] },
  },
  { strict: false, timestamps: true, _id: false, minimize: false }
);

const ThreadModel = mongoose.model('Thread', ThreadSchema);
const AccountModel = mongoose.model('Account', AccountSchema);

const clone = (value) => JSON.parse(JSON.stringify(value));

export const store = {
  mode: 'memory',
  dbState: 'offline',
  accounts: [],
  threads: [],

  /** @param {(threads:any[], accounts:any[]) => void} seedFactory */
  async init(seedFactory) {
    const uri = process.env.MONGODB_URI;
    if (uri) {
      try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
        this.mode = 'mongodb';
        this.dbState = 'connected';
        const [threads, accounts] = await Promise.all([
          ThreadModel.find({}).lean(),
          AccountModel.find({}).lean(),
        ]);
        if (threads.length) {
          this.threads = threads.map(clean);
          this.accounts = accounts.map(clean);
          console.log(`[db] MongoDB connected — loaded ${threads.length} threads`);
          return;
        }
        console.log('[db] MongoDB connected — empty database, seeding…');
      } catch (err) {
        this.mode = 'memory';
        this.dbState = 'unreachable';
        console.warn(`[db] MongoDB unavailable (${err.message}) — falling back to in-memory store`);
      }
    } else {
      console.log('[db] No MONGODB_URI — using auto-seeded in-memory store');
    }
    const { threads, accounts } = seedFactory();
    this.threads = threads;
    this.accounts = accounts;
    await this.mirrorAll();
  },

  async mirrorAll() {
    if (this.mode !== 'mongodb') return;
    try {
      await Promise.all([
        ...this.threads.map((t) => ThreadModel.replaceOne({ _id: t._id }, t, { upsert: true })),
        ...this.accounts.map((a) => AccountModel.replaceOne({ _id: a._id }, a, { upsert: true })),
      ]);
    } catch (err) {
      console.warn(`[db] mirror failed: ${err.message}`);
    }
  },

  async saveThread(thread) {
    const idx = this.threads.findIndex((t) => t._id === thread._id);
    if (idx === -1) this.threads.push(thread);
    else this.threads[idx] = thread;
    if (this.mode === 'mongodb') {
      try {
        await ThreadModel.replaceOne({ _id: thread._id }, thread, { upsert: true });
      } catch (err) {
        console.warn(`[db] write-through failed: ${err.message}`);
      }
    }
    return thread;
  },

  async saveAccount(account) {
    const idx = this.accounts.findIndex((a) => a._id === account._id);
    if (idx === -1) this.accounts.push(account);
    else this.accounts[idx] = account;
    if (this.mode === 'mongodb') {
      try {
        await AccountModel.replaceOne({ _id: account._id }, account, { upsert: true });
      } catch (err) {
        console.warn(`[db] write-through failed: ${err.message}`);
      }
    }
    return account;
  },

  /** Replaces the whole dataset (seed reset / re-sync of a provider). */
  async replaceAll({ threads, accounts }) {
    if (threads) this.threads = threads;
    if (accounts) this.accounts = accounts;
    if (this.mode === 'mongodb') {
      try {
        await Promise.all([ThreadModel.deleteMany({}), AccountModel.deleteMany({})]);
      } catch (err) {
        console.warn(`[db] clean failed: ${err.message}`);
      }
    }
    await this.mirrorAll();
  },

  findThread(id) {
    return this.threads.find((t) => t._id === id) || null;
  },

  connectedProviders() {
    return this.accounts.filter((a) => a.connected).map((a) => a.provider);
  },

  /** Threads belonging to a connected mailbox only. */
  visibleThreads() {
    const allowed = new Set(this.connectedProviders());
    return this.threads.filter((t) => allowed.has(t.provider));
  },
};

/** Mongo returns _id + __v noise; keep the shape identical to the in-memory docs. */
function clean(doc) {
  const { __v, ...rest } = doc;
  return clone(rest);
}

export const snapshot = clone;
