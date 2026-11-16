import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { store } from './db.js';
import { buildSeed } from './services/seed.js';
import { llmConfig } from './services/ai.js';
import { router } from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// 1. API Routes
app.use('/api', router);

// 2. Serve Built React Frontend (client/dist)
const clientDistPath = path.join(__dirname, '../client/dist');

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // Send index.html for any non-API route (supports React Router & page refreshes)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      name: 'Relay API',
      tagline: 'AI reply-responsibility triage for executive assistants',
      note: 'Frontend build (client/dist) not found yet.',
    });
  });
}

// Fallback for unknown API paths
app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` }));

// Central error handler so a failing AI call never takes the server down
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: err.message || 'Unexpected server error' });
});

async function start() {
  await store.init(buildSeed);
  const ai = llmConfig();
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  ██  Relay Full-Stack App');
    console.log(`  ▸ http://0.0.0.0:${PORT}`);
    console.log(`  ▸ storage : ${store.mode === 'mongodb' ? 'MongoDB (mongoose)' : 'in-memory store (auto-seeded)'}`);
    console.log(`  ▸ threads : ${store.threads.length} seeded conversations`);
    console.log(`  ▸ ai      : ${ai.live ? `live LLM · ${ai.provider}/${ai.model}` : 'deterministic engine (no LLM_API_KEY set)'}`);
    console.log('');
  });
}

start().catch((err) => {
  console.error('Failed to start Relay API:', err);
  process.exit(1);
});