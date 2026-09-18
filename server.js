const { WebSocketServer } = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;

// Один HTTP-сервер: отдаёт /health и держит WebSocket
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('ok');
    return;
  }
  res.writeHead(200);
  res.end('Zombie server is running');
});

// WebSocket цепляется к тому же порту
const wss = new WebSocketServer({ server });

server.listen(PORT, () => {
  console.log('Server on', PORT);
});

/* ---------- Игровая логика ---------- */
const players = {};
let nextId = 1;

wss.on('connection', (ws) => {
  const id = nextId++;
  players[id] = {
    id,
    x: 1300, y: 1000,
    hp: 100, maxHp: 100,
    aim: 0,
    weapon: 'pistol'
  };
  console.log('+ Игрок', id, '(всего:', nextId - 1, ')');

  // Отправляем новичку его id и текущий список игроков
  ws.send(JSON.stringify({ t: 'init', id, players }));

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.t === 'input') {
      const p = players[id];
      if (!p) return;
      p.x = m.x;
      p.y = m.y;
      p.hp = m.hp;
      p.aim = m.aim;
      p.weapon = m.weapon;
      broadcast({ t: 'state', players });
    }

    if (m.t === 'shoot') {
      broadcast({
        t: 'shoot',
        id,
        x: m.x, y: m.y, aim: m.aim,
        weapon: m.weapon
      });
    }
  });

  ws.on('close', () => {
    delete players[id];
    broadcast({ t: 'left', id });
    console.log('- Игрок', id, '(осталось:', Object.keys(players).length, ')');
  });

  ws.on('error', (e) => console.log('WS error', id, e.message));
});

function broadcast(obj) {
  const s = JSON.stringify(obj);
  wss.clients.forEach(c => {
    if (c.readyState === 1) c.send(s);
  });
}

// Защита от падения процесса
process.on('uncaughtException', (e) => console.log('uncaught:', e.message));
process.on('unhandledRejection', (e) => console.log('rejection:', e));
