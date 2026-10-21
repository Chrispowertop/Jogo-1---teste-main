import * as Phaser from 'phaser';

import tilesImg from '../../assets/c4026048-0830-44e8-baf0-74045a37362c.png';
import objectsImg from '../../assets/b8f2bb3b-fb48-4515-b115-84d2e2b9460d.png';
import mapJson from '../../assets/map.json?url';
import playerImg from '../../assets/player.png';
import zombieImg from '../../assets/zombie.png';
import collisionJson from '../../assets/collision.json?url';

export const FONT = 'Trebuchet MS, Verdana, sans-serif';

export class Preloader extends Phaser.Scene {
    constructor() { super('Preloader'); }

    preload() {
        const bar = this.add.graphics();
        this.add.text(640, 600, 'Carregando...', { fontFamily: FONT, fontSize: '36px', color: '#fff', resolution: 2 }).setOrigin(0.5);
        this.load.on('progress', v => {
            bar.clear().fillStyle(0x222222).fillRect(340, 650, 600, 24).fillStyle(0x6ee7ff).fillRect(344, 654, 592 * v, 16);
        });
        this.load.image('tiles', tilesImg);
        this.load.image('objects', objectsImg);
        this.load.tilemapTiledJSON('map', mapJson);
        this.load.json('collision', collisionJson);
        this.load.spritesheet('player', playerImg, { frameWidth: 96, frameHeight: 96 });
        this.load.spritesheet('zombie', zombieImg, { frameWidth: 96, frameHeight: 96 });
    }

