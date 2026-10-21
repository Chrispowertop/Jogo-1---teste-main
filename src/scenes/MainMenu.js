import * as Phaser from 'phaser';
import { FONT } from './Preloader';
import { Sfx } from '../game/Sfx';

export class MainMenu extends Phaser.Scene {
    constructor() { super('MainMenu'); }

    create() {
        this.add.image(640, 640, 'tiles').setTint(0x667788);
        this.add.rectangle(640, 640, 1280, 1280, 0x05070c, 0.55);
        this.add.image(640, 640, 'vignette').setDisplaySize(1280, 1280);
        const T = (x, y, s, size, color = '#fff', extra = {}) =>
            this.add.text(x, y, s, { fontFamily: FONT, fontSize: size + 'px', color, resolution: 2, align: 'center', ...extra }).setOrigin(0.5);

        // decoração: herói encarando zumbis
        const hero = this.add.sprite(520, 800, 'player', 0).setOrigin(0.5, 0.97).setScale(2.6);
        const zs = [[820, 800], [930, 830], [1030, 790]].map(([x, y], i) =>
            this.add.sprite(x, y, 'zombie', 0).setOrigin(0.5, 0.97).setScale(2.4).setFlipX(false).play({ key: 'z_side', startFrame: i * 3 }));
        zs.forEach(z => z.anims.timeScale = 0.5);
        this.tweens.add({ targets: hero, scaleY: 2.65, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.add.image(670, 735, 'sword').setScale(2.4).setRotation(0.9).setOrigin(0.5, 0.9);

        const title = T(640, 230, 'ARENA DOS MORTOS', 96, '#ffe27a', { stroke: '#3a0a0a', strokeThickness: 12, fontStyle: 'bold' });
        this.tweens.add({ targets: title, y: 242, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        T(640, 330, 'Sobreviva o máximo que puder. Corte, esquive e evolua!', 32, '#dfe9f3');

        const btn = this.add.rectangle(640, 480, 420, 96, 0xb3202c).setStrokeStyle(6, 0xffd6d9).setInteractive({ useHandCursor: true });
        const bt = T(640, 480, 'JOGAR', 52, '#fff', { fontStyle: 'bold' });
        btn.on('pointerover', () => btn.setFillStyle(0xe03342));
        btn.on('pointerout', () => btn.setFillStyle(0xb3202c));
        this.tweens.add({ targets: [btn, bt], scale: 1.05, duration: 700, yoyo: true, repeat: -1 });
        const start = () => { new Sfx(this).click(); this.cameras.main.fadeOut(300); this.time.delayedCall(300, () => this.scene.start('Game')); };
        btn.on('pointerup', start);
        this.input.keyboard.once('keydown-ENTER', start);
        this.input.keyboard.once('keydown-SPACE', start);

        const best = JSON.parse(localStorage.getItem('arena_best') || 'null');
        if (best) T(640, 575, `Recorde: ${best.time} • Onda ${best.wave} • ${best.kills} abates`, 28, '#9ff0a8');

        T(640, 1040,
            'WASD / Setas: mover      Mouse (segurar) / Espaço / J: atacar com a espada\n' +
            'Shift / K: esquiva      P / Esc: pausar      1-2-3: escolher upgrade\n' +
            'Colete as gemas dos zumbis para subir de nível. A cada 5 ondas surge um CHEFE!', 27, '#c9d4e0', { lineSpacing: 12 });
        this.cameras.main.fadeIn(400);
    }
}
