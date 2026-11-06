// Client WebSocket Network Manager for Multiplayer PvP

export class NetworkManager {
  constructor() {
    this.ws = null;
    this.selfId = null;
    this.isConnected = false;
    this.serverUrl = '';
    this.listeners = new Map();
    this.ping = 0;
    this.pingTimer = null;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const arr = this.listeners.get(event).filter(cb => cb !== callback);
    this.listeners.set(event, arr);
  }

  emit(event, data) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      for (const cb of cbs) {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in network listener for ${event}:`, e);
        }
      }
    }
  }

  connect(url, playerData) {
    return new Promise((resolve, reject) => {
      this.serverUrl = url;
      try {
        this.ws = new WebSocket(url);
      } catch (err) {
        return reject(err);
      }

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log('Connected to multiplayer server:', url);

        // Gửi gói join ngay sau khi kết nối
        this.send({
          type: 'join',
          name: playerData.name || 'Gấu Hiệp Sĩ',
          outfit: playerData.outfit || 0,
        });

        // Bắt đầu chu kỳ ping định kỳ
        this.startPing();
        this.emit('connected', { url });
        resolve(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error('Failed to parse WS message:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopPing();
        console.log('Disconnected from multiplayer server');
        this.emit('disconnected', {});
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket connection error:', err);
        this.emit('error', err);
        if (!this.isConnected) {
          reject(err);
        }
      };
    });
  }

  disconnect() {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping', clientTime: Date.now() });
      }
    }, 3000);
  }

  stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'init':
        this.selfId = msg.selfId;
        this.emit('init', msg);
        break;

      case 'player_joined':
        this.emit('player_joined', msg.player);
        break;

      case 'player_state':
        this.emit('player_state', msg);
        break;

      case 'player_shoot':
        this.emit('player_shoot', msg);
        break;

      case 'player_skill':
        this.emit('player_skill', msg);
        break;

      case 'player_damaged':
        this.emit('player_damaged', msg);
        break;

      case 'player_killed':
        this.emit('player_killed', msg);
        break;

      case 'player_respawn':
        this.emit('player_respawn', msg);
        break;

      case 'player_left':
        this.emit('player_left', msg);
        break;

      case 'pong':
        this.ping = Math.max(1, Date.now() - msg.clientTime);
        this.emit('pong', { ping: this.ping });
        break;

      default:
        break;
    }
  }

  // Tiện ích gửi trạng thái vị trí (State sync)
  sendState(state) {
    this.send({
      type: 'state',
      ...state,
    });
  }

  // Tiện ích gửi đòn kiếm: attack = { kind: 'slash', step } (nhát combo 0-2) hoặc { kind: 'qi', power } (lực tụ 0-1)
  sendShoot(origin, direction, attack = {}) {
    this.send({
      type: 'shoot',
      origin: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
      kind: attack.kind || 'slash',
      step: attack.step || 0,
      power: attack.power || 0,
    });
  }

  // Tiện ích gửi kỹ năng đạo pháp
  sendSkill(skillIndex, targetPos) {
    this.send({
      type: 'skill',
      skillIndex,
      targetPos: { x: targetPos.x, y: targetPos.y, z: targetPos.z },
    });
  }

  // Tiện ích gửi phát trúng mục tiêu (PvP Hit)
  sendHit(targetId, damage, hitPos, source = 'blaster') {
    this.send({
      type: 'hit',
      targetId,
      damage,
      hitPos: hitPos ? { x: hitPos.x, y: hitPos.y, z: hitPos.z } : null,
      source,
    });
  }
}
