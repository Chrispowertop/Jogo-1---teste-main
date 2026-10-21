import * as Phaser from 'phaser';
import { FONT } from './Preloader';
import { Nav } from '../game/Nav';
import { Sfx } from '../game/Sfx';
import { ZOMBIES, UPGRADES, baseStats } from '../game/data';

const TAU = Math.PI * 2;
const PS = 0.8;                       // escala do herói
const rnd = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => Math.abs(Phaser.Math.Angle.Wrap(a - b));
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class Game extends Phaser.Scene {
    constructor() { super('Game'); }

    // ------------------------------------------------------------------ CREATE
    create() {
        const map = this.make.tilemap({ key: 'map' });
        const sets = [map.addTilesetImage('Mapa', 'tiles'), map.addTilesetImage('Objetos', 'objects')];
        map.createLayer('Camada de Blocos 1', sets, 0, 0).setDepth(0);
        const objs = map.createLayer('objectColider', sets, 0, 0).setDepth(1);
        this.nav = new Nav(map, objs, this.cache.json.get('collision'));
        const sp = map.getObjectLayer('player')?.objects?.[0] ?? { x: 640, y: 640 };
        this.spawnPts = (map.getObjectLayer('enemy')?.objects ?? []).map(o => ({ x: o.x, y: o.y }));

        this.time.paused = false; this.tweens.resumeAll();
        this.sfx = new Sfx(this);
        this.S = baseStats(); this.lv = {};
        this.level = 1; this.xp = 0; this.pending = 0; this.kills = 0; this.elapsed = 0;
        this.paused = false; this.over = false; this.menu = null; this.magnetAll = false;
        this.zombies = []; this.gems = []; this.items = []; this.knives = [];
        this.wave = 0; this.waveTimer = 0; this.budget = 0; this.spawnAcc = 0; this.spawnInt = 1;
        this.fieldT = 0; this.spinT = 3; this.knifeT = 1; this.fireT = 0;

        this.makeFx();
        const f = this.nav.nearestFree(sp.x, sp.y);
        this.player = this.makePlayer(f.x, f.y);
        this.buildHud();
        this.setupInput();
        this.startWave();
        this.cameras.main.fadeIn(500);
    }

    makeFx() {
        const P = (cfg, depth = 850) => this.add.particles(0, 0, 'px', { emitting: false, ...cfg }).setDepth(depth);
        this.blood = P({ lifespan: { min: 250, max: 600 }, speed: { min: 60, max: 240 }, scale: { start: 1.6, end: 0.4 }, tint: [0x8b0000, 0xb30000, 0x5c0000], alpha: { start: 1, end: 0 }, gravityY: 320 });
        this.sparks = P({ lifespan: { min: 150, max: 350 }, speed: { min: 80, max: 320 }, scale: { start: 1.4, end: 0 }, tint: [0xffe27a, 0xffffff, 0xffa500], blendMode: 'ADD' });
        this.dust = P({ lifespan: { min: 400, max: 800 }, speed: { min: 10, max: 70 }, scale: { start: 3, end: 6 }, tint: 0x8a6a40, alpha: { start: 0.5, end: 0 } });
        this.heals = P({ lifespan: 700, speed: { min: 20, max: 80 }, scale: { start: 2, end: 0 }, tint: 0x6bff8a, gravityY: -80, blendMode: 'ADD' });
        this.aura = this.add.image(0, 0, 'soft').setTint(0xff7a1a).setAlpha(0.3).setBlendMode('ADD').setVisible(false);
        this.add.image(640, 640, 'vignette').setDisplaySize(1280, 1280).setDepth(880);
        this.redVig = this.add.image(640, 640, 'redvig').setDisplaySize(1280, 1280).setDepth(881).setAlpha(0);
        this.night = this.add.rectangle(640, 640, 1280, 1280, 0x0a1238, 0).setDepth(870);
        this.input.setDefaultCursor('none');
        this.cross = this.add.image(640, 640, 'cross').setDepth(3000);
    }

    makePlayer(x, y) {
        return {
            x, y, r: 9, hp: this.S.maxHp, face: Math.PI / 2, faceT: 0, hurtT: 0, inv: 0, dashT: 0, dashCd: 0,
            dashDir: { x: 0, y: 1 }, cd: 0, swinging: false, combo: 0, kx: 0, ky: 0, dead: false, moving: false, ghostT: 0,
            shadow: this.add.image(x, y, 'shadow'),
            spr: this.add.sprite(x, y, 'player', 0).setOrigin(0.5, 0.97).setScale(PS),
            sword: this.add.image(x, y, 'sword').setOrigin(0.5, 0.9),
        };
    }

    // ------------------------------------------------------------------ INPUT / PAUSE
    setupInput() {
        const kb = this.input.keyboard;
        this.keys = kb.addKeys({
            up: 'W', down: 'S', left: 'A', right: 'D', up2: 'UP', down2: 'DOWN', left2: 'LEFT', right2: 'RIGHT',
            atk: 'SPACE', atk2: 'J', dash: 'SHIFT', dash2: 'K', pause: 'P', esc: 'ESC', n1: 'ONE', n2: 'TWO', n3: 'THREE', r: 'R',
        });
        this.input.mouse.disableContextMenu();
        kb.on('keydown-SPACE', e => e.preventDefault());
        this.events.once('shutdown', () => this.input.setDefaultCursor('default'));
    }

    setPaused(b) {
        this.paused = b;
        b ? this.tweens.pauseAll() : this.tweens.resumeAll();
        this.time.paused = b;
    }

    // ------------------------------------------------------------------ UPDATE
    update(time, dms) {
        const dt = Math.min(dms / 1000, 0.05), K = this.keys, ptr = this.input.activePointer;
        this.cross.setPosition(ptr.worldX, ptr.worldY);

        if (!this.over) {
            if (!this.menu && (Phaser.Input.Keyboard.JustDown(K.pause) || Phaser.Input.Keyboard.JustDown(K.esc))) {
                this.setPaused(!this.paused); this.pauseTxt.setVisible(this.paused);
            }
            if (this.paused && !this.menu && Phaser.Input.Keyboard.JustDown(K.r)) { this.scene.restart(); return; }
            if (this.menu) {
                [K.n1, K.n2, K.n3].forEach((k, i) => { if (Phaser.Input.Keyboard.JustDown(k)) this.pick(i); });
            }
        } else if (Phaser.Input.Keyboard.JustDown(K.r)) { this.scene.restart(); return; }
        if (this.paused) { this.drawHud(); return; }

        this.elapsed += this.player.dead ? 0 : dt;
        this.updatePlayer(dt);
        if (!this.player.dead) {
            this.updateWaves(dt);
            this.updateZombies(dt);
            this.updateGems(dt);
            this.updateItems(dt);
            this.updateKnives(dt);
            this.updatePowers(dt);
        }
        this.drawHud();
    }

    // ------------------------------------------------------------------ PLAYER
    updatePlayer(dt) {
        const p = this.player, S = this.S, K = this.keys;
        p.shadow.setPosition(p.x, p.y - 2).setDepth(p.y - 0.5);
        if (p.dead) return;
        let ix = (K.right.isDown || K.right2.isDown ? 1 : 0) - (K.left.isDown || K.left2.isDown ? 1 : 0);
        let iy = (K.down.isDown || K.down2.isDown ? 1 : 0) - (K.up.isDown || K.up2.isDown ? 1 : 0);
        const len = Math.hypot(ix, iy); if (len) { ix /= len; iy /= len; }
        p.moving = len > 0;

        p.dashCd = Math.max(0, p.dashCd - dt);
        if ((Phaser.Input.Keyboard.JustDown(K.dash) || Phaser.Input.Keyboard.JustDown(K.dash2)) && p.dashCd <= 0 && p.dashT <= 0) {
            p.dashDir = len ? { x: ix, y: iy } : { x: Math.cos(p.face), y: Math.sin(p.face) };
            p.dashT = 0.17; p.dashCd = S.dashCd; p.inv = Math.max(p.inv, 0.3);
            this.sfx.dash(); this.dust.explode(8, p.x, p.y);
        }
        let vx = ix * S.speed * (p.swinging ? 0.7 : 1), vy = iy * S.speed * (p.swinging ? 0.7 : 1);
        if (p.dashT > 0) {
            p.dashT -= dt; vx = p.dashDir.x * 650; vy = p.dashDir.y * 650;
            p.ghostT -= dt;
            if (p.ghostT <= 0) {
                p.ghostT = 0.025;
                const g = this.add.image(p.x, p.y, 'player', p.spr.frame.name).setOrigin(0.5, 0.97).setScale(PS).setFlipX(p.spr.flipX).setTint(0x66ccff).setAlpha(0.6).setDepth(p.y - 1);
                this.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
            }
        }
        vx += p.kx; vy += p.ky; const dk = Math.pow(0.001, dt); p.kx *= dk; p.ky *= dk;
        this.nav.move(p, vx * dt, vy * dt, p.r);
        if (!this.nav.free(p.x, p.y, p.r)) { const q = this.nav.nearestFree(p.x, p.y); p.x = q.x; p.y = q.y; }
        p.hp = Math.min(S.maxHp, p.hp + S.regen * dt);

        // ataque
        p.cd -= dt;
        const kbAtk = K.atk.isDown || K.atk2.isDown, ptr = this.input.activePointer;
        if ((kbAtk || ptr.leftButtonDown()) && p.cd <= 0 && !this.menu) {
            const aim = this.getAim(kbAtk);
            p.combo = (p.combo + 1) % 3;
            const heavy = p.combo === 0;
            p.cd = S.cd * (heavy ? 1.3 : 1);
            this.swing(aim, { heavy });
        }

        // i-frames e animação
        p.inv = Math.max(0, p.inv - dt); p.hurtT = Math.max(0, p.hurtT - dt); p.faceT = Math.max(0, p.faceT - dt);
        if (!p.swinging && p.faceT <= 0 && p.moving) p.face = Math.atan2(iy, ix);
        const spr = p.spr, ax = Math.cos(p.face), ay = Math.sin(p.face);
        let key, idle;
        if (Math.abs(ax) > Math.abs(ay) * 0.9) { key = 'p_side'; idle = 10; spr.setFlipX(ax < 0); }
        else if (ay > 0) { key = 'p_down'; idle = 0; spr.setFlipX(false); }
        else { key = 'p_up'; idle = 6; spr.setFlipX(false); }
        if (p.hurtT > 0) { spr.anims.stop(); spr.setFrame(36); }
        else if (p.moving || p.dashT > 0) { if (spr.anims.currentAnim?.key !== key || !spr.anims.isPlaying) spr.play(key); }
        else { spr.anims.stop(); spr.setFrame(idle); }
        spr.setPosition(p.x, p.y).setDepth(p.y);
        spr.setAlpha(p.inv > 0 && p.dashT <= 0 ? (Math.floor(this.elapsed * 20) % 2 ? 0.45 : 1) : 1);
        if (!p.swinging) this.restSword();
    }

    restSword() {
        const p = this.player, up = Math.sin(p.face) < -0.5, side = Math.abs(Math.cos(p.face)) > Math.abs(Math.sin(p.face)) * 0.9;
        const dir = (side ? (Math.cos(p.face) < 0 ? -1 : 1) : 1);
        p.sword.setPosition(p.x - dir * 12, p.y - 24).setRotation(dir * -2.4 + Math.PI * 0).setScale(0.55)
            .setDepth(up ? p.y - 0.2 : p.y + 0.5).setFlipX(false).setVisible(true).setAlpha(1);
    }

    getAim(keyboard) {
        const p = this.player, cx = p.x, cy = p.y - 26;
        if (keyboard) {
            let best = null, bd = 260;
            for (const z of this.zombies) { const d = Math.hypot(z.x - p.x, z.y - p.y); if (d < bd) { bd = d; best = z; } }
            return best ? Math.atan2(best.y - z0(best) - cy, best.x - cx) : p.face;
        }
        const ptr = this.input.activePointer;
        return Math.atan2(ptr.worldY - cy, ptr.worldX - cx);
    }

    swing(aim, o = {}) {
        const p = this.player, S = this.S;
        const half = o.spin ? Math.PI : Phaser.Math.DegToRad(S.arc * (o.heavy ? 1.25 : 1));
        const range = S.range * (o.spin ? 1.15 : o.heavy ? 1.2 : 1);
        const dur = o.spin ? 340 : Math.max(110, S.cd * 280);
        p.face = aim; p.faceT = 0.5; if (!o.spin) p.swinging = true;
        this.sfx.swing(o.heavy || o.spin);
        if (!o.spin) this.nav.move(p, Math.cos(aim) * 8, Math.sin(aim) * 8, p.r);

        const cx = p.x, cy = p.y - 26;
        if (o.spin) {
            const r = this.add.image(cx, cy, 'ring').setScale(0.2).setTint(0x9fe8ff).setDepth(p.y + 2).setAlpha(0.9);
            this.tweens.add({ targets: r, scale: range / 62, alpha: 0, duration: dur, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
        } else {
            const fx = this.add.image(cx, cy, 'slash').setRotation(aim).setScale(range / 76, Phaser.Math.Clamp(half / 1.25, 0.8, 1.6))
                .setTint(o.heavy ? 0xffd27a : 0xdff6ff).setAlpha(0.95).setDepth(p.y + 2);
            this.tweens.add({ targets: fx, alpha: 0, scaleX: fx.scaleX * 1.12, duration: dur + 110, ease: 'Quad.easeOut', onComplete: () => fx.destroy() });
        }
        const start = o.spin ? aim : aim - half, end = o.spin ? aim + TAU : aim + half;
        let done = false;
        this.tweens.addCounter({
            from: 0, to: 1, duration: dur, ease: 'Sine.easeOut',
            onUpdate: tw => {
                const v = tw.getValue(), a = start + (end - start) * v;
                p.sword.setPosition(p.x + Math.cos(a) * 14, p.y - 26 + Math.sin(a) * 14).setRotation(a + Math.PI / 2)
                    .setScale(range * 0.8 / 90).setDepth(p.y + 3).setVisible(true);
                if (!done && v > 0.3) { done = true; this.applyHit(aim, half, range, o); }
            },
            onComplete: () => { if (!o.spin) p.swinging = false; },
        });
    }

    applyHit(aim, half, range, o) {
        const p = this.player, S = this.S, cx = p.x, cy = p.y - 26;
        let hits = 0, crit = false;
        for (const z of this.zombies.slice()) {
            if (z.spawnT > 0) continue;
            const dx = z.x - cx, dy = z.y - z.h * 0.45 - cy, d = Math.hypot(dx, dy);
            if (d > range + z.r) continue;
            const a = Math.atan2(dy, dx);
            if (half < Math.PI && d > z.r + 16 && angDiff(a, aim) > half) continue;
            const c = this.hitZombie(z, S.dmg * (o.heavy ? 1.6 : o.spin ? 1.2 : 1), a, o.heavy ? 1.6 : 1);
            hits++; crit = crit || c;
        }
        if (hits) {
            this.sfx.hit(crit);
            this.cameras.main.shake(70, o.heavy ? 0.0035 : 0.0015);
        }
    }

    hitZombie(z, base, angle, kb = 1) {
        const S = this.S, p = this.player;
        const crit = Math.random() < S.crit, d = Math.max(1, Math.round(base * rnd(0.9, 1.1) * (crit ? S.critMul : 1)));
        z.hp -= d; z.kx += Math.cos(angle) * S.knock * kb / z.def.mass; z.ky += Math.sin(angle) * S.knock * kb / z.def.mass;
        z.flash = 0.09; z.spr.setTintFill(0xffffff);
        this.blood.explode(crit ? 10 : 5, z.x, z.y - z.h * 0.5);
        if (crit) this.sparks.explode(6, z.x, z.y - z.h * 0.5);
        if (this.zombies.length < 90 || crit) this.pop(z.x, z.y - z.h, String(d), crit ? '#ffd23f' : '#ffffff', crit ? 30 : 22);
        if (S.lifesteal) p.hp = Math.min(S.maxHp, p.hp + d * S.lifesteal);
        if (z.hp <= 0) this.killZombie(z);
        return crit;
    }

    heal(n) {
        const p = this.player; p.hp = Math.min(this.S.maxHp, p.hp + n);
        this.heals.explode(10, p.x, p.y - 30); this.pop(p.x, p.y - 80, `+${Math.round(n)}`, '#6bff8a', 24);
    }

    damagePlayer(dmg, fromX, fromY) {
        const p = this.player;
        if (p.inv > 0 || p.dead) return;
        const d = Math.max(1, Math.round(dmg * (1 - this.S.armor)));
        p.hp -= d; p.inv = 0.7; p.hurtT = 0.22;
        const a = Math.atan2(p.y - fromY, p.x - fromX); p.kx += Math.cos(a) * 260; p.ky += Math.sin(a) * 260;
        this.sfx.hurt(); this.cameras.main.shake(140, 0.006); this.cameras.main.flash(90, 255, 40, 40, true);
        this.blood.explode(8, p.x, p.y - 30); this.pop(p.x, p.y - 80, `-${d}`, '#ff5a5a', 26);
        if (p.hp <= 0) this.die();
    }

    die() {
        const p = this.player; p.dead = true; p.hp = 0; this.over = true;
        p.sword.setVisible(false); p.spr.setAlpha(1).play('p_death'); this.sfx.death();
        this.input.setDefaultCursor('default'); this.cross.setVisible(false);
        const t = fmt(this.elapsed), best = JSON.parse(localStorage.getItem('arena_best') || 'null');
        const score = this.wave * 1000 + this.kills;
        let newBest = false;
        if (!best || score > best.score) { newBest = true; localStorage.setItem('arena_best', JSON.stringify({ score, time: t, wave: this.wave, kills: this.kills })); }
        this.time.delayedCall(1700, () => this.cameras.main.fadeOut(600, 60, 0, 0));
        this.time.delayedCall(2300, () => this.scene.start('GameOver', { time: t, wave: this.wave, kills: this.kills, level: this.level, newBest }));
    }

    // ------------------------------------------------------------------ ZUMBIS
    updateWaves(dt) {
        this.waveTimer -= dt;
        if (this.budget <= 0 && this.zombies.length === 0 && this.waveTimer > 3) this.waveTimer = 1.5; // onda limpa: próxima mais cedo
        if (this.waveTimer <= 0) this.startWave();
        this.spawnAcc += dt;
        while (this.spawnAcc >= this.spawnInt && this.budget > 0) {
            this.spawnAcc -= this.spawnInt;
            if (this.zombies.length < 130) { this.spawnZombie(this.pickType()); this.budget--; } else break;
        }
        this.night.setAlpha(Math.min(0.36, (this.wave - 1) * 0.03));
    }

    startWave() {
        this.wave++; const w = this.wave;
        this.waveTimer = 30; this.budget = 10 + w * 5; this.spawnInt = Math.max(0.15, (this.waveTimer * 0.7) / this.budget);
        if (w > 1) { this.heal(this.S.maxHp * 0.08); this.sfx.wave(); }
        const boss = w % 5 === 0;
        this.banner(boss ? `ONDA ${w} — CHEFE!` : `ONDA ${w}`, boss ? '#ff6b6b' : '#ffe27a');
        if (boss) this.spawnZombie('boss');
        if (w === 1) for (let i = 0; i < 4; i++) this.spawnZombie('walker');
    }

    pickType() {
        const w = this.wave, r = Math.random();
        if (w >= 4 && r < Math.min(0.2, 0.06 + 0.012 * w)) return 'brute';
        if (w >= 2 && r < Math.min(0.55, 0.3 + 0.02 * w)) return 'runner';
        return 'walker';
    }

    spawnZombie(type) {
        const def = ZOMBIES[type], p = this.player, w = this.wave;
        let pos = null;
        for (let i = 0; i < 25 && !pos; i++) {
            const c = (this.spawnPts.length && Math.random() < 0.5)
                ? this.spawnPts[Math.floor(Math.random() * this.spawnPts.length)]
                : this.nav.spawnTiles[Math.floor(Math.random() * this.nav.spawnTiles.length)];
            if (Math.hypot(c.x - p.x, c.y - p.y) > 380 && this.nav.free(c.x, c.y, def.r) && this.nav.dist[(c.y / 32 | 0) * this.nav.w + (c.x / 32 | 0)] >= 0) pos = { x: c.x + rnd(-8, 8), y: c.y + rnd(-8, 8) };
        }
        if (!pos) pos = this.nav.nearestFree(rnd(100, 1180), rnd(100, 1180));
        const hpMul = 1 + 0.22 * (w - 1) + (type === 'boss' ? 0.3 * (w / 5 - 1) : 0);
        const z = {
            type, def, x: pos.x, y: pos.y, h: def.h, r: def.r, mass: def.mass,
            hp: Math.round(def.hp * hpMul), dmg: def.dmg * (1 + 0.06 * (w - 1)),
            speed: def.speed * Math.min(1.6, 1 + 0.03 * (w - 1)) * rnd(0.9, 1.1),
            kx: 0, ky: 0, atkCd: 0.5, spawnT: type === 'boss' ? 1.2 : 0.7, flash: 0, face: 'down',
            shadow: this.add.image(pos.x, pos.y, 'shadow').setScale(def.scale * 0.9).setAlpha(0),
            spr: this.add.sprite(pos.x, pos.y, 'zombie', 0).setOrigin(0.5, 0.97).setScale(def.scale).setTint(def.tint).setAlpha(0),
        };
        z.maxHp = z.hp; z.spr.play({ key: 'z_down', startFrame: Math.floor(Math.random() * 10) });
        this.dust.explode(6, pos.x, pos.y);
        this.zombies.push(z);
    }

    updateZombies(dt) {
        const p = this.player, nav = this.nav;
        this.fieldT -= dt;
        if (this.fieldT <= 0) { nav.computeField(p.x, p.y); this.fieldT = 0.25; }
        const zs = this.zombies;
        for (let i = 0; i < zs.length; i++) {
            const z = zs[i], spr = z.spr;
            if (z.spawnT > 0) {
                z.spawnT -= dt; const a = 1 - Math.max(0, z.spawnT) / 0.7;
                spr.setAlpha(Math.min(1, a)); z.shadow.setAlpha(Math.min(1, a));
                spr.setPosition(z.x, z.y + (1 - Math.min(1, a)) * 14).setDepth(z.y); z.shadow.setPosition(z.x, z.y - 2).setDepth(z.y - 0.5);
                continue;
            }
            if (z.flash > 0) { z.flash -= dt; if (z.flash <= 0) spr.setTint(z.def.tint); }
            z.atkCd -= dt;
            const dx = p.x - z.x, dy = p.y - z.y, dist = Math.hypot(dx, dy) || 1;
            let dir = { x: dx / dist, y: dy / dist };
            if (dist > 40 && !nav.lineClear(z.x, z.y, p.x, p.y, z.r * 0.9)) { const d = nav.dirToward(z.x, z.y); if (d) dir = d; }

            // separação entre zumbis
            let sx = 0, sy = 0;
            for (let j = 0; j < zs.length; j++) {
                if (j === i) continue; const o = zs[j];
                const ox = z.x - o.x, oy = z.y - o.y, m = z.r + o.r;
                if (Math.abs(ox) < m && Math.abs(oy) < m) { const d2 = Math.hypot(ox, oy) || 0.01; if (d2 < m) { sx += ox / d2 * (m - d2); sy += oy / d2 * (m - d2); } }
            }
            let vx = dir.x * z.speed + sx * 6 + z.kx, vy = dir.y * z.speed + sy * 6 + z.ky;
            const dk = Math.pow(0.0008, dt); z.kx *= dk; z.ky *= dk;
            if (dist < z.r + 14) { vx *= 0.15; vy *= 0.15; }
            nav.move(z, vx * dt, vy * dt, z.r);
            if (!nav.free(z.x, z.y, z.r)) { const q = nav.nearestFree(z.x, z.y); z.x = q.x; z.y = q.y; }

            // ataque
            if (dist < z.r + 22 && z.atkCd <= 0) {
                z.atkCd = 1.0; this.damagePlayer(z.dmg, z.x, z.y);
                if (z.face === 'down') spr.play('z_atk');
            }
            // animação
            const attacking = spr.anims.currentAnim?.key === 'z_atk' && spr.anims.isPlaying;
            if (!attacking) {
                let key;
                if (Math.abs(dir.x) > Math.abs(dir.y)) { key = 'z_side'; spr.setFlipX(dir.x > 0); z.face = 'side'; }
                else if (dir.y > 0) { key = 'z_down'; spr.setFlipX(false); z.face = 'down'; }
                else { key = 'z_up'; spr.setFlipX(false); z.face = 'up'; }
                if (spr.anims.currentAnim?.key !== key || !spr.anims.isPlaying) spr.play({ key, startFrame: Math.floor(Math.random() * 6) });
                spr.anims.timeScale = Math.max(0.5, z.speed / 52);
            }
            spr.setPosition(z.x, z.y).setDepth(z.y); z.shadow.setPosition(z.x, z.y - 2).setDepth(z.y - 0.5);
        }
    }

    killZombie(z) {
        const i = this.zombies.indexOf(z); if (i < 0) return;
        this.zombies.splice(i, 1); this.kills++;
        this.sfx.kill();
        z.spr.setTint(z.def.tint).setDepth(2).setAlpha(1); z.spr.play('z_death');
        this.tweens.add({ targets: [z.spr, z.shadow], alpha: 0, delay: 2200, duration: 700, onComplete: () => { z.spr.destroy(); z.shadow.destroy(); } });
        this.blood.explode(z.type === 'boss' ? 40 : 14, z.x, z.y - z.h * 0.4);
        this.dropGem(z.x, z.y, z.def.xp);
        if (z.type === 'boss') {
            this.spawnItem('chest', z.x, z.y); this.cameras.main.shake(400, 0.01);
            this.banner('CHEFE DERROTADO!', '#9ff0a8');
            for (let k = 0; k < 8; k++) this.dropGem(z.x + rnd(-40, 40), z.y + rnd(-30, 30), 5);
        } else {
            const r = Math.random();
            if (r < 0.03) this.spawnItem('heart', z.x, z.y);
            else if (r < 0.042) this.spawnItem('magnet', z.x, z.y);
            else if (r < 0.054) this.spawnItem('bomb', z.x, z.y);
        }
    }

    // ------------------------------------------------------------------ GEMAS / ITENS
    dropGem(x, y, v) {
        const img = this.add.image(x, y, 'gem').setDepth(3).setScale(0.1)
            .setTint(v >= 20 ? 0xff5ad8 : v >= 5 ? 0x6ee7ff : 0x7dff7d);
        this.tweens.add({ targets: img, scale: v >= 5 ? 1.5 : 1, duration: 200, ease: 'Back.easeOut' });
        this.gems.push({ x, y, v, img, magnet: this.magnetAll, spd: 200, t: Math.random() * 6 });
    }

    updateGems(dt) {
        const p = this.player, mr = this.S.magnet;
        for (let i = this.gems.length - 1; i >= 0; i--) {
            const g = this.gems[i], dx = p.x - g.x, dy = p.y - 20 - g.y, d = Math.hypot(dx, dy);
            if (!g.magnet && d < mr) g.magnet = true;
            if (g.magnet) { g.spd += 900 * dt; g.x += dx / d * g.spd * dt; g.y += dy / d * g.spd * dt; }
            else g.t += dt;
            g.img.setPosition(g.x, g.y + (g.magnet ? 0 : Math.sin(g.t * 4) * 2));
            if (d < 20) {
                this.gems.splice(i, 1); g.img.destroy(); this.sfx.pickup();
                this.xp += g.v * this.S.xpMul; this.checkLevel();
            }
        }
        if (this.magnetAll && !this.gems.length) this.magnetAll = false;
    }

    xpNeed() { return Math.floor(6 + this.level * 5 + Math.pow(this.level, 1.7)); }

    checkLevel() {
        let leveled = false;
        while (this.xp >= this.xpNeed()) { this.xp -= this.xpNeed(); this.level++; this.pending++; leveled = true; }
        if (leveled) {
            this.sfx.levelup();
            const p = this.player, r = this.add.image(p.x, p.y - 20, 'ring').setScale(0.2).setTint(0xffe27a).setDepth(p.y + 5);
            this.tweens.add({ targets: r, scale: 2.2, alpha: 0, duration: 600, onComplete: () => r.destroy() });
            this.sparks.explode(24, p.x, p.y - 30);
            if (!this.menu) this.openUpgrade();
        }
    }

    spawnItem(kind, x, y) {
        const pos = this.nav.free(x, y, 10) ? { x, y } : this.nav.nearestFree(x, y);
        const img = this.add.image(pos.x, pos.y - 10, kind).setDepth(4).setScale(kind === 'chest' ? 1.4 : 1.2);
        const glow = this.add.image(pos.x, pos.y - 10, 'soft').setDepth(3.9).setScale(1.4).setAlpha(0.45).setBlendMode('ADD')
            .setTint({ heart: 0xff5a6a, magnet: 0x66ccff, bomb: 0xffaa33, chest: 0xffe27a }[kind]);
        this.tweens.add({ targets: [img, glow], y: '-=6', duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.items.push({ kind, x: pos.x, y: pos.y, img, glow, life: kind === 'chest' ? 9999 : 14 });
    }

    updateItems(dt) {
        const p = this.player;
        for (let i = this.items.length - 1; i >= 0; i--) {
            const it = this.items[i]; it.life -= dt;
            if (it.life < 3) it.img.setAlpha(Math.floor(it.life * 8) % 2 ? 0.3 : 1);
            if (it.life <= 0) { this.removeItem(i); continue; }
            if (Math.hypot(p.x - it.x, p.y - it.y) < 28) { this.useItem(it.kind); this.removeItem(i); }
        }
    }
    removeItem(i) { const it = this.items[i]; this.tweens.killTweensOf([it.img, it.glow]); it.img.destroy(); it.glow.destroy(); this.items.splice(i, 1); }

    useItem(kind) {
        const p = this.player; this.sfx.item();
        if (kind === 'heart') this.heal(this.S.maxHp * 0.3);
        else if (kind === 'magnet') { this.magnetAll = true; this.gems.forEach(g => g.magnet = true); this.pop(p.x, p.y - 80, 'ÍMÃ!', '#66ccff', 28); }
        else if (kind === 'bomb') {
            this.sfx.boom(); this.cameras.main.shake(350, 0.012); this.cameras.main.flash(200, 255, 200, 100);
            const r = this.add.image(p.x, p.y - 10, 'ring').setScale(0.2).setTint(0xff9a33).setDepth(p.y + 5);
            this.tweens.add({ targets: r, scale: 4.5, alpha: 0, duration: 500, onComplete: () => r.destroy() });
            this.sparks.explode(40, p.x, p.y - 10);
            for (const z of this.zombies.slice()) {
                const d = Math.hypot(z.x - p.x, z.y - p.y);
                if (d < 280) this.hitZombie(z, 50 + this.wave * 10, Math.atan2(z.y - p.y, z.x - p.x), 2.5);
            }
        } else if (kind === 'chest') {
            this.heal(this.S.maxHp * 0.5); this.pending++; this.openUpgrade();
        }
    }

    // ------------------------------------------------------------------ PODERES AUTOMÁTICOS
    updatePowers(dt) {
        const p = this.player, S = this.S;
        // Redemoinho
        if (S.spin > 0) {
            this.spinT -= dt;
            if (this.spinT <= 0) { this.spinT = Math.max(2.5, 8 - S.spin * 1.1); this.swing(p.face, { spin: true }); }
        }
        // Facas
        if (S.knives > 0) {
            this.knifeT -= dt;
            if (this.knifeT <= 0) {
                let best = null, bd = 520;
                for (const z of this.zombies) { const d = Math.hypot(z.x - p.x, z.y - p.y); if (d < bd && z.spawnT <= 0) { bd = d; best = z; } }
                if (best) {
                    this.knifeT = 1.4;
                    const a0 = Math.atan2(best.y - z0(best) - (p.y - 26), best.x - p.x), n = S.knives;
                    for (let i = 0; i < n; i++) {
                        const a = a0 + (i - (n - 1) / 2) * 0.2;
                        const img = this.add.image(p.x, p.y - 26, 'knife').setRotation(a).setDepth(p.y + 4);
                        this.knives.push({ x: p.x, y: p.y - 26, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, img, life: 1.1, pierce: 1 + (S.knives > 3 ? 1 : 0) });
                    }
                    this.sfx.knife();
                } else this.knifeT = 0.2;
            }
        }
        // Aura de fogo
        this.aura.setVisible(S.fire > 0);
        if (S.fire > 0) {
            const rad = 58 + 14 * S.fire;
            this.aura.setPosition(p.x, p.y - 10).setDepth(p.y - 0.8).setScale(rad * 2 / 64 * (1 + Math.sin(this.elapsed * 6) * 0.04));
            this.fireT -= dt;
            if (this.fireT <= 0) {
                this.fireT = 0.45;
                for (const z of this.zombies.slice()) {
                    if (z.spawnT > 0) continue;
                    if (Math.hypot(z.x - p.x, z.y - p.y) < rad + z.r) {
                        this.hitZombie(z, 5 + 5 * S.fire + S.dmg * 0.15, Math.atan2(z.y - p.y, z.x - p.x), 0.2);
                        this.sparks.explode(2, z.x, z.y - z.h * 0.4);
                    }
                }
            }
        }
    }

    updateKnives(dt) {
        for (let i = this.knives.length - 1; i >= 0; i--) {
            const k = this.knives[i]; k.x += k.vx * dt; k.y += k.vy * dt; k.life -= dt;
            k.img.setPosition(k.x, k.y);
            let dead = k.life <= 0;
            for (const z of this.zombies.slice()) {
                if (z.spawnT > 0) continue;
                if (Math.hypot(z.x - k.x, z.y - z.h * 0.45 - k.y) < z.r + 12) {
                    this.hitZombie(z, this.S.dmg * 0.8, Math.atan2(k.vy, k.vx), 0.8); this.sfx.hit(false);
                    if (--k.pierce <= 0) { dead = true; break; }
                }
            }
            if (dead || k.x < 0 || k.y < 0 || k.x > 1280 || k.y > 1280) { k.img.destroy(); this.knives.splice(i, 1); }
        }
    }

    // ------------------------------------------------------------------ MENU DE UPGRADE
    openUpgrade() {
        if (this.menu || this.pending <= 0 || this.over) return;
        this.pending--;
        const pool = UPGRADES.filter(u => (this.lv[u.id] || 0) < u.max);
        if (!pool.length) { this.heal(this.S.maxHp * 0.25); return; }
        const choices = Phaser.Utils.Array.Shuffle(pool.slice()).slice(0, 3);
        this.setPaused(true);
        const objs = [], D = 2000, add = o => { objs.push(o); return o; };
        const T = (x, y, s, size, color = '#fff', ex = {}) => add(this.add.text(x, y, s, { fontFamily: FONT, fontSize: size + 'px', color, resolution: 2, align: 'center', ...ex }).setOrigin(0.5).setDepth(D + 2));
        add(this.add.rectangle(640, 640, 1280, 1280, 0x000000, 0.7).setDepth(D));
        T(640, 190, 'SUBIU DE NÍVEL!', 76, '#ffe27a', { stroke: '#3a2a00', strokeThickness: 10, fontStyle: 'bold' });
        T(640, 265, `Nível ${this.level} — escolha um upgrade (clique ou tecle 1, 2, 3)`, 30, '#dfe9f3');
        this.menu = { objs, choices };
        const W = 340, H = 430, gap = 40, x0 = 640 - (3 * W + 2 * gap) / 2;
        choices.forEach((u, i) => {
            const cx = x0 + i * (W + gap) + W / 2, cy = 640, lvl = this.lv[u.id] || 0;
            const g = add(this.add.graphics().setDepth(D + 1));
            const draw = hot => {
                g.clear().fillStyle(hot ? 0x2b3a55 : 0x1a2233, 1).fillRoundedRect(cx - W / 2, cy - H / 2, W, H, 22)
                    .lineStyle(hot ? 7 : 4, hot ? 0xffe27a : 0x6aa0ff, 1).strokeRoundedRect(cx - W / 2, cy - H / 2, W, H, 22);
            };
            draw(false);
            T(cx - W / 2 + 28, cy - H / 2 + 26, `[${i + 1}]`, 28, '#8fa6c4').setOrigin(0.5);
            T(cx, cy - 110, u.icon, 100);
            T(cx, cy + 0, u.name, 36, '#ffffff', { fontStyle: 'bold', wordWrap: { width: W - 40 } });
            T(cx, cy + 75, u.desc, 26, '#c9d4e0', { wordWrap: { width: W - 60 } });
            T(cx, cy + H / 2 - 60, '●'.repeat(lvl) + '◉' + '○'.repeat(u.max - lvl - 1), 24, '#ffe27a');
            T(cx, cy + H / 2 - 28, `Nv ${lvl} → ${lvl + 1}`, 24, '#9ff0a8');
            const zone = add(this.add.rectangle(cx, cy, W, H, 0xffffff, 0.001).setDepth(D + 3).setInteractive({ useHandCursor: true }));
            zone.on('pointerover', () => draw(true)); zone.on('pointerout', () => draw(false)); zone.on('pointerup', () => this.pick(i));
        });
        this.input.setDefaultCursor('default'); this.cross.setVisible(false);
    }

    pick(i) {
        if (!this.menu || !this.menu.choices[i]) return;
        const u = this.menu.choices[i];
        this.lv[u.id] = (this.lv[u.id] || 0) + 1;
        u.apply(this.S, this.lv[u.id], this);
        this.menu.objs.forEach(o => o.destroy()); this.menu = null;
        this.sfx.item(); this.setPaused(false);
        this.input.setDefaultCursor('none'); this.cross.setVisible(true);
        this.player.cd = 0.25;                       // evita ataque acidental por causa do clique
        if (this.pending > 0) this.time.delayedCall(250, () => this.openUpgrade());
    }

    // ------------------------------------------------------------------ HUD
    T(x, y, s, size, color = '#fff', ex = {}) {
        return this.add.text(x, y, s, { fontFamily: FONT, fontSize: size + 'px', color, stroke: '#000', strokeThickness: 5, resolution: 2, ...ex }).setDepth(1000);
    }

    buildHud() {
        this.hud = this.add.graphics().setDepth(1000);
        this.hpTxt = this.T(34, 44, '', 24, '#fff').setDepth(1001);
        this.lvTxt = this.T(24, 74, '', 26, '#ffe27a');
        this.timeTxt = this.T(640, 34, '', 38, '#fff', { fontStyle: 'bold' }).setOrigin(0.5, 0);
        this.waveTxt = this.T(1256, 30, '', 30, '#ffe27a').setOrigin(1, 0);
        this.killTxt = this.T(1256, 66, '', 26, '#dfe9f3').setOrigin(1, 0);
        this.dashTxt = this.T(24, 1236, '', 24, '#9fe8ff').setOrigin(0, 1);
        this.upTxt = this.T(1256, 1252, '', 22, '#c9d4e0', { align: 'right', lineSpacing: 2 }).setOrigin(1, 1);
        this.pauseTxt = this.T(640, 600, 'PAUSADO\nP / Esc: continuar     R: reiniciar', 52, '#fff', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5).setDepth(2100).setVisible(false);
        this.bannerTxt = this.T(640, 330, '', 84, '#ffe27a', { fontStyle: 'bold', strokeThickness: 10 }).setOrigin(0.5).setAlpha(0).setDepth(1500);
    }

    banner(text, color) {
        this.bannerTxt.setText(text).setColor(color).setAlpha(1).setScale(0.6);
        this.tweens.killTweensOf(this.bannerTxt);
        this.tweens.add({ targets: this.bannerTxt, scale: 1, duration: 300, ease: 'Back.easeOut' });
        this.tweens.add({ targets: this.bannerTxt, alpha: 0, delay: 1500, duration: 600 });
    }

    pop(x, y, txt, color = '#fff', size = 22) {
        const t = this.add.text(x, y, txt, { fontFamily: FONT, fontSize: size + 'px', color, stroke: '#000', strokeThickness: 5, resolution: 2, fontStyle: 'bold' }).setOrigin(0.5).setDepth(900);
        this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
    }

    drawHud() {
        const g = this.hud, p = this.player, S = this.S;
        g.clear();
        g.fillStyle(0x000000, 0.55).fillRect(0, 0, 1280, 18).fillStyle(0x4aa8ff, 1).fillRect(0, 0, 1280 * Math.min(1, this.xp / this.xpNeed()), 18);
        g.fillStyle(0x000000, 0.7).fillRoundedRect(24, 32, 330, 36, 10);
        const r = Phaser.Math.Clamp(p.hp / S.maxHp, 0, 1);
        g.fillStyle(r > 0.35 ? 0xd9304a : 0xff2a2a, 1).fillRoundedRect(28, 36, 322 * r, 28, 8);
        this.hpTxt.setText(`${Math.ceil(p.hp)} / ${S.maxHp}`);
        this.lvTxt.setText(`Nível ${this.level}`);
        this.timeTxt.setText(fmt(this.elapsed));
        this.waveTxt.setText(`Onda ${this.wave}  (${Math.max(0, Math.ceil(this.waveTimer))}s)`);
        this.killTxt.setText(`☠ ${this.kills}`);
        this.dashTxt.setText(p.dashCd > 0 ? `Esquiva: ${p.dashCd.toFixed(1)}s` : 'Esquiva: PRONTA (Shift)');
        this.upTxt.setText(UPGRADES.filter(u => this.lv[u.id]).map(u => `${u.icon} ${u.name} ${this.lv[u.id]}`).join('\n'));
        const low = 0.4 - r;
        this.redVig.setAlpha(low > 0 ? Math.min(1, low / 0.4) * (0.55 + Math.sin(this.time.now / 160) * 0.2) : 0);
        // barra de vida dos zumbis fortes
        for (const z of this.zombies) if (z.type !== 'walker' && z.type !== 'runner' && z.spawnT <= 0) {
            const w = z.type === 'boss' ? 120 : 50, y = z.y - z.h - 8;
            g.fillStyle(0x000000, 0.7).fillRect(z.x - w / 2 - 1, y - 1, w + 2, 8).fillStyle(0xc03030, 1).fillRect(z.x - w / 2, y, w * Math.max(0, z.hp / z.maxHp), 6);
        }
    }
}

const z0 = z => z.h * 0.45;
