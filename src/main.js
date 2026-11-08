import * as THREE from 'three';
import { World } from './world.js';
import { Character, SECT_STATS } from './character.js';
import { ParticleSystem } from './particles.js';
import { ThirdPersonController } from './controller.js';
import { ProjectileSystem } from './projectiles.js';
import { Monster, MONSTER_CONFIGS } from './monsters.js';
import { BOSS_ORDER } from './bosses.js';
import { PixelFXManager } from './pixelfx.js';
import { sound } from './audio.js';
import { MobileControlsManager } from './mobileControls.js';
import { loadSwordModel } from './sword.js';
import { NetworkManager } from './network.js';
import { RemotePlayer } from './remotePlayer.js';
import { CloneManager } from './clones.js';
import { AutoFarm } from './autoFarm.js';

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
    window.addEventListener('orientationchange', () => setTimeout(() => this.onResize(), 150));
    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', () => setTimeout(() => this.onResize(), 150));
    }
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
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
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

    // 4. Hệ thống chém kiếm & kiếm khí có vệt sáng & tương tác vật thể
    this.projectiles = new ProjectileSystem(this.scene, this.particles, this.world);

    // 5. Chế độ chơi: 'pvp' (không có quái) hoặc 'pve' (có quái)
    this.gameMode = 'pvp';

    // Đại Boss giáng thế sau khi trảm đủ số yêu; khi đấu Boss chỉ còn người chơi & Boss
    this.bossKillsNeeded = 20;
    this.bossCycle = 0;      // Boss thứ mấy sẽ giáng thế tiếp theo (luân phiên 10 Boss)
    this.currentBoss = null;
    try {
      // Tham số thử nghiệm: ?bossKills=3 để gọi Boss nhanh khi kiểm tra
      const q = parseInt(new URLSearchParams(window.location.search).get('bossKills'), 10);
      if (q > 0 && q <= 100) this.bossKillsNeeded = q;
      if (new URLSearchParams(window.location.search).has('debug')) window.__game = this;
      // Tham số thử nghiệm: ?boss=3 để Boss đầu tiên là Boss số 3 (1-10)
      const b = parseInt(new URLSearchParams(window.location.search).get('boss'), 10);
      if (b >= 1 && b <= 10) this.bossCycle = b - 1;
    } catch (err) {}
    this.bossProgress = 0;
    this.bossActive = false;
    this.monsters = [];

    // 6. Hệ thống Kỹ Năng Đạo Pháp PixelFX
    this.pixelFX = new PixelFXManager(this.scene, this.world, this.particles);
    this.pixelFX.remotePlayers = [];
    this.pixelFX.projectiles = this.projectiles;
    this.pixelFX.monsters = this.monsters;
    this.pixelFX.onHitPlayer = (targetId, dmg, hitPos, source, isCounter, isBackstab) => this.handleHitPlayer(targetId, dmg, hitPos, source, isCounter, isBackstab);
    this.pixelFX.localCharacter = this.character;

    this.character.pixelFX = this.pixelFX;

    // Đạo ảnh phân thân (Nhất Khí Hóa Tam Thanh): đòn kiếm khí của đạo ảnh cũng gửi qua mạng để máy khác thấy
    this.clones = new CloneManager(this.scene, this.particles, this.projectiles);
    this.clones.pixelFX = this.pixelFX;
    this.clones.onAttack = (index, origin, dir, attack) => {
      if (this.network.isConnected) {
        this.network.sendShoot(origin, dir, { ...attack, clone: index });
      }
    };
    this.pixelFX.cloneManager = this.clones;

    // 7. Bộ điều khiển góc nhìn thứ 3 tích hợp Rung lắc Camera (Trauma Shake)
    this.controller = new ThirdPersonController(
      this.camera,
      this.character,
      this.canvas,
      (origin, attackDir, comboStep) => {
        // Nếu đang điều khiển Chiến Thần Robot Khổng Lồ: đòn đánh thường là Đạp đất & Nện nắm đấm!
        if (this.character.isMechaActive && this.character.giantRobot?.isActive) {
          const success = this.character.giantRobot.triggerAttack(this.monsters);
          if (success && this.network.isConnected) {
            this.network.sendShoot(origin, attackDir, { kind: 'mecha_attack', step: comboStep });
          }
          return;
        }

        const sectStats = this.character.sectStats;
        if (sectStats?.isGun) {
          this.projectiles.spawnBullet(
            origin, attackDir, comboStep, true, sectStats, this.character
          );
          if (this.network.isConnected) {
            this.network.sendShoot(origin, attackDir, { kind: 'bullet', step: comboStep });
          }
        } else if (sectStats?.isMageBasic) {
          this.projectiles.spawnArcaneOrb(
            origin, attackDir, comboStep, true, sectStats, this.character
          );
          if (this.network.isConnected) {
            this.network.sendShoot(origin, attackDir, { kind: 'arcane', step: comboStep });
          }
        } else if (sectStats?.isRangedBasic) {
          this.projectiles.spawnFeatherDart(
            origin, attackDir, comboStep, true, sectStats, this.character
          );
          if (this.network.isConnected) {
            this.network.sendShoot(origin, attackDir, { kind: 'feather', step: comboStep });
          }
        } else {
          this.projectiles.slash(
            origin, attackDir, this.monsters, comboStep === 2 ? 'thrust' : 'sweep',
            this.pixelFX.remotePlayers, (targetId, dmg, pos, source, isCounter, isBackstab) => this.handleHitPlayer(targetId, dmg, pos, source, isCounter, isBackstab),
            sectStats, this.character
          );
          if (this.network.isConnected) {
            this.network.sendShoot(origin, attackDir, { kind: 'slash', step: comboStep });
          }
        }
      },
      (skillNum, targetPos) => {
        // Mỗi môn phái có 3 kỹ năng (1, 2, 3); Đạo Gia có thêm chiêu 4
        if (skillNum < 1 || skillNum > 4 || !this.pixelFX.cooldowns[skillNum]) return false;

        if (this.character.isMechaActive && skillNum === 4) {
          this.showNotification(`🤖 Đang điều khiển Chiến Thần Cơ Giáp X20!`);
          return false;
        }

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
          if (!this.autoFarm?.isCasting) this.showNotification(`Thi triển [${skillName}]!${cost > 0 ? ` (-${cost} Linh Lực)` : ''}`);
        }
        return success;
      }
    );

    this.pixelFX.controller = this.controller;

    // Giữ chuột trái tụ lực rồi thả: phóng kiếm khí (màu sắc & lực sát thương theo môn phái)
    this.controller.onChargedRelease = (origin, attackDir, power) => {
      if (this.character.isMechaActive && this.character.giantRobot?.isActive) {
        const success = this.character.giantRobot.triggerAttack(this.monsters);
        if (success && this.network.isConnected) {
          this.network.sendShoot(origin, attackDir, { kind: 'mecha_attack', power });
        }
        return;
      }

      const qiOrigin = origin.clone().addScaledVector(attackDir, 0.6);
      const sectStats = this.character.sectStats;
      this.projectiles.spawnSwordQi(qiOrigin, attackDir, power, true, sectStats, this.character);
      if (this.network.isConnected) {
        this.network.sendShoot(qiOrigin, attackDir, { kind: 'qi', power });
      }
      if (power >= 1) {
        this.showNotification('⚔️ Kiếm khí đại thành! Xuyên phá vạn vật!');
      }
    };
    this.pixelFX.onScreenFlash = (type) => this.triggerScreenFlash(type);

    this.controller.onCockpitViewToggle = (isCockpit) => {
      this.showNotification(
        isCockpit
          ? '👁️ ĐÃ VÀO GÓC NHÌN BUỒNG LÁI (1ST-PERSON)! Bấm [V] để ra toàn cảnh!'
          : '🌐 ĐÃ VÀO GÓC NHÌN TOÀN CẢNH (3RD-PERSON)! Bấm [V] để vào buồng lái!'
      );
    };

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

    this.controller.onEscape = () => {
      const settingsModal = document.getElementById('settings-modal');
      if (settingsModal) {
        if (settingsModal.style.display === 'flex') {
          settingsModal.style.display = 'none';
        } else {
          settingsModal.style.display = 'flex';
        }
      }
    };
  }

  spawnMonsters() {
    if (this.monsters.length > 0) return;

    this.monsters = [
      // (10 Đại Boss không đứng sẵn trên bản đồ: lần lượt giáng thế khi trảm đủ yêu — xem summonBoss)

      // =====================================================================
      // 🗿🦁🦂 NHÓM QUÁI LỚN HẠNG NẶNG (CỰ YÊU):
      // Thân hình đồ sộ, đi chậm, animation 4 pha có sức nặng, sát thương cực lớn nhưng dễ né
      // =====================================================================
      // 🦁 Thanh Ngọc Cự Thần Sư (Hộ Điện Tinh Anh 2 bên Quảng Trường)
      new Monster(this.scene, this.particles, 'jade_guardian', new THREE.Vector3(-18, 0, 22), this.world),
      new Monster(this.scene, this.particles, 'jade_guardian', new THREE.Vector3(18, 0, 22), this.world),

      // 🗿 Thái Cổ Cự Thạch Yêu (Cự Yêu Địa Chấn 4 phương)
      new Monster(this.scene, this.particles, 'golem', new THREE.Vector3(-62, 0, 42), this.world),
      new Monster(this.scene, this.particles, 'golem', new THREE.Vector3(66, 0, 42), this.world),
      new Monster(this.scene, this.particles, 'golem', new THREE.Vector3(-38, 0, -32), this.world),
      new Monster(this.scene, this.particles, 'golem', new THREE.Vector3(38, 0, -32), this.world),

      // 🦂 Thiết Giáp Cự Hạt Vương (Cự Yêu Thiết Giáp & Pháo Độc)
      new Monster(this.scene, this.particles, 'flame_scorpion', new THREE.Vector3(-56, 0, -62), this.world),
      new Monster(this.scene, this.particles, 'flame_scorpion', new THREE.Vector3(58, 0, -22), this.world),
      new Monster(this.scene, this.particles, 'flame_scorpion', new THREE.Vector3(46, 0, 70), this.world),

      // =====================================================================
      // 🦖🦊👻 NHÓM QUÁI NHỎ (TIỂU YÊU):
      // Nhỏ gọn, chạy cực nhanh, đánh liên hoàn gây khó chịu/làm chậm nhẹ, ít sát thương
      // =====================================================================
      // 🦖 Đàn Hắc Diễm Tiểu Thú (Chạy zíc-zắc cắn gót liên hoàn)
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(-12, 0, -20), this.world),
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(-7, 0, -24), this.world),
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(14, 0, -6), this.world),
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(19, 0, -10), this.world),
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(-26, 0, 8), this.world),
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(0, 0, -88), this.world),
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(0, 0, 88), this.world),

      // 🦊 Đàn Hồ Hỏa Tiểu Yêu (Lượn vòng bắn tỉa liên thanh & nhào lộn nhảy lùi)
      new Monster(this.scene, this.particles, 'fox_mage', new THREE.Vector3(26, 0, 10), this.world),
      new Monster(this.scene, this.particles, 'fox_mage', new THREE.Vector3(31, 0, 14), this.world),
      new Monster(this.scene, this.particles, 'fox_mage', new THREE.Vector3(-32, 0, -14), this.world),
      new Monster(this.scene, this.particles, 'fox_mage', new THREE.Vector3(50, 0, -56), this.world),
      new Monster(this.scene, this.particles, 'fox_mage', new THREE.Vector3(-50, 0, 70), this.world),

      // 👻 Đàn U Minh Tiểu Quỷ (Thuấn bộ chọc lén sau lưng & Tam đoạn trảm siêu tốc)
      new Monster(this.scene, this.particles, 'sword_wraith', new THREE.Vector3(-16, 0, -45), this.world),
      new Monster(this.scene, this.particles, 'sword_wraith', new THREE.Vector3(-21, 0, -49), this.world),
      new Monster(this.scene, this.particles, 'sword_wraith', new THREE.Vector3(20, 0, -45), this.world),
      new Monster(this.scene, this.particles, 'sword_wraith', new THREE.Vector3(-72, 0, 10), this.world),
      new Monster(this.scene, this.particles, 'sword_wraith', new THREE.Vector3(72, 0, 10), this.world),
    ];

    const attach = (monster) => {
      monster.onBossEnrage = (boss) => {
        this.triggerScreenFlash('fire');
        this.controller.addTrauma(0.45);
        this.showNotification(`ĐẠI BOSS [${boss.name}] — ${boss.config.enrageText || 'CUỒNG NỘ (PHASE 2)!'}`);
      };

      monster.onDefeated = (m) => {
        this.monstersDefeated += m.isBoss ? 5 : (m.isLarge ? 2 : 1);
        if (m.isBoss) {
          this.onBossDefeated(m);
        } else if (!this.bossActive) {
          this.bossProgress++;
          if (this.bossProgress >= this.bossKillsNeeded) {
            setTimeout(() => this.summonBoss(), 1200);
          } else if (this.bossKillsNeeded - this.bossProgress === 5) {
            this.showNotification('⚠️ Yêu khí ngút trời... Đại Boss sắp giáng thế (còn 5 yêu)!');
          }
        }
        this.updateKillBadge();

        const mpGain = m.config?.xpMpReward || 25;
        const hpHeal = m.config?.healReward || (m.isBoss ? 600 : (m.isLarge ? 180 : 65));
        this.playerMp = Math.min(this.playerMaxMp, this.playerMp + mpGain);
        this.character.heal(hpHeal);

        if (m.isBoss) {
          this.triggerScreenFlash('sword');
          this.showNotification(`👑 ĐẠI THẮNG! Đã tru diệt Đại Boss [${m.name}]! (+${hpHeal} HP, Đầy Linh Lực)`);
        } else if (m.isLarge) {
          this.showNotification(`⚔️ Đã hạ gục Cự Yêu ${m.config?.icon || ''} ${m.name}! (+${hpHeal} HP, +${mpGain} Linh Lực)`);
        } else {
          this.showNotification(`✨ Đã tiêu diệt Tiểu Yêu ${m.config?.icon || ''} ${m.name}! (+${hpHeal} HP, +${mpGain} Linh Lực)`);
        }

        this.checkRealmBreakthrough();
      };
    };
    this.attachMonsterHandlers = attach;
    for (const monster of this.monsters) attach(monster);

    this.bossActive = false;
    this.bossProgress = 0;
    this.updateKillBadge();
  }

  nextBossIcon() {
    const type = BOSS_ORDER[(this.bossCycle || 0) % BOSS_ORDER.length];
    return MONSTER_CONFIGS[type]?.icon || '🐉';
  }

  updateKillBadge() {
    if (!this.killBadge) return;
    const boss = this.bossActive
      ? ' · 🐉 ĐẤU BOSS!'
      : (this.gameMode === 'pve' ? ` · ${this.nextBossIcon()} ${this.bossProgress}/${this.bossKillsNeeded}` : '');
    this.killBadge.textContent = `🎯 Trảm Yêu: ${this.monstersDefeated}${boss}`;
  }

  // Đại Boss giáng thế ngay trước mặt người chơi: mọi yêu ma khác tan biến & ngừng hồi sinh.
  // 10 Boss luân phiên theo BOSS_ORDER; hết một vòng thì vòng sau mạnh hơn (máu +40%, sát thương +25% mỗi vòng).
  summonBoss() {
    if (this.gameMode !== 'pve' || this.bossActive) return;
    this.bossActive = true;

    for (const m of this.monsters) m.vanish();

    const type = BOSS_ORDER[this.bossCycle % BOSS_ORDER.length];
    const tier = Math.floor(this.bossCycle / BOSS_ORDER.length);

    // Xuất hiện cách người chơi ~16m theo hướng camera, trong giới hạn bản đồ
    const fwd = this.controller.getAttackForward();
    const p = this.character.position;
    const spawn = new THREE.Vector3(
      THREE.MathUtils.clamp(p.x + fwd.x * 16, -105, 105),
      0,
      THREE.MathUtils.clamp(p.z + fwd.z * 16, -105, 105)
    );
    const boss = new Monster(this.scene, this.particles, type, spawn, this.world);
    if (tier > 0) {
      boss.maxHp = Math.round(boss.maxHp * (1 + 0.4 * tier));
      boss.hp = boss.maxHp;
      boss.damageMult = 1 + 0.25 * tier;
      boss.name = `${boss.name} ★${tier + 1}`;
    }
    boss.rotationY = Math.atan2(p.x - spawn.x, p.z - spawn.z);
    boss.model.rotation.y = boss.rotationY;
    boss.specialCooldown = 3.0;
    boss.attackCooldown = 2.0;
    this.attachMonsterHandlers(boss);
    this.monsters.push(boss);
    this.currentBoss = boss;

    sound.playMonsterRoar?.();
    this.particles.emitShockwave(spawn.clone().add(new THREE.Vector3(0, 0.5, 0)), boss.config.barColor || 0xff3838, 18, 0.8);
    this.particles.emitElementalParticles(spawn.clone().add(new THREE.Vector3(0, 4, 0)), 50, [boss.config.barColor || 0xff3838, 0xffffff], [3, 10], 1.2, 6, 1.2);
    this.triggerScreenFlash('fire');
    this.controller.addTrauma(0.5);

    const idx = (this.bossCycle % BOSS_ORDER.length) + 1;
    this.showNotification(`${boss.config.icon} ĐẠI BOSS ${idx}/10 [${boss.name}] GIÁNG THẾ! ${boss.config.hint || ''}`);
    // Thông báo gợi ý cơ chế giữ lâu hơn bình thường
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => document.getElementById('toast')?.classList.remove('show'), 7000);
    this.updateKillBadge();
  }

  onBossDefeated(boss) {
    this.bossActive = false;
    this.bossProgress = 0;
    this.bossCycle++;
    this.currentBoss = null;
    boss.respawnTimer = Infinity; // không tự hồi sinh
    // Dọn xác Boss sau hiệu ứng ngã xuống
    setTimeout(() => {
      const i = this.monsters.indexOf(boss);
      if (i >= 0) this.monsters.splice(i, 1);
      boss.destroy();
    }, 2500);

    // Yêu ma trở lại sau vài giây (lần lượt cho tự nhiên)
    let i = 0;
    for (const m of this.monsters) {
      if (!m.isBoss) m.resumeRespawn(3 + (i++ % 8) * 0.4);
    }
    this.updateKillBadge();
  }

  clearMonsters() {
    for (const monster of this.monsters) {
      monster.destroy();
    }
    this.bossActive = false;
    this.bossProgress = 0;
    this.monsters = [];
    const bossHud = document.getElementById('boss-hud');
    if (bossHud) bossHud.classList.remove('show', 'enraged');
  }

  // Nút AUTO chỉ hiện ở PvE, sáng lên khi đang bật
  updateAutoFarmButton() {
    const btn = document.getElementById('btn-auto-farm');
    if (!btn) return;
    const isPve = this.gameMode === 'pve';
    btn.style.display = isPve ? '' : 'none';
    const on = Boolean(this.autoFarm?.enabled);
    btn.classList.toggle('active', on);
    const label = btn.querySelector('.auto-label');
    if (label) label.textContent = on ? 'AUTO: BẬT' : 'AUTO';
  }

  setGameMode(mode) {
    this.gameMode = mode === 'pve' ? 'pve' : 'pvp';
    if (this.gameMode !== 'pve' && this.autoFarm) this.autoFarm.setEnabled(false);
    if (this.gameMode === 'pve') {
      this.spawnMonsters();
    } else {
      this.clearMonsters();
    }

    const modeTag = document.getElementById('game-mode-status-tag');
    const modeBtn = document.getElementById('btn-game-mode');
    if (modeTag) {
      modeTag.textContent = this.gameMode === 'pve' ? 'PvE (Có Quái)' : 'PvP (Không Quái)';
    }
    if (modeBtn) {
      modeBtn.classList.toggle('active', this.gameMode === 'pve');
    }
    this.updateAutoFarmButton();
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

  handleHitPlayer(targetId, dmg, hitPos, source = 'blaster', isCounter = false, isBackstab = false) {
    if (hitPos && this.pixelFX?.damageTexts && ['sword', 'sword_qi', 'feather_dart', 'arcane_orb', 'rifle_bullet'].includes(source)) {
      let label = `-${dmg}`;
      let color = '#ff4757';
      if (isBackstab) {
        label = `🗡️ -${dmg} CHÍ MẠNG!`;
        color = '#e056fd';
      } else if (isCounter) {
        label = `💥 -${dmg} KHẮC CHẾ!`;
        color = '#ffd700';
      }
      this.pixelFX.damageTexts.spawn(label, hitPos.clone().add(new THREE.Vector3(0, 0.7, 0)), color);
    }
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
        this.clones.syncRemote(state.id, rp.name, state.clones);
      }
    });

    // Người khác đánh trúng đạo ảnh của mình: server chuyển sát thương về đây để trừ máu
    this.network.on('clone_damaged', (msg) => {
      const hitPos = msg.hitPos ? new THREE.Vector3(msg.hitPos.x, msg.hitPos.y, msg.hitPos.z) : null;
      this.clones.damageLocal(msg.clone, msg.damage, hitPos);
    });

    this.network.on('player_shoot', (msg) => {
      // Đòn kiếm của người chơi khác: dựng lại hiệu ứng (đánh quái trên máy mình), không báo sát thương PvP
      const rp = this.remotePlayers.get(msg.id);
      const origin = new THREE.Vector3(msg.origin.x, msg.origin.y, msg.origin.z);
      const dir = new THREE.Vector3(msg.direction.x, msg.direction.y, msg.direction.z);
      if (msg.clone === 0 || msg.clone === 1) {
        if (msg.kind !== 'bolt') this.clones.animateRemote(msg.id, msg.clone, Math.atan2(dir.x, dir.z), msg.step || 0);
      } else if (rp) {
        rp.triggerSlash(Math.atan2(dir.x, dir.z), msg.kind === 'qi' ? 0 : (msg.step || 0));
      }
      if (msg.kind === 'bolt') {
        // Tia sét vàng của Tử Ảnh: chỉ dựng lại hình ảnh, sát thương do máy chủ nhân báo
        if (msg.target) this.clones.spawnBolt(origin, new THREE.Vector3(msg.target.x, msg.target.y, msg.target.z));
        return;
      }
      const rpSectStats = rp ? (SECT_STATS[rp.outfitIndex] || null) : null;
      if (msg.kind === 'qi') {
        this.projectiles.spawnSwordQi(origin, dir, msg.power || 0, false, rpSectStats, rp);
        sound.playSwordSlash();
      } else if (msg.kind === 'gslash') {
        // Nhát chém hoàng kim của Bạch Ảnh (đạo ảnh dùng sectStats của chủ nhân)
        this.projectiles.slash(origin, dir, this.monsters, 'goldSlash', [], null, rpSectStats, rp);
        sound.playSwordSlash();
      } else if (msg.kind === 'bullet') {
        this.projectiles.spawnBullet(origin, dir, msg.step || 0, false, rpSectStats, rp);
        if (sound.playGunshot) sound.playGunshot();
      } else if (msg.kind === 'arcane') {
        this.projectiles.spawnArcaneOrb(origin, dir, msg.step || 0, false, rpSectStats, rp);
        sound.playSwordSlash();
      } else if (msg.kind === 'feather') {
        this.projectiles.spawnFeatherDart(origin, dir, msg.step || 0, false, rpSectStats, rp);
        if (sound.playFeatherShoot) {
          sound.playFeatherShoot();
        } else {
          sound.playSwordSlash();
        }
      } else if (msg.kind === 'mecha_attack') {
        if (rp?.giantRobot?.isActive) {
          rp.giantRobot.triggerAttack(this.monsters);
        }
      } else {
        this.projectiles.slash(origin, dir, this.monsters, msg.step === 2 ? 'thrust' : 'sweep', [], null, rpSectStats, rp);
        sound.playSwordSlash();
      }
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
        const hadReflect = this.character.shieldReflectTimer > 0 && !this.character.isDead;
        this.character.takeDamage(msg.damage, msg.attackerId, hitPos);
        if (hadReflect && msg.attackerId && msg.attackerId !== this.network.selfId && msg.source !== 'shield_reflect') {
          const reflectDmg = Math.max(1, Math.round(msg.damage * 0.35));
          const attackerRp = this.remotePlayers.get(msg.attackerId);
          this.handleHitPlayer(msg.attackerId, reflectDmg, attackerRp ? attackerRp.position : this.character.position, 'shield_reflect');
        }
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
      this.clones.removeRemote(msg.id);
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
    // Nút mở/đóng Modal Cài Đặt (Settings)
    const settingsBtn = document.getElementById('btn-settings');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('btn-close-settings');

    if (settingsBtn && settingsModal) {
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.controller.exitLock();
        settingsModal.style.display = 'flex';
      });

      if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          settingsModal.style.display = 'none';
        });
      }

      settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
          settingsModal.style.display = 'none';
        }
      });
    }

    // Nút chuyển chế độ PvP / PvE
    const gameModeBtn = document.getElementById('btn-game-mode');
    if (gameModeBtn) {
      gameModeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextMode = this.gameMode === 'pvp' ? 'pve' : 'pvp';
        this.setGameMode(nextMode);
        this.showNotification(
          nextMode === 'pve'
            ? '👹 Đã chuyển sang Chế Độ PvE (Có Quái)!'
            : '⚔️ Đã chuyển sang Chế Độ PvP (Không Quái)!'
        );
      });
    }

    // Nút Âm thanh
    const soundBtn = document.getElementById('btn-sound');
    const soundTag = document.getElementById('sound-status-tag');
    if (soundBtn) {
      soundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.init();
        const isMuted = sound.toggleMute();
        if (soundTag) soundTag.textContent = isMuted ? 'TẮT' : 'BẬT';
        soundBtn.classList.toggle('active', !isMuted);
      });
    }

    // Nút Đổi trang phục / Vai trò chiến đấu
    const triggerRoleCycle = (e) => {
      if (e) e.stopPropagation();
      const name = this.character.cycleOutfit();
      this.selectedOutfitIndex = this.character.outfitIndex;
      localStorage.setItem('playerOutfit', this.selectedOutfitIndex);
      this.pixelFX.setSect(this.character.outfitIndex);
      this.showNotification(`Đã hoán đổi môn phái: ${name}`);
    };

    const outfitBtn = document.getElementById('btn-outfit');
    if (outfitBtn) outfitBtn.addEventListener('click', triggerRoleCycle);

    const hudRoleBtn = document.getElementById('btn-hud-role');
    if (hudRoleBtn) hudRoleBtn.addEventListener('click', triggerRoleCycle);

    const heroCrestWrap = document.querySelector('.rpg-hero-crest-wrap');
    if (heroCrestWrap) heroCrestWrap.addEventListener('click', triggerRoleCycle);

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

    // Tự Động Trảm Yêu (Auto Farm PvE): nút AUTO trên HUD hoặc phím T
    this.autoFarm = new AutoFarm(this);
    const autoBtn = document.getElementById('btn-auto-farm');
    const toggleAutoFarm = () => {
      if (this.gameMode !== 'pve') {
        this.showNotification('🤖 Tự động trảm yêu chỉ dùng được ở chế độ PvE.');
        return;
      }
      const on = this.autoFarm.toggle();
      this.updateAutoFarmButton();
      this.showNotification(on
        ? '🤖 BẬT Tự Động Trảm Yêu: tự tìm quái, tự đánh & tung chiêu (đẩy cần gạt để tự lái)'
        : '✋ TẮT Tự Động Trảm Yêu');
    };
    if (autoBtn) {
      autoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleAutoFarm();
      });
    }
    this.controller.onAutoToggle = () => {
      const loginModal = document.getElementById('login-modal');
      if (loginModal && getComputedStyle(loginModal).display !== 'none') return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      toggleAutoFarm();
    };
    this.updateAutoFarmButton();

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
    for (let i = 1; i <= 4; i++) {
      const slot = document.getElementById(`skill-slot-${i}`);
      if (slot) {
        slot.addEventListener('click', (e) => {
          e.stopPropagation();
          this.controller.triggerSkill(i);
        });
      }
    }

    // Khi môn phái / vai trò thay đổi: cập nhật toàn diện HUD nhập vai
    this.pixelFX.onSectChange = (sect) => {
      const sectTag = document.getElementById('hud-sect-name');
      if (sectTag) {
        sectTag.textContent = `${sect.icon} ${sect.name}`;
      }

      const roleDiamond = document.getElementById('hud-role-diamond');
      const roleCrestIcon = document.getElementById('hud-role-crest-icon');
      const counterHint = document.getElementById('hud-counter-hint');
      const basicIcon = document.getElementById('hud-basic-icon');
      const basicName = document.getElementById('hud-basic-name');

      const currentStats = SECT_STATS[this.character.outfitIndex] || SECT_STATS[0];
      if (roleDiamond && sect.themeColor) {
        roleDiamond.style.borderColor = sect.themeColor;
        roleDiamond.style.boxShadow = `0 0 16px ${sect.themeColor}66`;
      }
      if (roleCrestIcon) {
        roleCrestIcon.textContent = sect.icon || currentStats.icon || '🛡️';
      }
      if (counterHint) {
        if (currentStats.countersText) {
          counterHint.innerHTML = currentStats.countersText;
        } else if (currentStats.counterNames) {
          counterHint.innerHTML = `⚔️ Khắc: <strong>${currentStats.counterNames}</strong> • ⚠️ Kỵ: <em>${currentStats.weaknessNames}</em>`;
        }
      }

      // Đổi icon và tên của đòn đánh thường tương ứng với vai trò
      const basicAttackMap = [
        { icon: '🛡️⚔️', name: 'Trọng Kiếm Khiên Kích' },
        { icon: '🗡️✨', name: 'Song Đoản Đao Chém Nhanh' },
        { icon: '❄️🔮', name: 'Hàn Băng Thủy Cầu' },
        { icon: '🔥🪓', name: 'Huyết Hỏa Chiến Phủ' },
        { icon: '🏹🎯', name: 'Thần Phong Vũ Tiễn' },
        { icon: '🇻🇳🔫', name: 'Súng Trường Tác Chiến' },
      ];
      const curBasic = basicAttackMap[this.character.outfitIndex] || basicAttackMap[0];
      if (basicIcon) basicIcon.textContent = curBasic.icon;
      if (basicName) basicName.textContent = curBasic.name;

      // Cập nhật nút tấn công trên giao diện di động
      const mobShootBtn = document.getElementById('btn-m-shoot');
      if (mobShootBtn) {
        const mIcon = mobShootBtn.querySelector('.m-icon');
        const mLabel = mobShootBtn.querySelector('.m-label');
        if (mIcon) mIcon.textContent = curBasic.icon.slice(0, 2);
        if (mLabel) mLabel.textContent = curBasic.name.split(' ')[0];
      }

      for (let i = 1; i <= 4; i++) {
        const skill = sect.skills[i - 1];
        const slot = document.getElementById(`skill-slot-${i}`);
        if (slot) slot.style.display = skill ? '' : 'none';
        if (!skill) continue;
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
    this.barHpTrail = document.getElementById('bar-hp-trail');
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

    // Điện thoại đang mở ở chế độ "Yêu cầu trang web cho máy tính" (viewport ~980px):
    // giao diện bị thu nhỏ, chạm dễ lệch -> nhắc người chơi tắt chế độ đó
    try {
      const isCoarseTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches ||
        navigator.maxTouchPoints > 1;
      const shortSide = Math.min(window.screen.width, window.screen.height);
      const longSide = Math.max(window.screen.width, window.screen.height);
      const isPortrait = window.innerHeight > window.innerWidth;
      const expectedWidth = isPortrait ? shortSide : longSide;
      if (loginModal && isCoarseTouch && shortSide < 600 && window.innerWidth > expectedWidth * 1.5) {
        const warn = document.createElement('div');
        warn.className = 'desktop-mode-warning';
        warn.textContent = '⚠️ Trình duyệt đang ở chế độ "trang cho máy tính". Hãy bấm AA (hoặc ⋯) → "Yêu cầu trang web cho thiết bị di động" để chơi mượt hơn.';
        const box = loginModal.querySelector('.modal-box');
        if (box) box.prepend(warn);
      }
    } catch (err) {}

    const savedName = localStorage.getItem('playerName') || 'Hiệp Sĩ Bé Gấu';
    if (nameInput) nameInput.value = savedName;

    const mobileHintEl = document.getElementById('outfit-mobile-hint');
    const roleHints = [
      '🛡️ Thiết Giáp: 2600 HP, Giảm 20% ST • Khắc Sát Thủ, Xạ Thủ',
      '🗡️ Ám Ảnh: Tốc đánh cao, Đâm sau +35% ST • Khắc Pháp Sư, Xạ Thủ',
      '❄️ Nguyên Tố: Cầu băng làm chậm, ST Phép AoE • Khắc Hộ Vệ, Đấu Sĩ',
      '🔥 Cuồng Chiến: Hút máu, ST phá giáp • Khắc Hộ Vệ, Sát Thủ',
      '🏹 Thần Phong: Tầm xa 28m, Bắn tỉa xuyên thấu • Khắc Pháp Sư, Đấu Sĩ',
      '⭐ NAMCAM: Vai trò ẩn đặc biệt của Bộ Đội Việt Nam'
    ];
    const updateMobileRoleHint = (idx) => {
      if (mobileHintEl && roleHints[idx]) {
        mobileHintEl.textContent = roleHints[idx];
      }
    };

    const secretCard = document.getElementById('secret-outfit-namcam');
    const checkSecretName = (rawName, isInitial = false) => {
      const isSecret = (rawName || '').trim() === 'NAMCAM';
      if (secretCard) {
        secretCard.style.display = isSecret ? 'flex' : 'none';
        if (isSecret) {
          outfitCards.forEach((c) => c.classList.remove('active'));
          secretCard.classList.add('active');
          this.selectedOutfitIndex = 5;
          localStorage.setItem('playerOutfit', 5);
          this.character.setOutfit(5);
          this.pixelFX.setSect(5);
          updateMobileRoleHint(5);
          if (!isInitial && sound.playSwordSummon) sound.playSwordSummon();
          if (!isInitial) this.showNotification('🎖️ DANH PHẬN NAMCAM XUẤT THẾ! PHÁI ẨN BỘ ĐỘI VIỆT NAM ĐÃ MỞ!');
        } else if (this.selectedOutfitIndex === 5) {
          secretCard.classList.remove('active');
          this.selectedOutfitIndex = 0;
          const firstCard = document.querySelector('.outfit-card[data-index="0"]');
          if (firstCard) firstCard.classList.add('active');
          localStorage.setItem('playerOutfit', 0);
          this.character.setOutfit(0);
          this.pixelFX.setSect(0);
          updateMobileRoleHint(0);
        }
      }
    };

    const savedOutfit = parseInt(localStorage.getItem('playerOutfit'), 10);
    if (!isNaN(savedOutfit) && savedOutfit >= 0 && savedOutfit < 6) {
      this.selectedOutfitIndex = savedOutfit;
      outfitCards.forEach((c) => {
        c.classList.toggle('active', parseInt(c.dataset.index, 10) === savedOutfit);
      });
      this.character.setOutfit(this.selectedOutfitIndex);
      this.pixelFX.setSect(this.selectedOutfitIndex);
      updateMobileRoleHint(this.selectedOutfitIndex);
    } else {
      updateMobileRoleHint(0);
    }

    if (nameInput) {
      nameInput.addEventListener('input', (e) => checkSecretName(e.target.value));
      checkSecretName(nameInput.value, true);
    }

    const envWsUrl = import.meta.env?.VITE_WS_SERVER_URL;
    const isLocalHost = Boolean(
      !window.location.hostname ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.') ||
      window.location.hostname.endsWith('.local')
    );
    const savedServerUrl = localStorage.getItem('serverUrl');
    const defaultServerUrl = (envWsUrl && envWsUrl.trim()) ||
      (savedServerUrl && savedServerUrl.trim()) ||
      (isLocalHost
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname || 'localhost'}:3000`
        : 'wss://cute-lowpoly-game.onrender.com');

    if (serverInput) serverInput.value = defaultServerUrl;

    outfitCards.forEach((card) => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        outfitCards.forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedOutfitIndex = parseInt(card.dataset.index, 10) || 0;
        localStorage.setItem('playerOutfit', this.selectedOutfitIndex);
        this.character.setOutfit(this.selectedOutfitIndex);
        this.pixelFX.setSect(this.selectedOutfitIndex);
        updateMobileRoleHint(this.selectedOutfitIndex);
      });
    });

    const enterGame = async (isOnlineMode) => {
      const name = (nameInput.value || 'Gấu Hiệp Sĩ').trim().substring(0, 18);
      localStorage.setItem('playerName', name);
      localStorage.setItem('playerOutfit', this.selectedOutfitIndex);
      this.character.setName(name);
      this.character.setOutfit(this.selectedOutfitIndex);
      this.pixelFX.setSect(this.selectedOutfitIndex);

      const hudPlayerName = document.getElementById('hud-player-name');
      if (hudPlayerName) hudPlayerName.textContent = name;

      if (loginModal) loginModal.style.display = 'none';

      if (isOnlineMode) {
        this.setGameMode('pvp');
        const url = (serverInput.value || defaultServerUrl).trim();
        localStorage.setItem('serverUrl', url);
        if (this.onlineBadge) this.onlineBadge.textContent = '🌐 Đang kết nối...';
        try {
          await this.network.connect(url, { name, outfit: this.selectedOutfitIndex });
        } catch (err) {
          console.warn('Cannot connect to multiplayer server, running in offline mode:', err);
          this.showNotification('⚠️ Không thể kết nối server! Đang ở bản đồ PvP (Không Quái).');
          if (this.onlineBadge) {
            this.onlineBadge.textContent = '🔴 Offline (PvP)';
            this.onlineBadge.style.color = '#ff4757';
          }
        }
      } else {
        this.setGameMode('pve');
        if (this.onlineBadge) {
          this.onlineBadge.textContent = '👹 Chế độ PvE (Có Quái)';
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

    const hudLeaderboardBtn = document.getElementById('btn-hud-leaderboard');
    if (hudLeaderboardBtn) {
      hudLeaderboardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLeaderboard();
      });
    }

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
      if (this.barHpTrail) this.barHpTrail.style.width = `${hpRatio * 100}%`;
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
          clones: this.clones.getNetworkState(),
          outfit: this.character.outfitIndex,
        });
      }
    }

    // 1. Cập nhật nhân vật & điều khiển (Auto Farm quyết định hướng đi/đòn đánh trước)
    if (this.autoFarm) this.autoFarm.update(delta);
    this.controller.update(delta);

    // Cập nhật danh sách người chơi khác (Remote Players)
    const rpList = Array.from(this.remotePlayers.values());
    for (const rp of rpList) {
      rp.update(delta);
    }

    // Mục tiêu PvP: người chơi khác và đạo ảnh phân thân của họ
    const pvpTargets = rpList.concat(this.clones.getRemoteTargets());
    this.pixelFX.remotePlayers = pvpTargets;
    this.pixelFX.monsters = this.monsters;
    this.pixelFX.projectiles = this.projectiles;

    // Đạo ảnh phân thân: AI của mình + bản sao đạo ảnh của người khác
    this.clones.update(delta, this.character, this.monsters, pvpTargets, this.controller.yaw);

    // 2. Cập nhật đạn và va chạm với người chơi khác + quái vật
    this.projectiles.update(delta, this.monsters, pvpTargets, (targetId, dmg, pos, source, isCounter, isBackstab) => this.handleHitPlayer(targetId, dmg, pos, source, isCounter, isBackstab));

    // 3. Cập nhật kỹ năng PixelFX & tàn phá địa hình
    this.pixelFX.update(delta);

    // 4. Cập nhật AI quái vật & Đại Boss
    let activeBoss = null;
    for (const monster of this.monsters) {
      monster.update(delta, this.character.position, this.camera, this.character);
      if (monster.isBoss && !monster.isDead) {
        const distToBoss = monster.position.distanceTo(this.character.position);
        if (distToBoss <= 60) {
          activeBoss = monster;
        }
      }
    }

    // Cập nhật Thanh Máu Đại Boss trên HUD
    const bossHud = document.getElementById('boss-hud');
    if (bossHud) {
      if (activeBoss && this.gameMode === 'pve') {
        bossHud.classList.add('show');
        bossHud.classList.toggle('enraged', activeBoss.isEnraged);
        const bossNameEl = document.getElementById('boss-hud-name');
        const bossSkillEl = document.getElementById('boss-hud-skill');
        const bossBarEl = document.getElementById('boss-bar-hp');
        const bossBarTrailEl = document.getElementById('boss-bar-trail');
        const bossTextEl = document.getElementById('boss-text-hp');
        if (bossNameEl) {
          bossNameEl.textContent = activeBoss.isEnraged
            ? `🔥 ĐẠI BOSS: ${activeBoss.name} (CUỒNG NỘ)`
            : `🐉 ĐẠI BOSS: ${activeBoss.name}`;
        }
        if (bossSkillEl) bossSkillEl.textContent = activeBoss.currentSkillName;
        const bRatio = Math.max(0, activeBoss.hp / activeBoss.maxHp);
        if (bossBarEl) bossBarEl.style.width = `${bRatio * 100}%`;
        if (bossBarTrailEl) bossBarTrailEl.style.width = `${bRatio * 100}%`;
        if (bossTextEl) bossTextEl.textContent = `${Math.round(activeBoss.hp)} / ${activeBoss.maxHp} HP`;
      } else {
        bossHud.classList.remove('show', 'enraged');
      }
    }

    // Xử lý hồi sinh khi nhân vật tử trận trong chế độ PvE
    if (this.character.hp <= 0 && !this.character.isDead && !this.network.isConnected) {
      this.character.isDead = true;
      this.showRespawnScreen('Yêu Ma Trường An', 3.5);
      setTimeout(() => {
        this.character.respawn({ x: 0, y: 0, z: -38 });
        this.playerHp = this.character.hp;
        this.hideRespawnScreen();
        this.showNotification('✨ Đã tái tạo thần thể, tiếp tục trảm yêu trừ ma!');
      }, 3500);
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
      // Bát Quái Hộ Thể: kháng hiệu ứng + hồi chiêu nhanh, hiện thời gian còn lại
      if (this.character.statusResistTimer > 0) {
        state += ` · ☯️ Hộ Thể ${this.character.statusResistTimer.toFixed(1)}s`;
      }
      this.stateBadge.textContent = state;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
