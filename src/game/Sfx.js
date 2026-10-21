// Efeitos sonoros sintetizados via WebAudio (nenhum arquivo de áudio necessário).
export class Sfx {
    constructor(scene) {
        this.ctx = scene.sound && scene.sound.context ? scene.sound.context : null;
        this.vol = 0.5; this.last = {};
    }
    ok(key, ms) {
        if (!this.ctx || this.ctx.state !== 'running') return false;
        const n = performance.now();
        if (key && this.last[key] && n - this.last[key] < ms) return false;
        if (key) this.last[key] = n;
        return true;
    }
    tone(f, d = 0.12, type = 'square', v = 0.15, slide = 0, delay = 0) {
        const c = this.ctx, t = c.currentTime + delay;
        const o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
        g.gain.setValueAtTime(v * this.vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
        o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.02);
    }
    noise(d = 0.1, v = 0.2, freq = 1200, type = 'highpass') {
        const c = this.ctx, n = Math.floor(c.sampleRate * d), b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0);
        for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        s.buffer = b; f.type = type; f.frequency.value = freq; g.gain.value = v * this.vol;
        s.connect(f); f.connect(g); g.connect(c.destination); s.start();
    }
    swing(heavy) { if (!this.ok('swing', 60)) return; this.noise(heavy ? 0.22 : 0.14, 0.22, heavy ? 700 : 1400); this.tone(heavy ? 160 : 260, 0.1, 'sawtooth', 0.05, -90); }
    hit(crit)    { if (!this.ok('hit', 35)) return; this.tone(crit ? 220 : 120, 0.1, 'square', 0.14, -60); this.noise(0.08, 0.2, 500, 'lowpass'); if (crit) this.tone(880, 0.08, 'triangle', 0.1, 400); }
    kill()       { if (!this.ok('kill', 50)) return; this.tone(90, 0.18, 'sawtooth', 0.12, -50); }
    pickup()     { if (!this.ok('pickup', 40)) return; this.tone(660, 0.07, 'sine', 0.1, 330); }
    item()       { if (!this.ok()) return; this.tone(520, 0.1, 'triangle', 0.14, 0); this.tone(780, 0.14, 'triangle', 0.14, 0, 0.09); }
    hurt()       { if (!this.ok('hurt', 120)) return; this.tone(200, 0.25, 'sawtooth', 0.2, -140); this.noise(0.15, 0.2, 400, 'lowpass'); }
    dash()       { if (!this.ok()) return; this.noise(0.18, 0.18, 2500); }
    knife()      { if (!this.ok('knife', 50)) return; this.tone(900, 0.07, 'triangle', 0.07, -500); }
    boom()       { if (!this.ok()) return; this.noise(0.5, 0.45, 300, 'lowpass'); this.tone(80, 0.4, 'sawtooth', 0.2, -50); }
    levelup()    { if (!this.ok()) return; [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'square', 0.1, 0, i * 0.08)); }
    wave()       { if (!this.ok()) return; this.tone(110, 0.6, 'sawtooth', 0.18, -30); this.tone(82, 0.8, 'sawtooth', 0.14, -20, 0.2); }
    death()      { if (!this.ok()) return; this.tone(300, 0.9, 'sawtooth', 0.2, -250); }
    click()      { if (!this.ok()) return; this.tone(440, 0.05, 'square', 0.08); }
}
