import * as THREE from 'three';
import { World } from './world.js';
import { Character } from './character.js';
import { ParticleSystem } from './particles.js';
import { ThirdPersonController } from './controller.js';
import { ProjectileSystem } from './projectiles.js';
import { Monster } from './monsters.js';
import { PixelFXManager } from './pixelfx.js';
import { sound } from './audio.js';
import { MobileControlsManager } from './mobileControls.js';
import { loadSwordModel } from './sword.js';
import { loadDragonModel } from './dragon.js';
import { NetworkManager } from './network.js';
import { RemotePlayer } from './remotePlayer.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.clock = new THREE.Clock();
    this.monstersDefeated = 0;
    this.prevCooldowns = {};

    // Khí Huyết, Linh Lực & Cảnh Giới Tu Vi (2000 Máu)
    this.playerHp = 2000;
    this.playerMaxHp = 2000;
    this.playerMp = 100;
    this.playerMaxMp = 100;
    this.currentRealm = '🌟 Luyện Khí Tầng 1';

    // Multiplayer PvP
    this.network = new NetworkManager();
    this.remotePlayers = new Map(); // id -> RemotePlayer
    this.playerStats = new Map(); // id -> { id, name, kills, deaths, hp, maxHp }
    this.networkSendTimer = 0;
    this.isOnline = false;
    this.respawnCountdownInterval = null;
    this.selectedOutfitIndex = 0;

    this.initScene();
    this.initLights();
    this.initGameEntities();
    this.initMultiplayerHandlers();
    this.initUI();

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();

    // Sương mù Tiên Khí Kinh Thành cổ kính
    const skyColor = new THREE.Color(0xdcebf8);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.Fog(skyColor, 75, 275);

    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      450
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
  }

  initLights() {
    // 1. Ánh sáng bầu trời phương Đông & phản xạ mặt đá kinh thành
    const hemiLight = new THREE.HemisphereLight(0xfff5e6, 0x475569, 0.95);
    this.scene.add(hemiLight);

    // 2. Thái Dương Hoàng Kim chiếu rọi góc nghiêng tạo bóng đổ điện ảnh sắc nét
    this.sunLight = new THREE.DirectionalLight(0xffeedb, 1.65);
    this.sunLight.position.set(42, 54, 32);
    this.sunLight.castShadow = true;

    // Tối ưu hóa bộ nhớ shadow map (1024x1024) & bán kính lọc mềm nhẹ mượt
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 170;

    const d = 40;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 0.024;
    this.sunLight.shadow.radius = 1.0;

    this.scene.add(this.sunLight);

    // 3. Nguồn sáng ngược sắc lam (Sky Rim Fill Light) tạo độ sâu thị giác
    this.skyRimLight = new THREE.DirectionalLight(0x74b9ff, 0.48);
    this.skyRimLight.position.set(-36, 28, -32);
    this.scene.add(this.skyRimLight);

    // 4. Ánh sáng môi trường tổng thể
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.28);
    this.scene.add(ambientLight);
  }

  initGameEntities() {
    // 1. Hệ thống hạt bụi, tia kiếm khí và sóng chấn động
    this.particles = new ParticleSystem(this.scene);

    // 2. Thế giới Kinh Thành Trung Hoa Cổ (Trường An Cổ Đô, Đại Lộ Chu Tước, Tửu Lầu, Đại Điện)
    this.world = new World(this.scene, this.particles);

    // 3. Nhân vật Bé Gấu Tu Tiên mang hồ lô và pháp bảo
    this.character = new Character(this.scene, this.particles);
    loadSwordModel(); // Nạp tiên kiếm GLB nếu có, kiếm trên tay & kiếm chiêu tự đổi theo
    loadDragonModel(); // Nạp thần long GLB nếu có cho chiêu Chân Long Bảo Thuật

    // 4. Hệ thống chém kiếm & kiếm khí có vệt sáng & tương tác vật thể
    this.projectiles = new ProjectileSystem(this.scene, this.particles, this.world);

    // 5. Yêu Ma quấy nhiễu các phường thị Kinh Thành Cổ
    this.monsters = [
      new Monster(this.scene, this.particles, 'golem', new THREE.Vector3(0, 0, 18), this.world),       // Trước Đại Điện Cung Đình
      new Monster(this.scene, this.particles, 'golem', new THREE.Vector3(-65, 0, 45), this.world),     // Sân Thiên Kiếm Võ Quán (Tây Bắc)
      new Monster(this.scene, this.particles, 'golem', new THREE.Vector3(70, 0, 45), this.world),      // Khuôn viên Thanh Vân Thư Viện (Đông Bắc)
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(-10, 0, -22), this.world),   // Phố Chợ Cổ Trung Tâm
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(12, 0, -4), this.world),     // Bờ Kênh Trà Quán
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(-24, 0, 10), this.world),    // Trước Tửu Lầu Nguyệt Lai
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(-55, 0, -65), this.world),   // Phố Rèn & Binh Khí (Tây Nam)
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(60, 0, -65), this.world),    // Khu Tơ Lụa & Dược Điếm (Đông Nam)
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(0, 0, -95), this.world),     // Nam Thành Chu Tước Môn
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(0, 0, 95), this.world),      // Bắc Thành Huyền Vũ Môn
    ];

    for (const monster of this.monsters) {
      monster.onDefeated = (m) => {
        this.monstersDefeated++;
        if (this.killBadge) {
          this.killBadge.textContent = `🎯 Trảm Yêu: ${this.monstersDefeated}`;
        }

        // Hồi phục 25 Linh lực khi hấp thụ Linh Phách yêu ma
        this.playerMp = Math.min(this.playerMaxMp, this.playerMp + 25);

        const name = m.type === 'golem' ? 'Thái Cổ Thạch Yêu' : 'Hắc Diễm Linh Thú';
        this.showNotification(`⚔️ Đã trảm sát ${name}! Hấp thụ Linh Phách (+25 Linh Lực)`);

        this.checkRealmBreakthrough();
      };
    }

    // 6. Hệ thống Kỹ Năng Đạo Pháp PixelFX
    this.pixelFX = new PixelFXManager(this.scene, this.world, this.particles);
    this.pixelFX.remotePlayers = [];
    this.pixelFX.onHitPlayer = (targetId, dmg, hitPos, source) => this.handleHitPlayer(targetId, dmg, hitPos, source);
    this.pixelFX.localCharacter = this.character;

    // 7. Bộ điều khiển góc nhìn thứ 3 tích hợp Rung lắc Camera (Trauma Shake)
    this.controller = new ThirdPersonController(
      this.camera,
      this.character,
      this.canvas,
      (origin, attackDir, comboStep) => {
        this.projectiles.slash(
          origin, attackDir, this.monsters, comboStep === 2 ? 'thrust' : 'sweep',
          this.pixelFX.remotePlayers, (targetId, dmg, pos, source) => this.handleHitPlayer(targetId, dmg, pos, source)
        );
        if (this.network.isConnected) {
          this.network.sendShoot(origin, attackDir, { kind: 'slash', step: comboStep });
        }
      },
      (skillNum, targetPos) => {
        // Chỉ hỗ trợ 3 kỹ năng độc nhất theo từng môn phái (1, 2, 3)
        if (skillNum < 1 || skillNum > 3) return false;

        // Kiểm tra hồi chiêu
        if (this.pixelFX.isSkillOnCooldown(skillNum)) {
          const cd = this.pixelFX.cooldowns[skillNum]?.current?.toFixed(1) || '0';
          this.showNotification(`⏳ Đang hồi chiêu (${cd}s)...`);
          return false;
        }

        const skillMeta = this.pixelFX.cooldowns[skillNum];
        const cost = skillMeta?.mana || 0;

        // Kiểm tra tiêu hao Linh Lực (Mana)
        if (cost > 0 && this.playerMp < cost) {
          this.showNotification(`⚠️ Linh lực không đủ (${Math.floor(this.playerMp)}/${cost})! Tĩnh tâm hồi khí...`);
          return false;
        }

        const success = this.pixelFX.castSkill(skillNum, targetPos, this.character, this.monsters);
        if (success) {
          if (cost > 0) {
            this.playerMp -= cost;
          }

          if (this.network.isConnected) {
            this.network.sendSkill(skillNum, targetPos);
          }

          const skillName = skillMeta ? `${skillMeta.name} ${skillMeta.icon}` : 'Kỹ Năng';
          this.showNotification(`Thi triển [${skillName}]!${cost > 0 ? ` (-${cost} Linh Lực)` : ''}`);
        }
        return success;
      }
    );

    this.pixelFX.controller = this.controller;

    // Giữ chuột trái tụ lực rồi thả: phóng kiếm khí
    this.controller.onChargedRelease = (origin, attackDir, power) => {
      const qiOrigin = origin.clone().addScaledVector(attackDir, 0.6);
      this.projectiles.spawnSwordQi(qiOrigin, attackDir, power, true);
      if (this.network.isConnected) {
        this.network.sendShoot(qiOrigin, attackDir, { kind: 'qi', power });
      }
      if (power >= 1) {
        this.showNotification('⚔️ Kiếm khí đại thành! Xuyên phá vạn vật!');
      }
    };
    this.pixelFX.onScreenFlash = (type) => this.triggerScreenFlash(type);

    this.controller.onOutfitChange = (outfitName) => {
      this.pixelFX.setSect(this.character.outfitIndex);
      this.showNotification(`Đã hoán đổi môn phái: ${outfitName}`);
    };

    this.controller.onLockChange = (isLocked) => {
      const lockHint = document.getElementById('lock-hint');
      if (lockHint) {
        if (isLocked) {
          lockHint.classList.add('hidden');
        } else {
          lockHint.classList.remove('hidden');
        }
      }
    };
  }

  // Đột phá Cảnh Giới Tu Vi theo chiến tích
  checkRealmBreakthrough() {
    let newRealm = '🌟 Luyện Khí Tầng 1';
    if (this.monstersDefeated >= 8) newRealm = '⚡ Hóa Thần Tiên Tôn 👑';
    else if (this.monstersDefeated >= 5) newRealm = '✨ Nguyên Anh Chân Nhân';
    else if (this.monstersDefeated >= 3) newRealm = '🔥 Kim Đan Đại Đạo';
    else if (this.monstersDefeated >= 2) newRealm = '🌿 Trúc Cơ Kỳ';
    else if (this.monstersDefeated >= 1) newRealm = '🌱 Luyện Khí Viên Mãn';

    if (newRealm !== this.currentRealm) {
      this.currentRealm = newRealm;
      if (this.realmBadge) {
        this.realmBadge.textContent = newRealm;
      }
      this.triggerScreenFlash('sword');
      this.showNotification(`🎉 CHÚC MỪNG ĐẠO HỮU ĐỘT PHÁ CẢNH GIỚI: [${newRealm}]!`);
    }
  }

  handleHitPlayer(targetId, dmg, hitPos, source = 'blaster') {
    if (this.network.isConnected) {
      this.network.sendHit(targetId, dmg, hitPos, source);
    }
  }

  initMultiplayerHandlers() {
    this.network.on('connected', () => {
      this.isOnline = true;
      if (this.onlineBadge) {
        this.onlineBadge.textContent = '🟢 Online: Đã kết nối';
        this.onlineBadge.style.color = '#2ed573';
      }
      this.showNotification('🌐 Đã kết nối thành công tới Đấu Trường Online!');
    });

    this.network.on('disconnected', () => {
      this.isOnline = false;
      if (this.onlineBadge) {
        this.onlineBadge.textContent = '🔴 Offline: Mất kết nối';
        this.onlineBadge.style.color = '#ff4757';
      }
      this.showNotification('⚠️ Đã ngắt kết nối với máy chủ online.');
    });

    this.network.on('init', (data) => {
      if (data.spawn) {
        this.character.position.set(data.spawn.x, data.spawn.y || 0, data.spawn.z);
        this.character.group.position.copy(this.character.position);
      }
      this.character.hp = data.hp || 2000;
      this.character.maxHp = data.maxHp || 2000;
      this.playerHp = this.character.hp;
      this.playerMaxHp = this.character.maxHp;
      this.character.updateBillboard();

      this.playerStats.set(this.network.selfId, {
        id: this.network.selfId,
        name: this.character.name,
        kills: 0,
        deaths: 0,
        hp: this.playerHp,
        maxHp: this.playerMaxHp,
      });

      if (data.players && Array.isArray(data.players)) {
        for (const p of data.players) {
          this.addRemotePlayer(p);
        }
      }

      this.updateOnlineBadge();
      this.updateLeaderboard();
    });

    this.network.on('player_joined', (p) => {
      this.addRemotePlayer(p);
      this.showNotification(`🌟 Đạo hữu [${p.name}] giáng lâm Trường An!`);
      this.updateOnlineBadge();
      this.updateLeaderboard();
    });

    this.network.on('player_state', (state) => {
      const rp = this.remotePlayers.get(state.id);
      if (rp) {
        rp.updateState(state);
      }
    });

    this.network.on('player_shoot', (msg) => {
      // Đòn kiếm của người chơi khác: dựng lại hiệu ứng (đánh quái trên máy mình), không báo sát thương PvP
      const rp = this.remotePlayers.get(msg.id);
      const origin = new THREE.Vector3(msg.origin.x, msg.origin.y, msg.origin.z);
      const dir = new THREE.Vector3(msg.direction.x, msg.direction.y, msg.direction.z);
      if (rp) {
        rp.triggerSlash(Math.atan2(dir.x, dir.z), msg.kind === 'qi' ? 0 : (msg.step || 0));
      }
      if (msg.kind === 'qi') {
        this.projectiles.spawnSwordQi(origin, dir, msg.power || 0, false);
      } else {
        this.projectiles.slash(origin, dir, this.monsters, msg.step === 2 ? 'thrust' : 'sweep');
      }
      sound.playSwordSlash();
    });

    this.network.on('player_skill', (msg) => {
      const rp = this.remotePlayers.get(msg.id);
      const targetPos = new THREE.Vector3(msg.targetPos.x, msg.targetPos.y, msg.targetPos.z);
      if (rp) {
        this.pixelFX.castSkill(msg.skillIndex, targetPos, rp, this.monsters);
      }
    });

    this.network.on('player_damaged', (msg) => {
      if (msg.targetId === this.network.selfId) {
        const hitPos = msg.hitPos ? new THREE.Vector3(msg.hitPos.x, msg.hitPos.y, msg.hitPos.z) : null;
        this.character.takeDamage(msg.damage, msg.attackerId, hitPos);
        this.playerHp = msg.hp;
        this.controller.addTrauma(0.28);
        this.triggerScreenFlash('fire');

        const selfStat = this.playerStats.get(this.network.selfId);
        if (selfStat) selfStat.hp = msg.hp;
      } else {
        const rp = this.remotePlayers.get(msg.targetId);
        if (rp) {
          const hitPos = msg.hitPos ? new THREE.Vector3(msg.hitPos.x, msg.hitPos.y, msg.hitPos.z) : null;
          rp.takeDamage(msg.damage, hitPos);
          const stat = this.playerStats.get(msg.targetId);
          if (stat) stat.hp = msg.hp;
        }
      }
      this.updateLeaderboard();
    });

    this.network.on('player_killed', (msg) => {
      const isKillerSelf = msg.killerId === this.network.selfId;
      const isVictimSelf = msg.victimId === this.network.selfId;

      this.addKillFeed(msg.killerName, msg.victimName, isKillerSelf, isVictimSelf);

      const killerStat = this.playerStats.get(msg.killerId);
      if (killerStat) killerStat.kills = msg.killerKills;
      const victimStat = this.playerStats.get(msg.victimId);
      if (victimStat) {
        victimStat.deaths = msg.victimDeaths;
        victimStat.hp = 0;
      }

      if (isVictimSelf) {
        this.character.isDead = true;
        this.character.hp = 0;
        this.playerHp = 0;
        this.showRespawnScreen(msg.killerName, 4.5);
      } else {
        const rp = this.remotePlayers.get(msg.victimId);
        if (rp) {
          rp.setDead(true);
        }
      }

      if (isKillerSelf) {
        this.showNotification(`⚔️ Bạn đã trảm sát [${msg.victimName}]! (+1 Chiến Công)`);
      }

      this.updateLeaderboard();
    });

    this.network.on('player_respawn', (msg) => {
      if (msg.id === this.network.selfId) {
        this.character.respawn(msg.spawn);
        this.playerHp = msg.hp;
        this.hideRespawnScreen();
        this.showNotification('✨ Đã trùng sinh tại vị trí an toàn!');
        const selfStat = this.playerStats.get(this.network.selfId);
        if (selfStat) selfStat.hp = msg.hp;
      } else {
        const rp = this.remotePlayers.get(msg.id);
        if (rp) {
          rp.respawn(msg.spawn, msg.hp, msg.maxHp);
          const stat = this.playerStats.get(msg.id);
          if (stat) stat.hp = msg.hp;
        }
      }
      this.updateLeaderboard();
    });

    this.network.on('player_left', (msg) => {
      const rp = this.remotePlayers.get(msg.id);
      if (rp) {
        rp.destroy();
        this.remotePlayers.delete(msg.id);
        this.playerStats.delete(msg.id);
        this.showNotification(`Đạo hữu [${msg.name}] đã rời Cổ Đô.`);
        this.updateOnlineBadge();
        this.updateLeaderboard();
      }
    });

    this.network.on('pong', ({ ping }) => {
      if (this.pingBadge) {
        this.pingBadge.textContent = `📶 ${ping}ms`;
        this.pingBadge.style.color = ping < 80 ? '#2ed573' : (ping < 180 ? '#ffa502' : '#ff4757');
      }
    });
  }

  addRemotePlayer(data) {
    if (this.remotePlayers.has(data.id)) return;
    const rp = new RemotePlayer(this.scene, this.particles, data);
    this.remotePlayers.set(data.id, rp);
    this.playerStats.set(data.id, {
      id: data.id,
      name: data.name,
      kills: data.kills || 0,
      deaths: data.deaths || 0,
      hp: data.hp !== undefined ? data.hp : 2000,
      maxHp: data.maxHp || 2000,
    });
  }

  updateOnlineBadge() {
    if (this.onlineBadge) {
      const count = (this.remotePlayers ? this.remotePlayers.size : 0) + 1;
      this.onlineBadge.textContent = `🌐 Online: ${count} người`;
      this.onlineBadge.style.color = '#2ed573';
    }
  }

  addKillFeed(killer, victim, isKillerSelf, isVictimSelf) {
    const feed = document.getElementById('kill-feed');
    if (!feed) return;
    const item = document.createElement('div');
    item.className = 'kill-feed-item';
    if (isKillerSelf) item.classList.add('self-kill');
    if (isVictimSelf) item.classList.add('self-victim');
    item.innerHTML = `<strong>${killer}</strong> ⚔️ <em>${victim}</em>`;
    feed.appendChild(item);

    setTimeout(() => {
      if (item.parentNode) item.parentNode.removeChild(item);
    }, 5000);
  }

  showRespawnScreen(killerName, durationSeconds) {
    const screen = document.getElementById('respawn-screen');
    const killerEl = document.getElementById('respawn-killer-text');
    const timerEl = document.getElementById('respawn-timer-text');
    if (!screen) return;

    if (killerEl) {
      killerEl.textContent = `Bị hạ gục bởi: ${killerName}`;
    }
    screen.classList.add('show');

    let remaining = durationSeconds;
    if (timerEl) timerEl.textContent = `${remaining.toFixed(1)}s`;

    clearInterval(this.respawnCountdownInterval);
    this.respawnCountdownInterval = setInterval(() => {
      remaining -= 0.1;
      if (timerEl) {
        timerEl.textContent = `${Math.max(0, remaining).toFixed(1)}s`;
      }
      if (remaining <= 0) {
        clearInterval(this.respawnCountdownInterval);
      }
    }, 100);
  }

  hideRespawnScreen() {
    clearInterval(this.respawnCountdownInterval);
    const screen = document.getElementById('respawn-screen');
    if (screen) screen.classList.remove('show');
  }

  updateLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');
    if (!tbody) return;

    const list = Array.from(this.playerStats.values()).sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      return a.deaths - b.deaths;
    });

    let html = '';
    list.forEach((p, index) => {
      const isSelf = p.id === (this.network.selfId || 'self');
      const rowClass = isSelf ? 'self-row' : '';
      const medal = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : `#${index + 1}`));
      html += `
        <tr class="${rowClass}">
          <td>${medal}</td>
          <td>${p.name} ${isSelf ? '(Bạn)' : ''}</td>
          <td style="color: #2ed573; font-weight: bold;">${p.kills}</td>
          <td style="color: #ff4757;">${p.deaths}</td>
          <td style="color: #00d2d3;">${Math.round(p.hp)}/${p.maxHp}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  triggerScreenFlash(type) {
    const flashEl = document.getElementById('screen-flash');
    if (!flashEl) return;
    flashEl.className = '';
    void flashEl.offsetWidth; // Buộc trình duyệt reflow CSS
    flashEl.classList.add(`flash-${type}`);
    setTimeout(() => {
      flashEl.className = '';
    }, 450);
  }

  initUI() {
    const enableAudio = () => {
      sound.init();
      sound.startBGM();
      window.removeEventListener('click', enableAudio);
      window.removeEventListener('keydown', enableAudio);
    };
    window.addEventListener('click', enableAudio);
    window.addEventListener('keydown', enableAudio);

    const lockHint = document.getElementById('lock-hint');
    if (lockHint) {
      lockHint.addEventListener('click', () => {
        this.controller.requestLock();
      });
    }

    // Nút Bắn ảo
    const shootBtn = document.getElementById('btn-shoot');
    if (shootBtn) {
      shootBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.controller.triggerShoot();
      });
    }

    // Nút Âm thanh
    const soundBtn = document.getElementById('btn-sound');
    if (soundBtn) {
      soundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.init();
        const isMuted = sound.toggleMute();
        soundBtn.innerHTML = isMuted ? '🔇 Linh Âm: Tắt' : '🔊 Linh Âm: Bật';
        soundBtn.classList.toggle('active', !isMuted);
      });
    }

    // Nút Đổi trang phục
    const outfitBtn = document.getElementById('btn-outfit');
    if (outfitBtn) {
      outfitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = this.character.cycleOutfit();
        this.showNotification(`Đã hoán đổi tiên bào: ${name}`);
      });
    }

    // Nút Nhảy
    const jumpBtn = document.getElementById('btn-jump');
    if (jumpBtn) {
      jumpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.character.jump();
      });
    }

    // Nút Chụp ảnh lưu niệm
    const photoBtn = document.getElementById('btn-photo');
    if (photoBtn) {
      photoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.takeScreenshot();
      });
    }

    // Nút Toàn màn hình
    const fsBtn = document.getElementById('btn-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // Khởi tạo Hệ thống Điều Khiển Cảm Ứng Di Động (Mobile Controls)
    this.mobileControls = new MobileControlsManager(
      this,
      this.controller,
      this.character,
      this.pixelFX
    );
    this.controller.isMobileActive = this.mobileControls.isEnabled;

    // Nút Bật/Tắt Phím Ảo Mobile trên thanh công cụ
    const mobileToggleBtn = document.getElementById('btn-mobile-toggle');
    if (mobileToggleBtn) {
      mobileToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newState = this.mobileControls.toggle();
        this.controller.isMobileActive = newState;
        this.showNotification(
          newState ? '📱 Đã kích hoạt [Giao Diện Mobile Ảo]!' : '💻 Đã chuyển sang [Chế Độ Bàn Phím/Chuột]'
        );
      });
    }

    // Gắn sự kiện click cho 3 ô kỹ năng môn phái trên HUD
    for (let i = 1; i <= 3; i++) {
      const slot = document.getElementById(`skill-slot-${i}`);
      if (slot) {
        slot.addEventListener('click', (e) => {
          e.stopPropagation();
          this.controller.triggerSkill(i);
        });
      }
    }

    // Khi môn phái thay đổi: cập nhật giao diện 3 ô kỹ năng và nhãn môn phái
    this.pixelFX.onSectChange = (sect) => {
      const sectTag = document.getElementById('hud-sect-name');
      if (sectTag) {
        sectTag.textContent = `${sect.icon} ${sect.name}`;
      }
      for (let i = 1; i <= 3; i++) {
        const skill = sect.skills[i - 1];
        if (!skill) continue;
        const slot = document.getElementById(`skill-slot-${i}`);
        if (slot) {
          slot.title = `Phím ${i}: ${skill.name} ${skill.icon} (${skill.mana > 0 ? `-${skill.mana} Linh Lực, ` : ''}${skill.desc})`;
          const tagEl = slot.querySelector('.skill-talisman-tag');
          if (tagEl) tagEl.textContent = skill.tag;
          const iconEl = slot.querySelector('.skill-icon');
          if (iconEl) iconEl.textContent = skill.icon;
          const nameEl = slot.querySelector('.skill-name');
          if (nameEl) nameEl.textContent = skill.name;
        }
      }
    };

    // Thiết lập môn phái ban đầu cho hệ thống hiệu ứng
    this.pixelFX.setSect(this.character.outfitIndex);

    // Cập nhật Cooldown trực quan trên thanh kỹ năng HUD
    this.pixelFX.onCooldownUpdate = (cds) => {
      for (const key in cds) {
        const cd = cds[key];
        const prev = this.prevCooldowns[key] || 0;
        const slot = document.getElementById(`skill-slot-${key}`);
        const cdOverlay = document.getElementById(`skill-cd-${key}`);
        const cdText = document.getElementById(`skill-text-${key}`);

        if (slot && cdOverlay && cdText) {
          if (cd.current > 0) {
            slot.classList.add('on-cooldown');
            const ratio = cd.current / cd.max;
            cdOverlay.style.height = `${ratio * 100}%`;
            cdText.textContent = cd.current.toFixed(1) + 's';
          } else {
            slot.classList.remove('on-cooldown');
            cdOverlay.style.height = '0%';
            cdText.textContent = key;

            // Hiệu ứng lóe sáng khi kỹ năng vừa hồi xong
            if (prev > 0) {
              slot.classList.add('skill-ready-flash');
              setTimeout(() => slot.classList.remove('skill-ready-flash'), 500);
            }
          }
        }
        this.prevCooldowns[key] = cd.current;
      }
    };

    // HUD Elements
    this.speedBadge = document.getElementById('hud-speed');
    this.stateBadge = document.getElementById('hud-state');
    this.killBadge = document.getElementById('hud-kills');
    this.realmBadge = document.getElementById('hud-realm');
    this.onlineBadge = document.getElementById('hud-online');
    this.pingBadge = document.getElementById('hud-ping');
    this.fpsBadge = document.getElementById('hud-fps');
    this.fps = 60;

    this.barHp = document.getElementById('bar-hp');
    this.textHp = document.getElementById('text-hp');
    this.barMp = document.getElementById('bar-mp');
    this.textMp = document.getElementById('text-mp');

    // --- MODAL ĐĂNG NHẬP MULTIPLAYER ---
    const loginModal = document.getElementById('login-modal');
    const nameInput = document.getElementById('input-player-name');
    const serverInput = document.getElementById('input-server-url');
    const btnJoinOnline = document.getElementById('btn-join-online');
    const btnPlayOffline = document.getElementById('btn-play-offline');
    const outfitCards = document.querySelectorAll('.outfit-card');

    const savedName = localStorage.getItem('playerName') || 'Hiệp Sĩ Bé Gấu';
    if (nameInput) nameInput.value = savedName;

    const defaultServerUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname || 'localhost'}:3000`;
    if (serverInput) serverInput.value = defaultServerUrl;

    outfitCards.forEach((card) => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        outfitCards.forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedOutfitIndex = parseInt(card.dataset.index, 10) || 0;
        this.character.setOutfit(this.selectedOutfitIndex);
        this.pixelFX.setSect(this.selectedOutfitIndex);
      });
    });

    const enterGame = async (isOnlineMode) => {
      const name = (nameInput.value || 'Gấu Hiệp Sĩ').trim().substring(0, 18);
      localStorage.setItem('playerName', name);
      this.character.setName(name);
      this.character.setOutfit(this.selectedOutfitIndex);
      this.pixelFX.setSect(this.selectedOutfitIndex);

      if (loginModal) loginModal.style.display = 'none';

      if (isOnlineMode) {
        const url = (serverInput.value || defaultServerUrl).trim();
        if (this.onlineBadge) this.onlineBadge.textContent = '🌐 Đang kết nối...';
        try {
          await this.network.connect(url, { name, outfit: this.selectedOutfitIndex });
        } catch (err) {
          console.warn('Cannot connect to multiplayer server, running in offline mode:', err);
          this.showNotification('⚠️ Không thể kết nối server, đang chơi chế độ Đơn!');
          if (this.onlineBadge) {
            this.onlineBadge.textContent = '🔴 Offline';
            this.onlineBadge.style.color = '#ff4757';
          }
        }
      } else {
        if (this.onlineBadge) {
          this.onlineBadge.textContent = '🗡️ Chế độ Chơi Đơn';
          this.onlineBadge.style.color = '#70a1ff';
        }
      }

      this.controller.requestLock();
    };

    if (btnJoinOnline) {
      btnJoinOnline.addEventListener('click', (e) => {
        e.stopPropagation();
        enterGame(true);
      });
    }

    if (btnPlayOffline) {
      btnPlayOffline.addEventListener('click', (e) => {
        e.stopPropagation();
        enterGame(false);
      });
    }

    if (nameInput) {
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          enterGame(true);
        }
      });
    }

    // --- LEADERBOARD TOGGLE ---
    const leaderboardModal = document.getElementById('leaderboard-modal');
    const btnLeaderboard = document.getElementById('btn-leaderboard');
    const btnCloseLeaderboard = document.getElementById('btn-close-leaderboard');

    const toggleLeaderboard = (show) => {
      if (!leaderboardModal) return;
      const willShow = show !== undefined ? show : !leaderboardModal.classList.contains('show');
      if (willShow) {
        this.updateLeaderboard();
        leaderboardModal.classList.add('show');
      } else {
        leaderboardModal.classList.remove('show');
      }
    };

    if (btnLeaderboard) {
      btnLeaderboard.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLeaderboard();
      });
    }
    if (btnCloseLeaderboard) {
      btnCloseLeaderboard.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLeaderboard(false);
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        toggleLeaderboard();
      }
    });
  }

  showNotification(msg) {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        toast.classList.remove('show');
      }, 2800);
    }
  }

  takeScreenshot() {
    this.renderer.render(this.scene, this.camera);
    const dataURL = this.canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'thanh-van-tien-gioi.png';
    link.href = dataURL;
    link.click();
    this.showNotification('📸 Đã ghi lại Tiên Ảnh vào bảo khố!');
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    // Hồi phục Linh Lực tự nhiên (8 linh lực / giây)
    this.playerMp = Math.min(this.playerMaxMp, this.playerMp + delta * 8.0);
    this.playerHp = this.character.hp;
    this.playerMaxHp = this.character.maxHp;

    // Cập nhật thanh Khí Huyết & Linh Lực trên HUD
    if (this.barHp && this.textHp) {
      const hpRatio = Math.max(0, this.playerHp / this.playerMaxHp);
      this.barHp.style.width = `${hpRatio * 100}%`;
      this.textHp.textContent = `${Math.round(this.playerHp)}/${this.playerMaxHp}`;
    }
    if (this.barMp && this.textMp) {
      const mpRatio = Math.max(0, this.playerMp / this.playerMaxMp);
      this.barMp.style.width = `${mpRatio * 100}%`;
      this.textMp.textContent = `${Math.round(this.playerMp)}/${this.playerMaxMp}`;
    }

    // Gửi đồng bộ vị trí lên server (Network State Sync ~22 Hz)
    if (this.network.isConnected && !this.character.isDead) {
      this.networkSendTimer += delta;
      if (this.networkSendTimer >= 0.045) {
        this.networkSendTimer = 0;
        this.network.sendState({
          x: this.character.position.x,
          y: this.character.position.y,
          z: this.character.position.z,
          rotY: this.character.rotationY,
          isMoving: this.character.isMoving,
          isSprinting: this.character.isSprinting,
          isGrounded: this.character.isGrounded,
          isCasting: this.character.isCasting,
          castSkill: this.character.castSkill,
        });
      }
    }

    // 1. Cập nhật nhân vật & điều khiển
    this.controller.update(delta);

    // Cập nhật danh sách người chơi khác (Remote Players)
    const rpList = Array.from(this.remotePlayers.values());
    this.pixelFX.remotePlayers = rpList;
    for (const rp of rpList) {
      rp.update(delta);
    }

    // 2. Cập nhật đạn và va chạm với người chơi khác + quái vật
    this.projectiles.update(delta, this.monsters, rpList, (targetId, dmg, pos, source) => this.handleHitPlayer(targetId, dmg, pos, source));

    // 3. Cập nhật kỹ năng PixelFX & tàn phá địa hình
    this.pixelFX.update(delta);

    // 4. Cập nhật AI quái vật khổng lồ
    for (const monster of this.monsters) {
      monster.update(delta, this.character.position, this.camera);
    }

    // 5. Di chuyển ánh nắng mặt trời theo nhân vật
    this.sunLight.position.x = this.character.position.x + 35;
    this.sunLight.position.z = this.character.position.z + 30;
    this.sunLight.target.position.copy(this.character.position);
    this.sunLight.target.updateMatrixWorld();

    // 6. Cập nhật thế giới và hiệu ứng
    this.world.update(delta, elapsedTime);
    this.particles.update(delta, this.character.position);

    // 7. Cập nhật HUD & Giám sát FPS thời gian thực
    if (this.fpsBadge) {
      this.fps = THREE.MathUtils.lerp(this.fps, 1 / Math.max(delta, 0.001), 0.06);
      const rounded = Math.round(this.fps);
      this.fpsBadge.textContent = `⚡ ${rounded} FPS`;
      this.fpsBadge.style.color = rounded >= 55 ? '#2ed573' : (rounded >= 35 ? '#ffa502' : '#ff4757');
    }
    if (this.speedBadge) {
      const spdKmh = (this.character.speed * 2.2).toFixed(1);
      this.speedBadge.textContent = `${spdKmh} km/h`;
    }
    if (this.stateBadge) {
      let state = 'Đang Tĩnh Tọa (Idle)';
      if (this.character.isCharging) {
        const pct = Math.round(this.character.chargeLevel * 100);
        state = pct >= 100 ? 'Kiếm Khí Đại Thành! ⚔️' : `Tụ Kiếm Khí ${pct}% ⚔️`;
      } else if (!this.character.isGrounded) {
        state = 'Đạp Vân Phi Hành 🦘';
      } else if (this.character.isCasting) {
        const curSkill = this.pixelFX.cooldowns[this.character.castSkill];
        const skillTitle = curSkill ? `${curSkill.name} ${curSkill.icon}` : 'Thần Thông';
        state = `Thi triển ${skillTitle} ✨`;
      } else if (this.character.isMoving) {
        state = this.character.isSprinting ? 'Súc Địa Thành Thốn! ⚡' : 'Ngự Phong Hành 🚶';
      }
      this.stateBadge.textContent = state;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
