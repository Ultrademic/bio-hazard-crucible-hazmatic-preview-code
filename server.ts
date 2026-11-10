import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '2mb' }));

// In-memory data stores for arcade leaderboard and cloud saves
interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  shipId: string;
  shipName: string;
  stage: number;
  mode: 'standard' | 'daily' | 'boss_rush';
  dailyDate?: string;
  date: string;
  platform: string;
}

let leaderboard: LeaderboardEntry[] = [
  {
    id: 'entry-1',
    name: 'K.RYU',
    score: 184500,
    shipId: 'orestes',
    shipName: 'Orestes-01',
    stage: 4,
    mode: 'standard',
    date: '2026-10-12',
    platform: 'PC/Arcade'
  },
  {
    id: 'entry-2',
    name: 'ULTRADEMIC',
    score: 152800,
    shipId: 'pyron',
    shipName: 'Pyron-Crimson',
    stage: 3,
    mode: 'standard',
    date: '2026-10-13',
    platform: 'Controller'
  },
  {
    id: 'entry-3',
    name: 'BIO_ACE',
    score: 139200,
    shipId: 'electra',
    shipName: 'Electra-Gold',
    stage: 3,
    mode: 'daily',
    dailyDate: new Date().toISOString().split('T')[0],
    date: '2026-10-13',
    platform: 'Mobile Touch'
  },
  {
    id: 'entry-4',
    name: 'HIOB_TANK',
    score: 118400,
    shipId: 'hiob',
    shipName: 'Hiob-Carapace',
    stage: 2,
    mode: 'standard',
    date: '2026-10-11',
    platform: 'Handheld'
  },
  {
    id: 'entry-5',
    name: 'AVARON_92',
    score: 96700,
    shipId: 'orestes',
    shipName: 'Orestes-01',
    stage: 2,
    mode: 'daily',
    dailyDate: new Date().toISOString().split('T')[0],
    date: '2026-10-13',
    platform: 'PC'
  }
];

// Cloud saves store keyed by 6-character sync code
const cloudSaves: Record<string, { code: string; data: any; updatedAt: string }> = {
  'AVAR92': {
    code: 'AVAR92',
    updatedAt: new Date().toISOString(),
    data: {
      pilotName: 'AVARON_92',
      credits: 450,
      unlockedShips: ['orestes', 'electra', 'hiob'],
      activeShipId: 'electra',
      highScore: 96700,
      mutations: {
        chitinArmor: 2,
        podOverclock: 1,
        plasmaReflex: 1,
        homingSporeTier: 2
      },
      settings: {
        crtFilter: true,
        bgmVolume: 0.8,
        sfxVolume: 0.9,
        vibration: true,
        controls: 'touch'
      }
    }
  }
};

// Generate random uppercase code
function generateSyncCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = '';
  for (let i = 0; i < 6; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

// 1. Leaderboard Endpoints
app.get('/api/leaderboard', (req, res) => {
  const mode = req.query.mode as string | undefined;
  const date = req.query.date as string | undefined;

  let filtered = [...leaderboard];
  if (mode) {
    filtered = filtered.filter(item => item.mode === mode);
  }
  if (date) {
    filtered = filtered.filter(item => item.dailyDate === date);
  }

  filtered.sort((a, b) => b.score - a.score);
  res.json({ success: true, count: filtered.length, entries: filtered.slice(0, 50) });
});

app.post('/api/leaderboard', (req, res) => {
  const { name, score, shipId, shipName, stage, mode, dailyDate, platform } = req.body;
  if (!name || typeof score !== 'number') {
    return res.status(400).json({ error: 'Valid player name and numeric score required' });
  }

  const cleanName = (String(name).trim().toUpperCase().slice(0, 10)) || 'PILOT';
  const newEntry: LeaderboardEntry = {
    id: `entry-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: cleanName,
    score: Math.max(0, Math.floor(score)),
    shipId: shipId || 'orestes',
    shipName: shipName || 'Orestes',
    stage: Number(stage) || 1,
    mode: mode === 'daily' ? 'daily' : mode === 'boss_rush' ? 'boss_rush' : 'standard',
    dailyDate: dailyDate || (mode === 'daily' ? new Date().toISOString().split('T')[0] : undefined),
    date: new Date().toISOString().split('T')[0],
    platform: platform || 'Web Arcade'
  };

  leaderboard.push(newEntry);
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, 100);

  // Calculate rank
  const rank = leaderboard.findIndex(e => e.id === newEntry.id) + 1;
  res.json({ success: true, entry: newEntry, rank });
});

// 2. Daily Challenge Endpoint
app.get('/api/daily-challenge', (_req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  // Deterministic seed based on date
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = (hash << 5) - hash + today.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);

  const modifiers = [
    {
      id: 'acid_swarm',
      name: 'Acid Spore Influx',
      description: 'Hostile biomorphs spawn +35% faster. Slain enemies release corrosive spore bursts. Pod absorb generates +20% score!',
      multiplier: 1.4,
      bonusGoal: 'Destroy 40 Swarmers before Stage 1 Boss'
    },
    {
      id: 'pod_overcharge',
      name: 'Bio-Reactor Surge',
      description: 'Weapon Pods charge twice as fast with devastating radial arcs, but player hull shield is reduced by 25%.',
      multiplier: 1.3,
      bonusGoal: 'Defeat Centipede Boss using only Charged Pod Lasers'
    },
    {
      id: 'armored_colossus',
      name: 'Chitin Hypertrophy',
      description: 'All bio-monsters boast 50% thicker carapaces. Critical hits trigger chain detonations.',
      multiplier: 1.5,
      bonusGoal: 'Reach Stage 2 without losing a life'
    },
    {
      id: 'speed_reflex',
      name: 'Adrenaline Rush',
      description: 'Global game scroll and bullet velocity increased by 20%. Rapid reflex score multiplier active!',
      multiplier: 1.35,
      bonusGoal: 'Achieve 80% or higher shot accuracy'
    }
  ];

  const selectedMod = modifiers[absHash % modifiers.length];

  res.json({
    date: today,
    seed: absHash,
    title: `Daily Protocol: Sector ${absHash % 12 + 1}`,
    modifier: selectedMod,
    targetScore: 60000,
    rewards: {
      biomatter: 250,
      badge: 'AVARON_SURVIVOR'
    }
  });
});

// 3. Cloud Save Endpoints
app.post('/api/cloud-save', (req, res) => {
  const { code: requestedCode, data } = req.body;
  if (!data) {
    return res.status(400).json({ error: 'Save data payload is required' });
  }

  let code = requestedCode ? String(requestedCode).toUpperCase().trim() : generateSyncCode();
  // Ensure alphanumeric uppercase format
  code = code.replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (code.length < 4) {
    code = generateSyncCode();
  }

  cloudSaves[code] = {
    code,
    data,
    updatedAt: new Date().toISOString()
  };

  res.json({
    success: true,
    code,
    updatedAt: cloudSaves[code].updatedAt,
    message: `Cloud save synchronized successfully under code ${code}`
  });
});

app.get('/api/cloud-save/:code', (req, res) => {
  const code = String(req.params.code).toUpperCase().trim();
  const save = cloudSaves[code];
  if (!save) {
    return res.status(404).json({ error: `No cloud save found for sync code "${code}". Please check your code.` });
  }

  res.json({
    success: true,
    code: save.code,
    data: save.data,
    updatedAt: save.updatedAt
  });
});

// 4. Vite integration or static serve
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Dynamic import vite in dev
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Bio-Hazard Engine] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
