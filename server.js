import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

const PORT = process.env.PORT || 3000;
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ status: 'online', game: 'cute-lowpoly-game-multiplayer', players: players.size }));
});

const wss = new WebSocketServer({ server });

// Danh sách các điểm hồi sinh an toàn trên bản đồ kinh thành
const SPAWN_POINTS = [
  { x: 0, z: -40 },
  { x: -35, z: -25 },
  { x: 35, z: -25 },
  { x: -50, z: 20 },
  { x: 50, z: 20 },
  { x: 0, z: 25 },
  { x: -70, z: -70 },
  { x: 70, z: -70 },
  { x: -20, z: 70 },
  { x: 20, z: 70 },
];

function getRandomSpawn() {
  const sp = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
  return {
    x: sp.x + (Math.random() - 0.5) * 6,
    y: 0,
    z: sp.z + (Math.random() - 0.5) * 6,
  };
}

let nextPlayerId = 1;
const players = new Map(); // id -> playerData

wss.on('connection', (ws) => {
  const playerId = `player_${nextPlayerId++}_${Math.random().toString(36).substring(2, 7)}`;
  let player = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'join': {
          const spawn = getRandomSpawn();
          player = {
            id: playerId,
            name: (msg.name || 'Gấu Hiệp Sĩ').trim().substring(0, 18),
            outfit: Number(msg.outfit) || 0,
            x: spawn.x,
            y: spawn.y,
            z: spawn.z,
            rotY: 0,
            isMoving: false,
            isSprinting: false,
            isGrounded: true,
            isCasting: false,
            castSkill: 0,
            hp: 2000,
            maxHp: 2000,
            kills: 0,
            deaths: 0,
            isDead: false,
            lastUpdate: Date.now(),
            ws,
          };

          players.set(playerId, player);

          // 1. Gửi lại cho người chơi này thông tin khởi tạo (ID của mình và danh sách người chơi khác)
          const otherPlayers = [];
          for (const [id, p] of players.entries()) {
            if (id !== playerId) {
              otherPlayers.push({
                id: p.id,
                name: p.name,
                outfit: p.outfit,
                x: p.x,
                y: p.y,
                z: p.z,
                rotY: p.rotY,
                hp: p.hp,
                maxHp: p.maxHp,
                kills: p.kills,
                deaths: p.deaths,
                isDead: p.isDead,
              });
            }
          }

          ws.send(JSON.stringify({
            type: 'init',
            selfId: playerId,
            spawn,
            hp: player.hp,
            maxHp: player.maxHp,
            players: otherPlayers,
          }));

          // 2. Broadcast cho tất cả người chơi khác biết người mới tham gia
          broadcastExcept(playerId, {
            type: 'player_joined',
            player: {
              id: player.id,
              name: player.name,
              outfit: player.outfit,
              x: player.x,
              y: player.y,
              z: player.z,
              rotY: player.rotY,
              hp: player.hp,
              maxHp: player.maxHp,
              kills: player.kills,
              deaths: player.deaths,
              isDead: false,
            }
          });

          console.log(`[JOIN] ${player.name} (${playerId}) joined. Total online: ${players.size}`);
          break;
        }

        case 'state': {
          if (!player || player.isDead) return;
          player.x = msg.x;
          player.y = msg.y;
          player.z = msg.z;
          player.rotY = msg.rotY;
          player.isMoving = msg.isMoving;
          player.isSprinting = msg.isSprinting;
          player.isGrounded = msg.isGrounded;
          player.isCasting = msg.isCasting;
          player.castSkill = msg.castSkill;
          player.lastUpdate = Date.now();

          // Broadcast trạng thái cho các người chơi khác
          broadcastExcept(playerId, {
            type: 'player_state',
            id: playerId,
            x: player.x,
            y: player.y,
            z: player.z,
            rotY: player.rotY,
            isMoving: player.isMoving,
            isSprinting: player.isSprinting,
            isGrounded: player.isGrounded,
            isCasting: player.isCasting,
            castSkill: player.castSkill,
            clones: sanitizeClones(msg.clones),
          });
          break;
        }

        case 'shoot': {
          if (!player || player.isDead) return;
          broadcastExcept(playerId, {
            type: 'player_shoot',
            id: playerId,
            origin: msg.origin,
            direction: msg.direction,
            // Loại đòn kiếm: chém combo (step 0-2), kiếm khí tụ lực (power 0-1),
            // chém hoàng kim của Bạch Ảnh (gslash) hoặc tia sét vàng của Tử Ảnh (bolt, kèm target)
            kind: ['qi', 'gslash', 'bolt'].includes(msg.kind) ? msg.kind : 'slash',
            target: sanitizePoint(msg.target),
            step: Math.min(2, Math.max(0, Math.floor(Number(msg.step) || 0))),
            power: Math.min(1, Math.max(0, Number(msg.power) || 0)),
            // Đòn do đạo ảnh phân thân (0 hoặc 1) chém ra, không có thì là đòn của chính người chơi
            clone: msg.clone === 0 || msg.clone === 1 ? msg.clone : null,
          });
          break;
        }

        case 'skill': {
          if (!player || player.isDead) return;
          broadcastExcept(playerId, {
            type: 'player_skill',
            id: playerId,
            skillIndex: msg.skillIndex,
            targetPos: msg.targetPos,
          });
          break;
        }

        case 'hit': {
          if (!player || player.isDead) return;

          // Đánh trúng đạo ảnh phân thân (id "<chủ nhân>#clone<i>"): chuyển cho máy chủ nhân tự trừ máu đạo ảnh
          const cloneMatch = /^(.+)#clone([01])$/.exec(String(msg.targetId || ''));
          if (cloneMatch) {
            const owner = players.get(cloneMatch[1]);
            if (!owner || owner.isDead || owner.id === player.id || owner.ws.readyState !== WebSocket.OPEN) return;
            owner.ws.send(JSON.stringify({
              type: 'clone_damaged',
              clone: Number(cloneMatch[2]),
              attackerId: player.id,
              damage: Math.min(600, Math.max(5, Math.round(Number(msg.damage) || 30))),
              hitPos: msg.hitPos,
            }));
            break;
          }

          const target = players.get(msg.targetId);
          if (!target || target.isDead) return;

          const dmg = Math.min(600, Math.max(5, Math.round(Number(msg.damage) || 30)));
          target.hp = Math.max(0, target.hp - dmg);

          // Broadcast cho toàn phòng biết mục tiêu bị dính sát thương
          broadcast({
            type: 'player_damaged',
            targetId: target.id,
            attackerId: player.id,
            damage: dmg,
            hp: target.hp,
            maxHp: target.maxHp,
            hitPos: msg.hitPos,
            source: msg.source || 'blaster',
          });

          // Nếu hết máu -> Tử trận!
          if (target.hp <= 0 && !target.isDead) {
            target.isDead = true;
            target.deaths++;
            player.kills++;

            broadcast({
              type: 'player_killed',
              killerId: player.id,
              killerName: player.name,
              victimId: target.id,
              victimName: target.name,
              killerKills: player.kills,
              victimDeaths: target.deaths,
            });

            console.log(`[KILL] ${player.name} killed ${target.name}!`);

            // Đặt lịch hồi sinh sau 4.5 giây
            setTimeout(() => {
              if (players.has(target.id)) {
                const respawnPos = getRandomSpawn();
                target.isDead = false;
                target.hp = target.maxHp;
                target.x = respawnPos.x;
                target.y = respawnPos.y;
                target.z = respawnPos.z;

                broadcast({
                  type: 'player_respawn',
                  id: target.id,
                  spawn: respawnPos,
                  hp: target.hp,
                  maxHp: target.maxHp,
                });
                console.log(`[RESPAWN] ${target.name} respawned.`);
              }
            }, 4500);
          }
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong', clientTime: msg.clientTime }));
          break;
        }
      }
    } catch (err) {
      console.error('Error handling websocket message:', err);
    }
  });

  ws.on('close', () => {
    if (player) {
      console.log(`[LEAVE] ${player.name} (${playerId}) left.`);
      players.delete(playerId);
      broadcast({
        type: 'player_left',
        id: playerId,
        name: player.name,
      });
    }
  });

  ws.on('error', (err) => {
    console.error(`Socket error for ${playerId}:`, err.message);
  });
});

function sanitizePoint(p) {
  if (!p || typeof p !== 'object') return null;
  return { x: Number(p.x) || 0, y: Number(p.y) || 0, z: Number(p.z) || 0 };
}

// Trạng thái đạo ảnh phân thân gửi kèm 'state': tối đa 2 đạo ảnh, chỉ giữ các trường số cần thiết
function sanitizeClones(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 2)
    .filter((c) => c && (c.i === 0 || c.i === 1))
    .map((c) => ({
      i: c.i,
      x: Number(c.x) || 0,
      y: Number(c.y) || 0,
      z: Number(c.z) || 0,
      rotY: Number(c.rotY) || 0,
      hp: Math.max(0, Number(c.hp) || 0),
      maxHp: Math.max(1, Number(c.maxHp) || 1),
    }));
}

function broadcast(msg) {
  const str = JSON.stringify(msg);
  for (const [, p] of players) {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(str);
    }
  }
}

function broadcastExcept(excludeId, msg) {
  const str = JSON.stringify(msg);
  for (const [id, p] of players) {
    if (id !== excludeId && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(str);
    }
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Cute Low-Poly Online Server is listening on ws://0.0.0.0:${PORT}`);
});
