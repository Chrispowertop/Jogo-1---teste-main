import * as Phaser from 'phaser';
import { FONT } from './Preloader';

export class GameOver extends Phaser.Scene {
    constructor() { super('GameOver'); }

    init(data) { this.res = { time: '0:00', kills: 0, wave: 1, level: 1, ...data }; }

    create() {
        const r = this.res;
        this.add.image(640, 640, 'tiles').setTint(0x442222);
        this.add.rectangle(640, 640, 1280, 1280, 0x120406, 0.7);
        this.add.image(640, 640, 'redvig').setDisplaySize(1280, 1280).setAlpha(0.7);
        const T = (x, y, s, size, color = '#fff', extra = {}) =>
            this.add.text(x, y, s, { fontFamily: FONT, fontSize: size + 'px', color, resolution: 2, align: 'center', ...extra }).setOrigin(0.5);

        T(640, 250, 'VOCÊ MORREU', 110, '#ff4d5a', { stroke: '#2a0004', strokeThickness: 14, fontStyle: 'bold' });
        T(640, 470, `Tempo sobrevivido:  ${r.time}\nOnda alcançada:  ${r.wave}\nZumbis abatidos:  ${r.kills}\nNível:  ${r.level}`, 46, '#f1f5f9', { lineSpacing: 18 });
        if (r.newBest) T(640, 640, '★ NOVO RECORDE! ★', 46, '#ffe27a', { fontStyle: 'bold' });

        const mkBtn = (y, label, color, fn) => {
            const b = this.add.rectangle(640, y, 480, 84, color).setStrokeStyle(5, 0xffffff, 0.8).setInteractive({ useHandCursor: true });
            T(640, y, label, 40, '#fff', { fontStyle: 'bold' });
            b.on('pointerover', () => b.setAlpha(0.8)); b.on('pointerout', () => b.setAlpha(1)); b.on('pointerup', fn);
        };
        const again = () => this.scene.start('Game'), menu = () => this.scene.start('MainMenu');
        mkBtn(800, 'Jogar de novo (Enter)', 0xb3202c, again);
        mkBtn(910, 'Menu (M)', 0x34495e, menu);
        this.input.keyboard.once('keydown-ENTER', again);
        this.input.keyboard.once('keydown-R', again);
        this.input.keyboard.once('keydown-M', menu);
        this.cameras.main.fadeIn(600);
    }
}
