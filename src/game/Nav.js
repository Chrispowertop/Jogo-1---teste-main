// Colisão por tiles (mar + objetos sólidos) e campo de fluxo (BFS) para os zumbis desviarem de obstáculos.
const TS = 32;
export class Nav {
    constructor(map, objLayer, col) {
        this.w = map.width; this.h = map.height;
        this.blocked = new Uint8Array(this.w * this.h);
        const solid = new Set(col.solidGids);
        const data = objLayer.layer.data;
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
            const i = y * this.w + x, t = data[y][x];
            this.blocked[i] = (col.ocean[i] || (t && t.index > 0 && solid.has(t.index))) ? 1 : 0;
        }
        this.dist = new Int16Array(this.w * this.h).fill(-1);
        this.queue = new Int32Array(this.w * this.h);
        this.spawnTiles = [];
        for (let y = 1; y < this.h - 1; y++) for (let x = 1; x < this.w - 1; x++)
            if (this.free(x * TS + 16, y * TS + 16, 13)) this.spawnTiles.push({ x: x * TS + 16, y: y * TS + 16 });
    }
    tileBlocked(tx, ty) {
        return tx < 0 || ty < 0 || tx >= this.w || ty >= this.h || this.blocked[ty * this.w + tx] === 1;
    }
    free(x, y, r) {
        const ry = r * 0.6;
        return !(this.tileBlocked((x - r) / TS | 0, (y - ry) / TS | 0) || this.tileBlocked((x + r) / TS | 0, (y - ry) / TS | 0) ||
                 this.tileBlocked((x - r) / TS | 0, (y + ry) / TS | 0) || this.tileBlocked((x + r) / TS | 0, (y + ry) / TS | 0));
    }
    move(e, dx, dy, r) {
        if (dx && this.free(e.x + dx, e.y, r)) e.x += dx;
        if (dy && this.free(e.x, e.y + dy, r)) e.y += dy;
    }
    nearestFree(x, y) {
        const tx = x / TS | 0, ty = y / TS | 0;
        for (let k = 0; k < 8; k++) for (let j = -k; j <= k; j++) for (let i = -k; i <= k; i++) {
            if (Math.max(Math.abs(i), Math.abs(j)) !== k) continue;
            const cx = tx + i, cy = ty + j;
            if (!this.tileBlocked(cx, cy) && this.free(cx * TS + 16, cy * TS + 16, 12)) return { x: cx * TS + 16, y: cy * TS + 16 };
        }
        return { x, y };
    }
    lineClear(ax, ay, bx, by, r) {
        const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 10);
        for (let i = 1; i < n; i++) { const t = i / n; if (!this.free(ax + (bx - ax) * t, ay + (by - ay) * t, r)) return false; }
        return true;
    }
    // BFS a partir do tile do jogador
    computeField(px, py) {
        this.dist.fill(-1);
        let sx = px / TS | 0, sy = py / TS | 0;
        if (this.tileBlocked(sx, sy)) { const q = this.nearestFree(px, py); sx = q.x / TS | 0; sy = q.y / TS | 0; }
        let head = 0, tail = 0;
        this.queue[tail++] = sy * this.w + sx; this.dist[sy * this.w + sx] = 0;
        while (head < tail) {
            const c = this.queue[head++], cx = c % this.w, cy = c / this.w | 0, cd = this.dist[c];
            for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
                if (!i && !j) continue;
                const nx = cx + i, ny = cy + j;
                if (this.tileBlocked(nx, ny)) continue;
                if (i && j && (this.tileBlocked(cx + i, cy) || this.tileBlocked(cx, cy + j))) continue;
                const ni = ny * this.w + nx;
                if (this.dist[ni] !== -1) continue;
                this.dist[ni] = cd + 1; this.queue[tail++] = ni;
            }
        }
    }
    // direção (unitária) do próximo tile em direção ao jogador, ou null
    dirToward(x, y) {
        const tx = x / TS | 0, ty = y / TS | 0;
        if (this.tileBlocked(tx, ty)) return null;
        let best = this.dist[ty * this.w + tx], bx = tx, by = ty;
        if (best < 0) return null;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
            if (!i && !j) continue;
            const nx = tx + i, ny = ty + j;
            if (this.tileBlocked(nx, ny)) continue;
            if (i && j && (this.tileBlocked(tx + i, ty) || this.tileBlocked(tx, ty + j))) continue;
            const d = this.dist[ny * this.w + nx];
            if (d >= 0 && d < best) { best = d; bx = nx; by = ny; }
        }
        if (bx === tx && by === ty) return null;
        const vx = bx * TS + 16 - x, vy = by * TS + 16 - y, l = Math.hypot(vx, vy) || 1;
        return { x: vx / l, y: vy / l };
    }
}
