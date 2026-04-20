const http = require('http');
const path = require('path');
const Database = require('better-sqlite3');

const PORT = 3456;
const db = new Database(path.join(__dirname, 'data', 'leaderboard.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name    TEXT    NOT NULL,
    correct INTEGER NOT NULL,
    total   INTEGER NOT NULL,
    elapsed INTEGER NOT NULL,
    date    TEXT    NOT NULL
  )
`);
db.pragma('journal_mode = WAL');

const getScores = db.prepare(
  'SELECT name, correct, total, elapsed, date FROM scores ORDER BY correct DESC, elapsed ASC LIMIT 200'
);

const insertScore = db.prepare(
  'INSERT INTO scores (name, correct, total, elapsed, date) VALUES (@name, @correct, @total, @elapsed, @date)'
);

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function today() {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify(getScores.all()));
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let input;
      try { input = JSON.parse(body); } catch { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }

      const { name, correct, total, elapsed } = input || {};
      if (typeof name !== 'string' || !isFinite(correct) || !isFinite(total) || !isFinite(elapsed)) {
        res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid payload' })); return;
      }

      insertScore.run({
        name:    escHtml(String(name).trim().slice(0, 30)),
        correct: Math.trunc(Number(correct)),
        total:   Math.max(1, Math.trunc(Number(total))),
        elapsed: Math.max(0, Math.trunc(Number(elapsed))),
        date:    today()
      });

      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  res.writeHead(405);
  res.end(JSON.stringify({ error: 'Method not allowed' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`leaderboard api listening on 127.0.0.1:${PORT}`);
});