    create() {
        this.makeTextures();
        const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
        const A = (key, frames, rate, repeat = -1, tex = 'player') =>
            this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex, { frames }), frameRate: rate, repeat });
        A('p_down', range(0, 5), 10);
        A('p_up', [6, 7, 8, 7], 8);
        A('p_side', range(10, 19), 18);
        A('p_death', [36, 37, 39, 38, 40, 41], 7, 0);
        A('z_down', range(0, 10), 9, -1, 'zombie');
        A('z_side', range(11, 21), 9, -1, 'zombie');   // frames viradas para a ESQUERDA
        A('z_up', range(22, 32), 9, -1, 'zombie');
        A('z_atk', range(44, 49), 16, 0, 'zombie');
        A('z_death', [50, 51, 52], 7, 0, 'zombie');
        this.scene.start('MainMenu');
    }

    // Todas as texturas extras (espada, gemas, itens, partículas...) são desenhadas por código.
    makeTextures() {
        const mk = (key, w, h, fn) => {
            const t = this.textures.createCanvas(key, w, h), c = t.getContext();
            fn(c, w, h); t.refresh();
        };
        const grad = (c, x0, y0, x1, y1, stops) => {
            const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g;
        };
        mk('px', 4, 4, c => { c.fillStyle = '#fff'; c.fillRect(0, 0, 4, 4); });
        mk('soft', 64, 64, c => {
            const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
            g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g; c.fillRect(0, 0, 64, 64);
        });
        mk('shadow', 56, 20, c => {
            c.translate(28, 10); c.scale(1, 0.36);
            const g = c.createRadialGradient(0, 0, 0, 0, 0, 28);
            g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle = g; c.beginPath(); c.arc(0, 0, 28, 0, Math.PI * 2); c.fill();
        });
        mk('sword', 20, 96, c => {
            c.lineJoin = 'round'; c.lineWidth = 1.5; c.strokeStyle = '#26303d';
            c.fillStyle = grad(c, 5, 0, 15, 0, [[0, '#8fa3b8'], [0.5, '#ffffff'], [1, '#8195aa']]);
            c.beginPath(); c.moveTo(10, 1); c.lineTo(15, 10); c.lineTo(15, 62); c.lineTo(5, 62); c.lineTo(5, 10); c.closePath(); c.fill(); c.stroke();
            c.strokeStyle = '#c8d6e5'; c.beginPath(); c.moveTo(10, 8); c.lineTo(10, 60); c.stroke();
            c.fillStyle = '#e0b13a'; c.strokeStyle = '#6b4a0f'; c.fillRect(1, 62, 18, 5); c.strokeRect(1, 62, 18, 5);
            c.fillStyle = '#6b3f1f'; c.fillRect(8, 67, 4, 19);
            c.fillStyle = '#e0b13a'; c.beginPath(); c.arc(10, 89, 4, 0, 7); c.fill(); c.stroke();
        });
        mk('slash', 160, 160, c => {
            const a = 1.35, ex = 80 + 76 * Math.cos(a), ey = 80 + 76 * Math.sin(a);
            const cx2 = 52, r2 = Math.hypot(ex - cx2, ey - 80), a2 = Math.atan2(ey - 80, ex - cx2);
            const g = c.createRadialGradient(80, 80, 30, 80, 80, 78);
            g.addColorStop(0, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,1)');
            c.fillStyle = g; c.beginPath(); c.arc(80, 80, 76, -a, a, false); c.arc(cx2, 80, r2, a2, -a2, true); c.closePath(); c.fill();
        });
        mk('ring', 160, 160, c => {
            c.strokeStyle = '#fff'; c.lineWidth = 8; c.shadowColor = '#fff'; c.shadowBlur = 12;
            c.beginPath(); c.arc(80, 80, 68, 0, Math.PI * 2); c.stroke();
        });
        mk('gem', 16, 20, c => {
            c.fillStyle = '#fff'; c.beginPath(); c.moveTo(8, 1); c.lineTo(15, 9); c.lineTo(8, 19); c.lineTo(1, 9); c.closePath(); c.fill();
            c.fillStyle = '#c9c9c9'; c.beginPath(); c.moveTo(8, 1); c.lineTo(8, 19); c.lineTo(1, 9); c.closePath(); c.fill();
            c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1; c.stroke();
        });
        mk('heart', 24, 22, c => {
            c.fillStyle = '#e83a4f'; c.strokeStyle = '#fff'; c.lineWidth = 2;
            c.beginPath(); c.moveTo(12, 20); c.bezierCurveTo(-4, 8, 4, -2, 12, 6); c.bezierCurveTo(20, -2, 28, 8, 12, 20); c.fill(); c.stroke();
            c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(7, 7, 2.5, 0, 7); c.fill();
        });
        mk('magnet', 24, 24, c => {
            c.lineWidth = 6; c.strokeStyle = '#d6303c'; c.beginPath(); c.moveTo(4, 3); c.lineTo(4, 13); c.arc(12, 13, 8, Math.PI, 0, true); c.lineTo(20, 3); c.stroke();
            c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(4, 3); c.lineTo(4, 7); c.moveTo(20, 3); c.lineTo(20, 7); c.stroke();
        });
        mk('bomb', 24, 26, c => {
            c.fillStyle = '#222'; c.strokeStyle = '#000'; c.lineWidth = 1.5; c.beginPath(); c.arc(12, 15, 9, 0, 7); c.fill(); c.stroke();
            c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(9, 12, 3, 0, 7); c.fill();
            c.strokeStyle = '#a0763c'; c.lineWidth = 2; c.beginPath(); c.moveTo(14, 7); c.quadraticCurveTo(18, 2, 21, 4); c.stroke();
            c.fillStyle = '#ffb02e'; c.beginPath(); c.arc(21, 4, 2.5, 0, 7); c.fill();
        });
        mk('chest', 36, 28, c => {
            c.fillStyle = '#7a4a22'; c.strokeStyle = '#2b1808'; c.lineWidth = 2; c.fillRect(2, 8, 32, 18); c.strokeRect(2, 8, 32, 18);
            c.beginPath(); c.moveTo(2, 10); c.quadraticCurveTo(18, -4, 34, 10); c.fill(); c.stroke();
            c.fillStyle = '#f2c14e'; c.fillRect(2, 14, 32, 4); c.fillRect(15, 12, 6, 9);
        });
        mk('knife', 28, 8, c => {
            c.fillStyle = '#dfe9f3'; c.strokeStyle = '#26303d'; c.lineWidth = 1;
            c.beginPath(); c.moveTo(28, 4); c.lineTo(10, 1); c.lineTo(10, 7); c.closePath(); c.fill(); c.stroke();
            c.fillStyle = '#6b3f1f'; c.fillRect(0, 2, 10, 4);
        });
        mk('cross', 28, 28, c => {
            c.strokeStyle = '#fff'; c.lineWidth = 2; c.shadowColor = '#000'; c.shadowBlur = 3;
            c.beginPath(); c.arc(14, 14, 8, 0, 7); c.moveTo(14, 1); c.lineTo(14, 6); c.moveTo(14, 22); c.lineTo(14, 27); c.moveTo(1, 14); c.lineTo(6, 14); c.moveTo(22, 14); c.lineTo(27, 14); c.stroke();
        });
        const vig = (key, rgb, a) => mk(key, 256, 256, c => {
            const g = c.createRadialGradient(128, 128, 70, 128, 128, 182);
            g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(1, `rgba(${rgb},${a})`);
            c.fillStyle = g; c.fillRect(0, 0, 256, 256);
        });
        vig('vignette', '0,0,0', 0.55); vig('redvig', '200,0,0', 0.75);
    }
}
