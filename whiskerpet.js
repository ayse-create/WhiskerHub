/* ==========================================================
   WhiskerPet v2 – WhiskerHub kedisi
   - Normal mod: pürüzsüz (vektör) kedi, yumak, mama kabı ve sahne
   - Piksel modu (header'daki "Piksel" butonu): piksel art sprite'lar,
     kartlar ve emojiler de pikselleştirilir
   - Tek bir durum makinesi: idle | walking | sleeping | playing | eating | reacting
   - Kütüphane yok, her şey kodla çizilir
   ========================================================== */
(() => {
    'use strict';

    const root = document.getElementById('whiskerpet');
    if (!root) return;

    const canvas   = document.getElementById('wpCanvas');
    const ctx      = canvas.getContext('2d');
    const feedBtn  = document.getElementById('wpFeedBtn');
    const yarnSrc  = document.getElementById('wpYarnSrc');
    const yarnIcon = document.getElementById('wpYarnIcon');
    const bowlIcon = document.getElementById('wpBowlIcon');
    const pixelBtn = document.getElementById('pixelToggle');
    const pixelTxt = document.getElementById('pixelText');

    /* ---------------------------------------------------- yardımcılar */
    const TAU   = Math.PI * 2;
    const rand  = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const rnd   = Math.round;

    function hash(n) {
        n = (n ^ 61) ^ (n >>> 16);
        n = n + (n << 3);
        n = n ^ (n >>> 4);
        n = Math.imul(n, 0x27d4eb2d);
        n = n ^ (n >>> 15);
        return n >>> 0;
    }

    /* ---------------------------------------------------- renkler */
    const C = {
        k: '#3b2f4f',   // piksel dış çizgi
        b: '#f2b880',   // gövde
        d: '#d98f4e',   // çizgiler / uzak bacaklar
        w: '#fff4e6',   // beyaz (patiler, karın)
        p: '#ff9ec7',   // pembe (burun, kulak içi)
        e: '#2a2140',   // göz
        wh: '#6a5a8a',  // bıyık
        yarn: '#ff7eb6',
        yarnL: '#ffc7e0',
        bowl: '#8fd3ff',
        bowlL: '#cfefff',
        kib: '#a8643a',
        kibL: '#c98652',
        heart: '#ff6b9d',
        bang: '#ff5c8a',
        soft: '#a3673a',   // pürüzsüz mod dış çizgi
        far: '#e2a672'     // pürüzsüz mod uzak bacak
    };

    const THEMES = {
        light: { ground: '#d8c7ff', ground2: '#c7b2fa', line: '#a98cf0', dots: '#c3a9f6', tuft: '#9fdcb0', z: '#7a55d8', shadow: 0.18 },
        dark:  { ground: '#17122e', ground2: '#0e0a20', line: '#3d3166', dots: '#221a42', tuft: '#2e6b57', z: '#d8c7ff', shadow: 0.38 }
    };
    let isDark = false;
    let theme = THEMES.light;
    let pixelMode = document.body.classList.contains('pixel-mode');

    function readTheme() {
        isDark = document.body.classList.contains('dark-mode');
        theme = isDark ? THEMES.dark : THEMES.light;
    }

    /* ==========================================================
       PİKSEL ÇİZİM
       ========================================================== */
    function drawRows(g, rows, x, y, map) {
        for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
                const col = map[rows[r][c]];
                if (!col) continue;
                g.fillStyle = col;
                g.fillRect(x + c, y + r, 1, 1);
            }
        }
    }

    const YARN  = ['..kkk..', '.kyyyk.', 'kyyyyyk', 'kyyyyyk', 'kyyyyyk', '.kyyyk.', '..kkk..'];
    const BOWL  = ['.kkkkkkkkkk.', 'kllllllllllk', 'kbbbbppbbbbk', '.kbbbbbbbbk.', '..kkkkkkkk..'];
    const HEART = ['.kk.kk.', 'kppkppk', 'kpppppk', '.kpppk.', '..kpk..', '...k...'];
    const ZGLYPH = ['###', '..#', '.#.', '#..', '###'];

    function drawYarnP(g, x, y, rot) {
        drawRows(g, YARN, x, y, { k: C.k, y: C.yarn });
        const cs = Math.cos(rot), sn = Math.sin(rot);
        g.fillStyle = C.yarnL;
        for (const s of [-1.6, 1.6]) {
            for (let t = -3; t <= 3; t += 0.5) {
                const px = rnd(3 - s * sn + t * cs);
                const py = rnd(3 + s * cs + t * sn);
                if (px >= 0 && px < 7 && py >= 0 && py < 7 && YARN[py][px] === 'y') {
                    g.fillRect(x + px, y + py, 1, 1);
                }
            }
        }
    }

    function drawBowlP(g, x, y, food) {
        drawRows(g, BOWL, x, y, { k: C.k, l: C.bowlL, b: C.bowl, p: C.p });
        const lvl = Math.ceil(food * 3 - 1e-6);
        const kib = (dx, dy) => {
            g.fillStyle = ((dx + dy) & 1) ? C.kib : C.kibL;
            g.fillRect(x + dx, y + dy, 1, 1);
        };
        if (lvl === 1) for (let i = 4; i <= 7; i++) kib(i, -1);
        if (lvl === 2) for (let i = 3; i <= 8; i++) kib(i, -1);
        if (lvl >= 3) {
            for (let i = 2; i <= 9; i++) kib(i, -1);
            for (let i = 4; i <= 7; i++) kib(i, -2);
        }
    }

    // ---- piksel kedi pozları (şekil listeleri)
    function head(hx, hy, eyes, mouth) {
        const sh = [[hx, hy, 8, 7, C.b], [hx, hy - 2, 2, 2, C.b], [hx + 6, hy - 2, 2, 2, C.b]];
        const dt = [
            [hx + 1, hy - 1, 1, 1, C.p], [hx + 6, hy - 1, 1, 1, C.p],
            [hx + 3, hy, 1, 2, C.d], [hx + 5, hy, 1, 2, C.d]
        ];
        if (eyes === 'open') {
            dt.push([hx + 3, hy + 2, 1, 2, C.e], [hx + 6, hy + 2, 1, 2, C.e]);
        } else if (eyes === 'closed') {
            dt.push([hx + 3, hy + 3, 2, 1, C.e], [hx + 6, hy + 3, 2, 1, C.e]);
        } else { // mutlu ^ ^
            dt.push([hx + 1, hy + 3, 1, 1, C.e], [hx + 2, hy + 2, 1, 1, C.e], [hx + 3, hy + 3, 1, 1, C.e],
                    [hx + 5, hy + 3, 1, 1, C.e], [hx + 6, hy + 2, 1, 1, C.e], [hx + 7, hy + 3, 1, 1, C.e]);
        }
        dt.push([hx + 5, hy + 4, 3, 2, C.w], [hx + 7, hy + 4, 1, 1, C.p]);
        if (mouth) dt.push([hx + 5, hy + 6, 3, 1, C.e]);
        dt.push([hx + 8, hy + 4, 2, 1, C.wh], [hx + 8, hy + 6, 2, 1, C.wh]); // bıyıklar
        return { sh, dt };
    }

    const LEGS = [
        { x: -7, o: 0.5, far: 1 }, { x: -4, o: 0, far: 0 },
        { x: 1,  o: 0,   far: 1 }, { x: 3,  o: 0.5, far: 0 }
    ];

    function legs(sh, dt, f, mode, skip) {
        for (let i = 0; i < 4; i++) {
            if (i === skip) continue;
            const L = LEGS[i];
            let dx = 0, lift = 0;
            if (mode === 'walk') {
                const p = ((f / 4) + L.o) % 1;
                if (p < 0.5) dx = rnd(1 - 4 * p);
                else { dx = rnd(-1 + 4 * (p - 0.5)); lift = p < 0.7 ? 1 : 2; }
            } else if (mode === 'air') {
                lift = 1;
            }
            const h = Math.max(1, 3 - lift);
            sh.push([L.x + dx, -3, 2, h, L.far ? C.d : C.b]);
            dt.push([L.x + dx, -3 + h - 1, 2, 1, C.w]);
        }
    }

    function body(sh, dt) {
        sh.push([-8, -9, 13, 6, C.b]);
        dt.push([-7, -4, 11, 1, C.w], [-6, -9, 1, 2, C.d], [-3, -9, 1, 2, C.d], [0, -9, 1, 2, C.d]);
    }

    function tailUp(sh, dt, tw) {
        sh.push([-11 + tw, -13, 2, 6, C.b], [-10, -8, 3, 2, C.b]);
        dt.push([-11 + tw, -13, 2, 2, C.d]);
    }

    function merge(sh, dt, h) { sh.push(...h.sh); dt.push(...h.dt); }

    function poseWalk(f, mode, eyes, tw) {
        const sh = [], dt = [];
        tailUp(sh, dt, tw);
        legs(sh, dt, f, mode);
        body(sh, dt);
        merge(sh, dt, head(3, -13, eyes, false));
        return { sh, dt };
    }

    function poseSit(sw, eyes) {
        const sh = [], dt = [];
        sh.push([-12, -2, 5, 2, C.b], [-13, -5 - sw, 2, 4 + sw, C.b]);
        dt.push([-13, -5 - sw, 2, 1, C.d]);
        sh.push([-8, -4, 4, 4, C.b], [-6, -8, 9, 8, C.b], [1, -5, 2, 5, C.b]);
        dt.push([-5, -8, 1, 2, C.d], [-2, -8, 1, 2, C.d], [-7, -4, 1, 2, C.d], [1, -1, 2, 1, C.w], [2, -7, 1, 3, C.w]);
        merge(sh, dt, head(-1, -14, eyes, false));
        return { sh, dt };
    }

    function poseSleep(br) {
        const sh = [], dt = [];
        sh.push([-11, -4, 3, 4, C.b], [-9, -6, 18, 6, C.b], [-7, -7, 14, 1, C.b]);
        if (br) sh.push([-5, -8, 10, 1, C.b]);
        dt.push([-6, -7, 1, 2, C.d], [-2, -7, 1, 2, C.d], [2, -7, 1, 2, C.d]);
        merge(sh, dt, head(4, -9, 'closed', false));
        sh.push([8, -2, 5, 2, C.w]);
        return { sh, dt };
    }

    function poseEat(hy, mouth, tw) {
        const sh = [], dt = [];
        tailUp(sh, dt, tw);
        legs(sh, dt, 0, 'stand');
        body(sh, dt);
        sh.push([4, -9, 4, 6, C.b]);
        merge(sh, dt, head(6, hy, 'happy', mouth));
        return { sh, dt };
    }

    function poseSwat(t, tw) {
        const sh = [], dt = [];
        tailUp(sh, dt, tw);
        legs(sh, dt, 0, 'stand', 3);
        body(sh, dt);
        if (t >= 0.18 && t < 0.34) {
            sh.push([4, -6, 7, 2, C.b]);
            dt.push([9, -6, 2, 2, C.w]);
        } else {
            sh.push([3, -7, 2, 4, C.b]);
            dt.push([3, -7, 2, 1, C.w]);
        }
        merge(sh, dt, head(3, -12, 'open', false));
        return { sh, dt };
    }

    function poseFromDesc(d) {
        switch (d.k) {
            case 'walk':  return poseWalk(d.f, d.mode, d.eyes, d.tw);
            case 'sit':   return poseSit(d.sw, d.eyes);
            case 'sleep': return poseSleep(d.br);
            case 'eat':   return poseEat(d.hy, d.mouth, d.tw);
            case 'swat':  return poseSwat(d.t, d.tw);
        }
        return poseSit(0, 'open');
    }

    function drawCatP(g, d) {
        const p = poseFromDesc(d);
        g.fillStyle = C.k;
        for (const [x, y, w, h] of p.sh) g.fillRect(x - 1, y - 1, w + 2, h + 2);
        for (const [x, y, w, h, c] of p.sh) { g.fillStyle = c; g.fillRect(x, y, w, h); }
        for (const [x, y, w, h, c] of p.dt) { g.fillStyle = c; g.fillRect(x, y, w, h); }
    }

    function buildBackgroundP(g) {
        g.fillStyle = theme.ground;
        g.fillRect(0, GY, W, H - GY);
        g.fillStyle = theme.line;
        g.fillRect(0, GY, W, 1);

        g.fillStyle = theme.dots;
        const gh = H - GY - 2;
        for (let x = 0; x < W; x++) {
            const r = hash(x + 17);
            if (r % 6 === 0 && gh > 0) g.fillRect(x, GY + 2 + ((r >>> 4) % gh), 1, 1);
        }

        g.fillStyle = theme.tuft;
        for (let x = 2; x < W - 3; x++) {
            if (hash(x * 3 + 5) % 19 === 0) {
                g.fillRect(x, GY - 2, 1, 2);
                g.fillRect(x + 2, GY - 3, 1, 3);
                g.fillRect(x + 1, GY - 1, 1, 1);
            }
        }

        const skyH = GY - 20;
        stars = [];
        if (isDark) {
            for (let i = 0; i < Math.max(8, W / 10); i++) {
                const x = hash(i * 7 + 1) % W;
                const y = 2 + (hash(i * 13 + 3) % Math.max(1, skyH));
                stars.push({ x, y, tw: i % 4 === 0, i });
                if (i % 4 !== 0) {
                    g.fillStyle = (i % 3 === 0) ? '#ffffff' : '#bfb3e0';
                    g.fillRect(x, y, 1, 1);
                }
            }
            const mx = rnd(W * 0.38), my = 12;
            g.fillStyle = '#fff2c2';
            for (let dy = -5; dy <= 5; dy++)
                for (let dx = -5; dx <= 5; dx++)
                    if (dx * dx + dy * dy <= 25) g.fillRect(mx + dx, my + dy, 1, 1);
            for (let dy = -5; dy <= 5; dy++)
                for (let dx = -5; dx <= 5; dx++)
                    if ((dx - 3) * (dx - 3) + (dy + 2) * (dy + 2) <= 20) g.clearRect(mx + dx, my + dy, 1, 1);
        } else {
            const sx = rnd(W * 0.38), sy = 12;
            for (let dy = -4; dy <= 4; dy++)
                for (let dx = -4; dx <= 4; dx++) {
                    const d = dx * dx + dy * dy;
                    if (d <= 16) { g.fillStyle = d > 9 ? '#ffd27a' : '#ffe9a8'; g.fillRect(sx + dx, sy + dy, 1, 1); }
                }
        }
    }

    function drawCloudP(x, y) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(x + 3, y, 3, 1);
        ctx.fillRect(x + 2, y + 1, 6, 1);
        ctx.fillRect(x, y + 2, 11, 1);
        ctx.fillRect(x + 1, y + 3, 9, 1);
    }

    /* ==========================================================
       PÜRÜZSÜZ (VEKTÖR) ÇİZİM  – aynı mantıksal koordinatlar
       ========================================================== */
    function ell(g, x, y, rx, ry, fill, stroke, lw) {
        g.beginPath();
        g.ellipse(x, y, rx, ry, 0, 0, TAU);
        if (fill)   { g.fillStyle = fill; g.fill(); }
        if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 0.45; g.stroke(); }
    }

    function rrect(g, x, y, w, h, r, fill, stroke, lw) {
        r = Math.min(r, w / 2, h / 2);
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
        if (fill)   { g.fillStyle = fill; g.fill(); }
        if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 0.45; g.stroke(); }
    }

    // Kalın çizgi (kuyruk, boyun, pati): önce dış çizgi, sonra dolgu
    function thick(g, pathFn, w, fill) {
        g.lineCap = 'round';
        g.lineJoin = 'round';
        pathFn(); g.strokeStyle = C.soft; g.lineWidth = w + 0.8; g.stroke();
        pathFn(); g.strokeStyle = fill;   g.lineWidth = w;       g.stroke();
    }

    function headS(g, hx, hy, eyes, mouth) {
        const cx = hx + 4.2, cy = hy + 3.6;
        g.lineJoin = 'round';
        for (const s of [-1, 1]) {                     // kulaklar
            g.beginPath();
            g.moveTo(cx + s * 4.3, cy - 0.6);
            g.lineTo(cx + s * 3.1, hy - 2.7);
            g.lineTo(cx + s * 1.1, cy - 3.3);
            g.closePath();
            g.fillStyle = C.b; g.fill();
            g.strokeStyle = C.soft; g.lineWidth = 0.45; g.stroke();
            g.beginPath();
            g.moveTo(cx + s * 3.5, cy - 1.7);
            g.lineTo(cx + s * 3.0, hy - 1.2);
            g.lineTo(cx + s * 1.9, cy - 2.9);
            g.closePath();
            g.fillStyle = C.p; g.fill();
        }
        ell(g, cx, cy, 4.5, 4.0, C.b, C.soft, 0.45);   // kafa
        g.strokeStyle = C.d; g.lineWidth = 0.5; g.lineCap = 'round';
        for (const dx of [-1.3, 0, 1.3]) {             // alın çizgileri
            g.beginPath(); g.moveTo(cx + dx, hy - 0.1); g.lineTo(cx + dx * 0.85, hy + 1.3); g.stroke();
        }
        ell(g, cx + 2.3, cy + 1.5, 2.1, 1.5, C.w);     // burun bölgesi
        g.beginPath();                                  // burun
        g.moveTo(cx + 3.5, cy + 0.5); g.lineTo(cx + 4.7, cy + 0.5); g.lineTo(cx + 4.1, cy + 1.2); g.closePath();
        g.fillStyle = '#ff7fb2'; g.fill();
        if (mouth) {
            ell(g, cx + 3.5, cy + 2.4, 0.9, 0.7, C.e);
        } else {
            g.beginPath();
            g.moveTo(cx + 4.1, cy + 1.2); g.lineTo(cx + 4.1, cy + 1.8);
            g.quadraticCurveTo(cx + 3.7, cy + 2.4, cx + 3.1, cy + 2.1);
            g.strokeStyle = C.wh; g.lineWidth = 0.25; g.stroke();
        }
        for (const ex of [cx - 0.9, cx + 2.0]) {       // gözler
            if (eyes === 'open') {
                ell(g, ex, cy - 0.6, 0.65, 0.95, C.e);
                ell(g, ex + 0.2, cy - 0.95, 0.22, 0.22, '#fff');
            } else {
                g.beginPath();
                if (eyes === 'closed') g.arc(ex, cy - 0.7, 0.8, 0.15 * Math.PI, 0.85 * Math.PI);
                else g.arc(ex, cy - 0.1, 0.8, 1.15 * Math.PI, 1.85 * Math.PI);
                g.strokeStyle = C.e; g.lineWidth = 0.45; g.lineCap = 'round'; g.stroke();
            }
        }
        g.globalAlpha = 0.8;                            // bıyıklar
        g.strokeStyle = C.wh; g.lineWidth = 0.22;
        for (const [dy1, dy2] of [[0.9, -0.1], [1.4, 1.3], [1.9, 2.6]]) {
            g.beginPath(); g.moveTo(cx + 3.3, cy + dy1); g.lineTo(cx + 7.4, cy + dy2); g.stroke();
        }
        g.globalAlpha = 1;
    }

    function legsS(g, ph, mode, skip) {
        for (const far of [true, false]) {
            for (let i = 0; i < 4; i++) {
                const L = LEGS[i];
                if (i === skip || !!L.far !== far) continue;
                let dx = 0, lift = 0;
                if (mode === 'walk') {
                    const p = (((ph + L.o) % 1) + 1) % 1;
                    if (p < 0.5) dx = 1.5 - 6 * p;
                    else { dx = -1.5 + 6 * (p - 0.5); lift = 2.4 * Math.sin(Math.PI * (p - 0.5) / 0.5); }
                } else if (mode === 'air') {
                    lift = 1.4;
                    dx = L.far ? -0.5 : 0.5;
                }
                const cx = L.x + 1 + dx, top = -4.6, bot = -lift;
                rrect(g, cx - 1.15, top, 2.3, Math.max(1.4, bot - top), 1.1, far ? C.far : C.b, C.soft, 0.4);
                ell(g, cx + 0.2, bot - 0.7, 1.4, 0.8, C.w);
            }
        }
    }

    function bodyS(g) {
        ell(g, -1.5, -6.4, 7.2, 3.4, C.b, C.soft, 0.45);
        ell(g, -1.5, -4.6, 5.4, 1.15, 'rgba(255,244,230,0.95)');
        g.strokeStyle = C.d; g.lineWidth = 0.8; g.lineCap = 'round';
        for (const x of [-5.5, -2.5, 0.5]) {
            g.beginPath(); g.moveTo(x, -9.5); g.lineTo(x + 0.5, -7.8); g.stroke();
        }
    }

    function tailUpS(g, sway) {
        const tx = -11 + sway * 0.6;
        thick(g, () => {
            g.beginPath(); g.moveTo(-8, -7.4); g.bezierCurveTo(-11.6, -7.2, -12.4, -11, tx, -14.4);
        }, 2.1, C.b);
        ell(g, tx, -14.2, 1.05, 1.05, C.d);
    }

    function swatArmS(g, t) {
        const x1 = 3.6, y1 = -5.2;
        let x2, y2;
        if (t >= 0.18 && t < 0.34) { x2 = 10; y2 = -5.4; } else { x2 = 4.6; y2 = -8.4; }
        thick(g, () => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); }, 2.2, C.b);
        ell(g, x2, y2, 1.35, 1.2, C.w, C.soft, 0.4);
    }

    function drawCatS(g, d) {
        const a = d.a;
        switch (d.k) {
            case 'walk':
            case 'eat':
            case 'swat': {
                const mode = d.k === 'walk' ? d.mode : 'stand';
                const bob = (d.k === 'walk' && d.mode === 'walk') ? Math.abs(Math.sin(d.ph * TAU)) * 0.5 : 0;
                const sway = Math.sin(a * (d.k === 'walk' ? 5 : 8));
                legsS(g, d.ph, mode, d.k === 'swat' ? 3 : -1);
                g.save();
                g.translate(0, -bob);
                tailUpS(g, sway);
                bodyS(g);
                if (d.k === 'swat') swatArmS(g, d.t);
                if (d.k === 'eat') {
                    thick(g, () => { g.beginPath(); g.moveTo(3, -8); g.lineTo(8.5, d.hys + 4); }, 4.6, C.b);
                    headS(g, 6, d.hys, 'happy', d.mouth);
                } else if (d.k === 'swat') {
                    headS(g, 3, -12, 'open', false);
                } else {
                    headS(g, 3, -13, d.eyes, false);
                }
                g.restore();
                break;
            }
            case 'sit': {
                const sw = (Math.sin(a * 2) + 1) / 2;
                thick(g, () => {
                    g.beginPath(); g.moveTo(-7.5, -1.6);
                    g.bezierCurveTo(-12, -0.6, -14, -3.5, -13.2, -6.2 - sw * 1.4);
                }, 2.1, C.b);
                ell(g, -5.2, -3, 3.9, 3, C.b, C.soft, 0.45);
                ell(g, -2.6, -5, 4.7, 5, C.b, C.soft, 0.45);
                ell(g, 1.3, -5.2, 1.3, 2.6, C.w);
                g.strokeStyle = C.d; g.lineWidth = 0.8; g.lineCap = 'round';
                for (const x of [-5, -2.2]) { g.beginPath(); g.moveTo(x, -9.5); g.lineTo(x + 0.4, -7.8); g.stroke(); }
                rrect(g, 0.3, -6, 2.6, 6, 1.2, C.b, C.soft, 0.4);
                ell(g, 1.7, -0.7, 1.7, 0.8, C.w);
                headS(g, -1, -14, d.eyes, false);
                break;
            }
            case 'sleep': {
                const br = Math.sin(a * 2) * 0.25;
                ell(g, -0.5, -3.1, 9.6, 3.3 + br, C.b, C.soft, 0.45);
                g.strokeStyle = C.d; g.lineWidth = 1.6; g.lineCap = 'round';
                g.beginPath(); g.moveTo(-9.5, -3.2); g.quadraticCurveTo(-8.5, -0.9, -4, -1); g.stroke();
                g.lineWidth = 0.8;
                for (const x of [-5, -1.5, 2]) { g.beginPath(); g.moveTo(x, -6.2); g.lineTo(x + 0.3, -4.6); g.stroke(); }
                headS(g, 4, -9, 'closed', false);
                ell(g, 11, -1, 2.7, 1.1, C.w, C.soft, 0.4);
                ell(g, 7.2, -0.8, 2.1, 1, C.w, C.soft, 0.4);
                break;
            }
        }
    }

    function drawYarnS(g, cx, cy, rot) {
        const r = 3.4;
        const gr = g.createRadialGradient(cx - 1, cy - 1.2, 0.4, cx, cy, r);
        gr.addColorStop(0, '#ffc7e0');
        gr.addColorStop(1, '#ff6fae');
        g.beginPath(); g.arc(cx, cy, r, 0, TAU);
        g.fillStyle = gr; g.fill();
        g.strokeStyle = '#d6477f'; g.lineWidth = 0.35; g.stroke();
        g.save();
        g.beginPath(); g.arc(cx, cy, r - 0.05, 0, TAU); g.clip();
        g.translate(cx, cy);
        g.rotate(rot);
        g.strokeStyle = 'rgba(255,255,255,0.55)';
        g.lineWidth = 0.35;
        for (let k = 0; k < 2; k++) {
            if (k) g.rotate(1.2);
            for (const o of [-1.8, 0, 1.8]) {
                g.beginPath(); g.moveTo(-r, o); g.quadraticCurveTo(0, o + 1.6, r, o); g.stroke();
            }
        }
        g.restore();
    }

    const KIB = [[-2.4, -0.2], [-1.2, -0.4], [0, -0.3], [1.2, -0.4], [2.4, -0.2], [-1.8, -1.1], [-0.6, -1.2],
                 [0.6, -1.1], [1.8, -1.2], [-1.2, -1.9], [0, -2.1], [1.2, -1.9], [-3.3, 0], [3.3, 0]];

    function drawBowlS(g, x, y, food) {
        const cx = x + 6, top = y + 0.9;
        g.beginPath();
        g.moveTo(cx - 6, top);
        g.bezierCurveTo(cx - 5.6, top + 4.6, cx - 3, y + 5, cx, y + 5);
        g.bezierCurveTo(cx + 3, y + 5, cx + 5.6, top + 4.6, cx + 6, top);
        g.closePath();
        const gr = g.createLinearGradient(0, top, 0, y + 5);
        gr.addColorStop(0, '#a9ddf7');
        gr.addColorStop(1, '#6fbbea');
        g.fillStyle = gr; g.fill();
        g.strokeStyle = '#4a8fbf'; g.lineWidth = 0.4; g.stroke();
        ell(g, cx, top, 6, 1.3, '#cfefff', '#4a8fbf', 0.4);
        ell(g, cx, top, 4.9, 0.8, '#a9ddf7');
        const n = Math.ceil(food * KIB.length - 1e-6);
        for (let i = 0; i < n; i++) {
            ell(g, cx + KIB[i][0], top + KIB[i][1], 0.85, 0.75, (i & 1) ? C.kib : C.kibL);
        }
        ell(g, cx, top + 3.1, 1.1, 0.9, C.p);                       // pati izi
        for (const dx of [-1.1, 0, 1.1]) ell(g, cx + dx, top + 1.9, 0.35, 0.35, C.p);
    }

    function buildBackgroundS(g) {
        const gr = g.createLinearGradient(0, GY, 0, H);
        gr.addColorStop(0, theme.ground);
        gr.addColorStop(1, theme.ground2);
        g.fillStyle = gr;
        g.fillRect(0, GY, W, H - GY);
        g.fillStyle = theme.line;
        g.fillRect(0, GY - 0.2, W, 0.6);

        g.fillStyle = theme.dots;
        const gh = H - GY - 2;
        for (let x = 0; x < W; x++) {
            const r = hash(x + 17);
            if (r % 6 === 0 && gh > 0) {
                g.beginPath(); g.arc(x + 0.5, GY + 2 + ((r >>> 4) % gh), 0.3, 0, TAU); g.fill();
            }
        }

        g.lineCap = 'round';
        g.strokeStyle = theme.tuft; g.lineWidth = 0.5;
        for (let x = 2; x < W - 3; x++) {
            if (hash(x * 3 + 5) % 19 === 0) {
                for (const k of [-1, 0, 1]) {
                    g.beginPath();
                    g.moveTo(x + k * 0.9, GY);
                    g.quadraticCurveTo(x + k * 1.4, GY - 1.6, x + k * 1.9, GY - 2.6 - (k === 0 ? 0.9 : 0));
                    g.stroke();
                }
            }
            if (!isDark && hash(x * 5 + 9) % 53 === 0) {            // küçük çiçekler
                g.beginPath(); g.moveTo(x, GY); g.lineTo(x, GY - 2.4); g.strokeStyle = theme.tuft; g.stroke();
                ell(g, x, GY - 3, 0.95, 0.95, '#ffb3d6');
                ell(g, x, GY - 3, 0.35, 0.35, '#ffe08a');
            }
        }

        const skyH = GY - 20;
        stars = [];
        if (isDark) {
            for (let i = 0; i < Math.max(8, W / 10); i++) {
                const x = hash(i * 7 + 1) % W;
                const y = 2 + (hash(i * 13 + 3) % Math.max(1, skyH));
                stars.push({ x, y, tw: i % 4 === 0, i });
                if (i % 4 !== 0) {
                    g.fillStyle = (i % 3 === 0) ? '#ffffff' : '#bfb3e0';
                    g.beginPath(); g.arc(x + 0.5, y + 0.5, i % 5 === 0 ? 0.55 : 0.38, 0, TAU); g.fill();
                }
            }
            const mx = W * 0.38, my = 12;
            g.beginPath(); g.arc(mx, my, 5, 0, TAU); g.fillStyle = '#fff2c2'; g.fill();
            g.globalCompositeOperation = 'destination-out';
            g.beginPath(); g.arc(mx + 3, my - 2, 4.4, 0, TAU); g.fill();
            g.globalCompositeOperation = 'destination-over';
            const gl = g.createRadialGradient(mx, my, 3, mx, my, 13);
            gl.addColorStop(0, 'rgba(255,242,194,0.28)');
            gl.addColorStop(1, 'rgba(255,242,194,0)');
            g.fillStyle = gl; g.beginPath(); g.arc(mx, my, 13, 0, TAU); g.fill();
            g.globalCompositeOperation = 'source-over';
        } else {
            const sx = W * 0.38, sy = 12;
            const gl = g.createRadialGradient(sx, sy, 3, sx, sy, 14);
            gl.addColorStop(0, 'rgba(255,226,140,0.55)');
            gl.addColorStop(1, 'rgba(255,226,140,0)');
            g.fillStyle = gl; g.beginPath(); g.arc(sx, sy, 14, 0, TAU); g.fill();
            const sg = g.createRadialGradient(sx - 1, sy - 1, 0.5, sx, sy, 4.6);
            sg.addColorStop(0, '#fff3b8');
            sg.addColorStop(1, '#ffd36b');
            g.fillStyle = sg; g.beginPath(); g.arc(sx, sy, 4.4, 0, TAU); g.fill();
        }
    }

    function drawCloudS(x, y) {
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.beginPath();
        ctx.arc(x + 3.5, y + 3.2, 2.8, 0, TAU);
        ctx.arc(x + 7, y + 2.2, 3.4, 0, TAU);
        ctx.arc(x + 10.5, y + 3.4, 2.6, 0, TAU);
        ctx.fill();
        rrect(ctx, x + 1, y + 3, 11.5, 2.8, 1.4, 'rgba(255,255,255,0.88)');
    }

    /* ---------------------------------------------------- ortak sarmalayıcılar */
    function drawYarn(g, x, y, rot) {            // x,y = 7x7 kutunun sol üstü
        if (pixelMode) drawYarnP(g, x, y, rot);
        else drawYarnS(g, x + 3.5, y + 3.5, rot);
    }

    function drawBowl(g, x, y, food) {
        if (pixelMode) drawBowlP(g, x, y, food);
        else drawBowlS(g, x, y, food);
    }

    /* ---------------------------------------------------- araç çubuğu ikonları */
    function drawIcons() {
        if (yarnIcon) {
            const g = yarnIcon.getContext('2d');
            if (pixelMode) { yarnIcon.width = 7; yarnIcon.height = 7; drawYarnP(g, 0, 0, 0.6); }
            else { yarnIcon.width = 42; yarnIcon.height = 42; g.setTransform(6, 0, 0, 6, 0, 0); drawYarnS(g, 3.5, 3.5, 0.6); }
        }
        if (bowlIcon) {
            const g = bowlIcon.getContext('2d');
            if (pixelMode) { bowlIcon.width = 12; bowlIcon.height = 7; drawBowlP(g, 0, 2, 1); }
            else { bowlIcon.width = 72; bowlIcon.height = 42; g.setTransform(6, 0, 0, 6, 0, 0); drawBowlS(g, 0, 2, 1); }
        }
    }

    /* ---------------------------------------------------- sahne boyutları */
    let S = 4, W = 0, H = 0, GY = 0;
    let MIN = 14, MAX = 100;
    const bg = document.createElement('canvas');
    let stars = [];
    let clouds = [];
    let initialized = false;

    // Canvas'ı moda göre ayarla: piksel = küçük ve keskin, normal = yüksek çözünürlüklü
    function setupCanvas(c, g) {
        if (pixelMode) {
            c.width = W; c.height = H;
            g.setTransform(1, 0, 0, 1, 0, 0);
        } else {
            const K = S * Math.min(window.devicePixelRatio || 1, 2);
            c.width = Math.round(W * K); c.height = Math.round(H * K);
            g.setTransform(K, 0, 0, K, 0, 0);
        }
    }

    function resize() {
        const w = root.clientWidth, h = root.clientHeight;
        if (!w || !h) return;
        S = w < 600 ? 3 : 4;
        W = Math.ceil(w / S);
        H = Math.ceil(h / S);
        setupCanvas(canvas, ctx);
        canvas.style.width = (W * S) + 'px';
        canvas.style.height = (H * S) + 'px';
        GY = H - 7;
        MIN = 14;
        MAX = Math.max(MIN, W - 14);

        if (!initialized) {
            cat.x = W / 2;
            initialized = true;
            clouds = [
                { x: W * 0.15, y: 5,  v: 2.5 },
                { x: W * 0.55, y: 12, v: 1.8 },
                { x: W * 0.85, y: 4,  v: 3.2 }
            ];
        }

        cat.x = clamp(cat.x, MIN, MAX);
        cat.target = clamp(cat.target, MIN, MAX);
        if (yarn) yarn.x = clamp(yarn.x, 4, W - 4);
        if (bowl) bowl.x = clamp(bowl.x, 26, Math.max(26, W - 26));
        buildBackground();
    }

    function buildBackground() {
        const g = bg.getContext('2d');
        setupCanvas(bg, g);
        g.clearRect(0, 0, W, H);
        if (pixelMode) buildBackgroundP(g); else buildBackgroundS(g);
    }

    /* ---------------------------------------------------- kedi durum makinesi */
    const cat = {
        x: 100, dir: 1,
        state: 'idle', t: 0, dur: 2, anim: 0, animRate: 8,
        target: 100, speed: 16,
        phase: '', phaseT: 0,
        blink: 0, nextBlink: 3,
        playTime: 0, playDur: 10, swatT: -1, swatHit: false, cool: 0, moving: false,
        eatDir: 1, eatDur: 5,
        zTimer: 0, zCount: 0
    };

    // Hangi durumdan hangisine geçilebilir (çakışan davranışları engeller)
    const TRANSITIONS = {
        idle:     ['idle', 'walking', 'sleeping', 'playing', 'eating', 'reacting'],
        walking:  ['idle', 'walking', 'playing', 'eating', 'reacting'],
        sleeping: ['idle', 'playing', 'eating', 'reacting'],
        reacting: ['idle', 'playing', 'eating'],
        playing:  ['idle', 'eating'],          // mama, oyunu bölebilir
        eating:   ['idle']                     // yemek bitmeden başka şeye geçmez
    };

    let pending = null; // meşgulken gelen istek: 'play' | 'eat'

    function setState(next, data) {
        if (!TRANSITIONS[cat.state].includes(next)) return false;
        cat.state = next;
        cat.t = 0;
        cat.anim = 0;
        cat.phase = '';
        cat.phaseT = 0;
        ENTER[next](data || {});
        return true;
    }

    function afterBusy() {
        const wantEat = pending === 'eat' && bowl && bowl.food > 0;
        const wantPlay = pending === 'play' && yarn;
        pending = null;
        setState('idle', { dur: rand(1.2, 2.5) });
        if (wantEat) setState('eating');
        else if (wantPlay) setState('playing');
    }

    const ENTER = {
        idle(d) { cat.dur = d.dur || rand(2, 5); },

        walking() {
            const left = cat.x - MIN, right = MAX - cat.x;
            let dir = Math.random() < 0.5 ? 1 : -1;
            if (dir === 1 && right < 20) dir = -1;
            if (dir === -1 && left < 20) dir = 1;
            const room = dir === 1 ? right : left;
            const dist = Math.min(room, rand(25, 90));
            cat.target = clamp(cat.x + dir * dist, MIN, MAX);
            cat.speed = Math.random() < 0.2 ? 28 : rand(14, 19);
        },

        sleeping() {
            cat.dur = rand(9, 18);
            cat.zTimer = 0.6;
        },

        reacting(d) {
            cat.dur = 1.1;
            if (d.startle) parts.push({ k: 'bang', x: cat.x + cat.dir * 2, y: GY - 24, vx: 0, vy: -4, t: 0, life: 0.9 });
        },

        playing() {
            cat.playTime = 0;
            cat.playDur = rand(9, 13);
            cat.swatT = -1;
            cat.cool = 0.2;
            cat.moving = false;
        },

        eating() {
            if (!bowl) return;
            cat.eatDir = bowl.x >= cat.x ? 1 : -1;
            cat.target = clamp(bowl.x - cat.eatDir * 10, MIN, MAX);
            cat.eatDur = rand(4.5, 6.5);
            cat.phase = 'approach';
        }
    };

    function moveToward(tx, speed, dt) {
        const d = tx - cat.x;
        cat.animRate = Math.min(12, speed * 0.55);
        if (Math.abs(d) <= speed * dt) { cat.x = tx; return true; }
        cat.dir = d > 0 ? 1 : -1;
        cat.x += cat.dir * speed * dt;
        return false;
    }

    function nextFromIdle() {
        const r = Math.random();
        if (r < 0.55) setState('walking');
        else if (r < 0.78) setState('sleeping');
        else setState('idle');
    }

    const REACH = 15, STAND = 12;

    const UPDATE = {
        idle() {
            if (cat.t >= cat.dur) nextFromIdle();
        },

        walking(dt) {
            if (moveToward(cat.target, cat.speed, dt)) {
                if (Math.random() < 0.25) setState('walking');
                else setState('idle');
            } else if (cat.t > 1.5 && Math.random() < dt * 0.12) {
                setState('idle', { dur: rand(1.5, 3) });
            }
        },

        sleeping(dt) {
            cat.zTimer -= dt;
            if (cat.zTimer <= 0) {
                cat.zTimer = 1.3;
                const big = (cat.zCount++ % 2) + 1;
                parts.push({ k: 'z', x: cat.x + cat.dir * 9, y: GY - 14, vx: 0, vy: -6, t: 0, life: 2.6, s: big, bx: cat.x + cat.dir * 9 });
            }
            if (cat.t >= cat.dur) setState('idle', { dur: 1.5 });
        },

        reacting() {
            if (cat.t >= cat.dur) afterBusy();
        },

        playing(dt) {
            const y = yarn;
            if (!y) { afterBusy(); return; }
            cat.playTime += dt;
            cat.cool -= dt;
            cat.moving = false;

            if (cat.swatT >= 0) {
                cat.swatT += dt;
                if (!cat.swatHit && cat.swatT >= 0.2) {
                    cat.swatHit = true;
                    y.vx = cat.dir * rand(35, 70);
                    y.vy = rand(14, 28);
                    if (Math.random() < 0.2) y.vx *= -0.6;
                }
                if (cat.swatT >= 0.45) cat.swatT = -1;
                return;
            }

            const dx = y.x - cat.x, adx = Math.abs(dx);
            if (adx > REACH) {
                const dir = dx > 0 ? 1 : -1;
                const sp = Math.abs(y.vx) > 15 ? 34 : 24;
                moveToward(clamp(y.x - dir * STAND, MIN, MAX), sp, dt);
                cat.moving = true;
            } else {
                if (adx > 2) cat.dir = dx > 0 ? 1 : -1;
                if (cat.cool <= 0 && y.h < 8) { cat.swatT = 0; cat.swatHit = false; cat.cool = rand(0.5, 1.0); }
            }

            if (cat.playTime > cat.playDur && Math.abs(y.vx) < 3 && y.h < 1) afterBusy();
        },

        eating(dt) {
            if (!bowl) { afterBusy(); return; }
            if (cat.phase === 'approach') {
                if (moveToward(cat.target, 26, dt)) {
                    cat.phase = 'eat';
                    cat.phaseT = 0;
                    cat.dir = cat.eatDir;
                }
            } else if (cat.phase === 'eat') {
                cat.phaseT += dt;
                bowl.food = Math.max(0, 1 - cat.phaseT / cat.eatDur);
                if (Math.random() < dt * 4) {
                    parts.push({ k: 'crumb', x: cat.x + cat.dir * 14, y: GY - 5, vx: cat.dir * rand(2, 9), vy: -rand(8, 18), t: 0, life: 2 });
                }
                if (cat.phaseT >= cat.eatDur) {
                    bowl.food = 0;
                    cat.phase = 'done';
                    cat.phaseT = 0;
                    spawnHeart(cat.x + cat.dir * 2, GY - 22);
                }
            } else {
                cat.phaseT += dt;
                if (cat.phaseT > 1.3) afterBusy();
            }
        }
    };

    /* ---------------------------------------------------- yumak & mama kabı */
    let yarn = null;   // { x, h, vx, vy, rot }
    let bowl = null;   // { x, h, vy, food, emptyT }

    function dropYarn(lx, ly) {
        yarn = { x: clamp(lx, 4, W - 4), h: Math.max(0, GY - ly - 3.5), vx: 0, vy: 0, rot: 0 };
        if (cat.state === 'playing') cat.playTime = 0;
        else if (!setState('playing')) pending = 'play';
    }

    function updateYarn(dt) {
        const y = yarn;
        if (!y) return;
        if (y.h > 0 || y.vy !== 0) {
            y.vy -= 140 * dt;
            y.h += y.vy * dt;
            if (y.h <= 0) {
                y.h = 0;
                y.vy = y.vy < -12 ? -y.vy * 0.45 : 0;
            }
        }
        y.x += y.vx * dt;
        if (y.x < 4)     { y.x = 4;     y.vx =  Math.abs(y.vx) * 0.6; }
        if (y.x > W - 4) { y.x = W - 4; y.vx = -Math.abs(y.vx) * 0.6; }
        y.vx *= Math.exp(-(y.h > 0 ? 0.3 : 1.6) * dt);
        if (y.h === 0 && Math.abs(y.vx) < 1.5) y.vx = 0;
        y.rot += y.vx * dt / 3;
    }

    function feed() {
        if (cat.state === 'eating') return;
        if (!bowl) {
            let x = rand(26, Math.max(27, W - 26));
            for (let i = 0; i < 10 && Math.abs(x - cat.x) < 40; i++) x = rand(26, Math.max(27, W - 26));
            bowl = { x, h: 36, vy: 0, food: 1, emptyT: 0 };
        } else if (bowl.food <= 0) {
            bowl.food = 1;
            bowl.emptyT = 0;
        }
        if (!setState('eating')) pending = 'eat';
    }

    function updateBowl(dt) {
        if (!bowl) return;
        if (bowl.h > 0 || bowl.vy !== 0) {
            bowl.vy -= 160 * dt;
            bowl.h += bowl.vy * dt;
            if (bowl.h <= 0) {
                bowl.h = 0;
                bowl.vy = bowl.vy < -15 ? -bowl.vy * 0.3 : 0;
            }
        }
        if (bowl.food <= 0 && !(cat.state === 'eating' && cat.phase === 'eat')) {
            bowl.emptyT += dt;
            if (bowl.emptyT > 5) {
                puff(bowl.x, GY - 3);
                bowl = null;
            }
        }
    }

    function removeBowl() {
        if (!bowl) return;
        puff(bowl.x, GY - 3);
        bowl = null;
        if (pending === 'eat') pending = null;
    }

    /* ---------------------------------------------------- parçacıklar */
    const parts = [];
    function spawnHeart(x, y) { parts.push({ k: 'heart', x, y, vx: rand(-4, 4), vy: -14, t: 0, life: 1.2 }); }
    function puff(x, y) {
        for (let i = 0; i < 5; i++) parts.push({ k: 'puff', x, y, vx: rand(-14, 14), vy: -rand(2, 12), t: 0, life: 0.5 });
    }

    function updateParticles(dt) {
        for (let i = parts.length - 1; i >= 0; i--) {
            const p = parts[i];
            p.t += dt;
            p.y += p.vy * dt;
            if (p.k === 'z') p.x = p.bx + Math.sin(p.t * 3) * 3;
            else p.x += p.vx * dt;
            if (p.k === 'crumb') {
                p.vy += 70 * dt;
                if (p.y >= GY) { parts.splice(i, 1); continue; }
            }
            if (p.t >= p.life) parts.splice(i, 1);
        }
    }

    /* ---------------------------------------------------- poz tarifi */
    // Durum makinesinden "ne çizilecek" bilgisini çıkarır; iki çizim modu da bunu kullanır
    function describe() {
        const a = cat.anim;
        const f = Math.floor(a * cat.animRate) & 3;
        const ph = a * cat.animRate / 4;
        const D = o => Object.assign({ a, f, ph, eyes: cat.blink > 0 ? 'closed' : 'open', tw: 0, sw: 0, br: 0, mode: 'stand' }, o);
        switch (cat.state) {
            case 'walking':
                return D({ k: 'walk', mode: 'walk', tw: Math.floor(a * 3) & 1 });
            case 'idle':
                return D({ k: 'sit', sw: Math.floor(a * 1.3) & 1 });
            case 'sleeping':
                return D({ k: 'sleep', br: Math.sin(a * 2) > 0 ? 1 : 0 });
            case 'reacting':
                return D({ k: 'walk', mode: 'air', f: 0, ph: 0, eyes: 'happy', tw: Math.floor(a * 8) & 1 });
            case 'playing':
                if (cat.swatT >= 0) return D({ k: 'swat', t: cat.swatT, tw: Math.floor(a * 10) & 1 });
                if (cat.moving) return D({ k: 'walk', mode: 'walk', tw: Math.floor(a * 8) & 1 });
                return D({ k: 'walk', mode: 'stand', f: 0, ph: 0, tw: Math.floor(a * 10) & 1 });
            case 'eating':
                if (cat.phase === 'eat') {
                    const b = Math.floor(cat.phaseT * 5) & 1;
                    const s = Math.sin(cat.phaseT * Math.PI * 5);
                    return D({ k: 'eat', hy: -10 + b * 2, hys: -9 + s * 1.1, mouth: pixelMode ? b === 1 : s > 0.2, tw: Math.floor(a * 4) & 1 });
                }
                if (cat.phase === 'done') return D({ k: 'sit', eyes: 'happy', sw: Math.floor(a * 2) & 1 });
                return D({ k: 'walk', mode: 'walk', tw: Math.floor(a * 8) & 1 });
        }
        return D({ k: 'sit' });
    }

    /* ---------------------------------------------------- çizim */
    function drawCat() {
        const d = describe();
        const hop = cat.state === 'reacting' ? Math.abs(Math.sin(cat.t * 5.4)) * 7 : 0;
        const lift = pixelMode ? rnd(hop) : hop;
        const cx = pixelMode ? rnd(cat.x) : cat.x;

        // gölge
        ctx.globalAlpha = theme.shadow;
        ctx.fillStyle = '#000';
        const sw = Math.max(6, 10 - lift);
        if (pixelMode) {
            ctx.fillRect(cx - sw, GY + 1, sw * 2, 1);
        } else {
            ctx.beginPath(); ctx.ellipse(cx, GY + 1.1, sw * 0.95, 0.9, 0, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;

        ctx.save();
        ctx.translate(cx, GY - lift);
        ctx.scale(cat.dir, 1);
        if (pixelMode) drawCatP(ctx, d); else drawCatS(ctx, d);
        ctx.restore();
    }

    function drawParticles() {
        for (const p of parts) {
            const k = p.t / p.life;
            ctx.globalAlpha = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
            const x = pixelMode ? rnd(p.x) : p.x, y = pixelMode ? rnd(p.y) : p.y;
            if (p.k === 'heart') {
                if (pixelMode) {
                    drawRows(ctx, HEART, x - 3, y, { k: C.k, p: C.heart });
                } else {
                    ctx.beginPath();
                    ctx.moveTo(x, y + 5.4);
                    ctx.bezierCurveTo(x - 5, y + 2, x - 3, y - 1, x, y + 1.2);
                    ctx.bezierCurveTo(x + 3, y - 1, x + 5, y + 2, x, y + 5.4);
                    ctx.fillStyle = C.heart; ctx.fill();
                    ctx.strokeStyle = '#d6477f'; ctx.lineWidth = 0.3; ctx.stroke();
                }
            } else if (p.k === 'z') {
                if (pixelMode) {
                    ctx.fillStyle = theme.z;
                    for (let r = 0; r < 5; r++)
                        for (let c = 0; c < 3; c++)
                            if (ZGLYPH[r][c] === '#') ctx.fillRect(x + c * p.s, y + r * p.s, p.s, p.s);
                } else {
                    const s = p.s * 1.1;
                    ctx.beginPath();
                    ctx.moveTo(x, y); ctx.lineTo(x + 3 * s, y); ctx.lineTo(x, y + 4.4 * s); ctx.lineTo(x + 3 * s, y + 4.4 * s);
                    ctx.strokeStyle = theme.z; ctx.lineWidth = 0.7 * p.s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
                }
            } else if (p.k === 'crumb') {
                if (pixelMode) { ctx.fillStyle = C.kib; ctx.fillRect(x, y, 1, 1); }
                else { ctx.beginPath(); ctx.arc(x, y, 0.5, 0, TAU); ctx.fillStyle = C.kib; ctx.fill(); }
            } else if (p.k === 'puff') {
                ctx.fillStyle = isDark ? '#cfc4ee' : '#ffffff';
                if (pixelMode) { const s = 1 + Math.floor(k * 2); ctx.fillRect(x, y, s, s); }
                else { ctx.beginPath(); ctx.arc(x, y, 0.7 + k * 1.6, 0, TAU); ctx.fill(); }
            } else if (p.k === 'bang') {
                if (pixelMode) {
                    ctx.fillStyle = C.bang;
                    ctx.fillRect(x, y, 2, 4);
                    ctx.fillRect(x, y + 5, 2, 2);
                } else {
                    rrect(ctx, x, y, 1.4, 4, 0.7, C.bang);
                    ell(ctx, x + 0.7, y + 5.5, 0.75, 0.75, C.bang);
                }
            }
        }
        ctx.globalAlpha = 1;
    }

    function render(time) {
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(bg, 0, 0, W, H);

        if (isDark) {
            for (const s of stars) {
                if (!s.tw) continue;
                ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 2 + s.i));
                ctx.fillStyle = '#fff';
                if (pixelMode) ctx.fillRect(s.x, s.y, 1, 1);
                else { ctx.beginPath(); ctx.arc(s.x + 0.5, s.y + 0.5, 0.5, 0, TAU); ctx.fill(); }
            }
            ctx.globalAlpha = 1;
        } else {
            for (const c of clouds) {
                if (pixelMode) drawCloudP(rnd(c.x), c.y); else drawCloudS(c.x, c.y);
            }
        }

        if (yarn) {
            const yx = pixelMode ? rnd(yarn.x) - 3 : yarn.x - 3.5;
            const yy = pixelMode ? rnd(GY - yarn.h - 7) : GY - yarn.h - 7;
            if (!pixelMode && yarn.h < 1) {               // yerdeki iplik ucu
                ctx.beginPath();
                ctx.moveTo(yarn.x - 3.2, GY - 0.8);
                ctx.quadraticCurveTo(yarn.x - 5, GY - 2.6, yarn.x - 7, GY - 0.6);
                ctx.strokeStyle = '#ff6fae'; ctx.lineWidth = 0.4; ctx.lineCap = 'round'; ctx.stroke();
            }
            drawYarn(ctx, yx, yy, yarn.rot);
        }

        drawCat();

        if (bowl) {
            let a = 1;
            if (bowl.food <= 0 && bowl.emptyT > 4) a = (Math.floor(bowl.emptyT * 8) & 1) ? 0.3 : 1;
            ctx.globalAlpha = a;
            const bx = pixelMode ? rnd(bowl.x) - 6 : bowl.x - 6;
            const by = pixelMode ? rnd(GY - 5 - bowl.h) : GY - 5 - bowl.h;
            drawBowl(ctx, bx, by, bowl.food);
            ctx.globalAlpha = 1;
        }

        drawParticles();
    }

    /* ---------------------------------------------------- ana döngü */
    function update(dt) {
        cat.t += dt;
        cat.anim += dt;
        cat.nextBlink -= dt;
        if (cat.nextBlink <= 0) { cat.blink = 0.14; cat.nextBlink = rand(2.5, 6); }
        if (cat.blink > 0) cat.blink -= dt;

        updateYarn(dt);
        updateBowl(dt);
        updateParticles(dt);
        UPDATE[cat.state](dt);

        // Sert sınır: kedi hiçbir koşulda şeridin dışına çıkamaz
        cat.x = clamp(cat.x, MIN, MAX);

        for (const c of clouds) {
            c.x += c.v * dt;
            if (c.x > W + 14) c.x = -14;
        }
    }

    let last = 0, inView = true;
    function frame(ts) {
        requestAnimationFrame(frame);
        if (!inView || document.hidden || !W) { last = 0; return; }
        if (!last) last = ts;
        const dt = Math.min((ts - last) / 1000, 0.05);
        last = ts;
        update(dt);
        render(ts / 1000);
    }

    /* ---------------------------------------------------- etkileşim */
    function toLogical(e) {
        const r = canvas.getBoundingClientRect();
        const k = W / r.width;
        return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
    }

    const hitYarn = p => yarn && Math.abs(p.x - yarn.x) <= 7 && p.y >= GY - yarn.h - 12 && p.y <= GY - yarn.h + 2;
    const hitBowl = p => bowl && Math.abs(p.x - bowl.x) <= 8 && p.y >= GY - 9 - bowl.h && p.y <= GY + 2;
    const hitCat  = p => Math.abs(p.x - cat.x) <= 14 && p.y >= GY - 19 && p.y <= GY + 3;

    function poke() {
        spawnHeart(cat.x + cat.dir * 2, GY - 22);
        if (cat.state === 'playing' || cat.state === 'eating') return;
        setState('reacting', { startle: cat.state === 'sleeping' });
    }

    let drag = null;

    function beginDrag(e, fromSource) {
        const g = document.createElement('canvas');
        const gc = g.getContext('2d');
        g.className = 'wp-ghost';
        if (pixelMode) {
            g.width = 7; g.height = 7;
            drawYarnP(gc, 0, 0, 0.6);
        } else {
            g.width = 56; g.height = 56;
            gc.setTransform(8, 0, 0, 8, 0, 0);
            drawYarnS(gc, 3.5, 3.5, 0.6);
        }
        g.style.width = (7 * S) + 'px';
        g.style.height = (7 * S) + 'px';
        document.body.appendChild(g);
        drag = { id: e.pointerId, g, sx: e.clientX, sy: e.clientY, moved: false, fromSource };
        moveGhost(e);
        try { e.target.setPointerCapture(e.pointerId); } catch (_) { /* yoksay */ }
        window.addEventListener('pointermove', onDragMove);
        window.addEventListener('pointerup', onDragEnd);
        window.addEventListener('pointercancel', onDragCancel);
    }

    function moveGhost(e) {
        drag.g.style.left = e.clientX + 'px';
        drag.g.style.top = e.clientY + 'px';
    }

    function endDrag() {
        if (!drag) return;
        drag.g.remove();
        drag = null;
        window.removeEventListener('pointermove', onDragMove);
        window.removeEventListener('pointerup', onDragEnd);
        window.removeEventListener('pointercancel', onDragCancel);
    }

    function onDragMove(e) {
        if (!drag || e.pointerId !== drag.id) return;
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
        moveGhost(e);
    }

    function onDragEnd(e) {
        if (!drag || e.pointerId !== drag.id) return;
        const r = root.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        const wasClick = drag.fromSource && !drag.moved;
        endDrag();
        if (inside) {
            const p = toLogical(e);
            dropYarn(p.x, p.y);
        } else if (wasClick) {
            dropYarn(rand(24, Math.max(25, W - 24)), 2);
        }
        // şeridin dışında bırakılırsa yumak kaybolur (araç çubuğuna geri döner)
    }

    function onDragCancel(e) {
        if (!drag || e.pointerId !== drag.id) return;
        endDrag();
    }

    canvas.addEventListener('pointerdown', e => {
        const p = toLogical(e);
        if (hitYarn(p)) {
            e.preventDefault();
            yarn = null;
            beginDrag(e, false);
        } else if (hitBowl(p)) {
            if (cat.state !== 'eating') removeBowl();
        } else if (hitCat(p)) {
            poke();
        }
    });

    canvas.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse' || drag) return;
        const p = toLogical(e);
        canvas.style.cursor = hitYarn(p) ? 'grab' : (hitCat(p) || hitBowl(p)) ? 'pointer' : 'default';
    });

    yarnSrc.addEventListener('pointerdown', e => {
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        beginDrag(e, true);
    });

    yarnSrc.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            dropYarn(rand(24, Math.max(25, W - 24)), 2);
        }
    });

    feedBtn.addEventListener('click', feed);

    /* ==========================================================
       PİKSEL MODU – sayfanın geri kalanı
       ========================================================== */
    // Proje kartlarındaki görseller ve emojiler düşük çözünürlüğe indirilip pikselleştirilir
    function pixelateCards(on) {
        document.querySelectorAll('.card-image img').forEach(img => {
            const next = img.nextElementSibling;
            const cv = next && next.classList && next.classList.contains('wp-px') ? next : null;
            if (!on) {
                if (cv) cv.remove();
                img.classList.remove('wp-hidden');
                return;
            }
            if (cv) return;
            const make = () => {
                if (!pixelMode || (img.nextElementSibling && img.nextElementSibling.classList.contains('wp-px'))) return;
                const N = 40;
                const c = document.createElement('canvas');
                c.className = 'wp-px';
                c.width = N; c.height = N;
                c.setAttribute('role', 'img');
                c.setAttribute('aria-label', img.alt || '');
                const g = c.getContext('2d');
                g.imageSmoothingQuality = 'high';
                const sw = img.naturalWidth, sh = img.naturalHeight, m = Math.min(sw, sh);
                g.drawImage(img, (sw - m) / 2, (sh - m) / 2, m, m, 0, 0, N, N);
                try {                                   // renk sayısını azalt (posterize)
                    const id = g.getImageData(0, 0, N, N), d = id.data, st = 255 / 5;
                    for (let i = 0; i < d.length; i += 4) {
                        d[i] = Math.round(d[i] / st) * st;
                        d[i + 1] = Math.round(d[i + 1] / st) * st;
                        d[i + 2] = Math.round(d[i + 2] / st) * st;
                    }
                    g.putImageData(id, 0, 0);
                } catch (_) { /* dosya:// altında okunamaz, sorun değil */ }
                img.classList.add('wp-hidden');
                img.after(c);
            };
            if (img.complete && img.naturalWidth) make();
            else img.addEventListener('load', make, { once: true });
        });

        document.querySelectorAll('.card-emoji').forEach(el => {
            if (on) {
                if (el.dataset.wpEmoji) return;
                const t = el.textContent.trim();
                el.dataset.wpEmoji = t;
                const c = document.createElement('canvas');
                c.className = 'wp-px-emoji';
                c.width = 20; c.height = 20;
                const g = c.getContext('2d');
                g.font = '16px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
                g.textAlign = 'center';
                g.textBaseline = 'middle';
                g.fillText(t, 10, 11);
                el.textContent = '';
                el.appendChild(c);
            } else if (el.dataset.wpEmoji) {
                el.textContent = el.dataset.wpEmoji;
                delete el.dataset.wpEmoji;
            }
        });
    }

    function applyMode() {
        if (pixelBtn) {
            pixelBtn.setAttribute('aria-pressed', pixelMode ? 'true' : 'false');
            if (pixelTxt) pixelTxt.textContent = pixelMode ? 'Normal' : 'Piksel';
        }
        drawIcons();
        resize();
        pixelateCards(pixelMode);
    }

    if (pixelBtn) {
        pixelBtn.addEventListener('click', () => document.body.classList.toggle('pixel-mode'));
    }

    /* ---------------------------------------------------- başlatma */
    readTheme();
    drawIcons();
    new MutationObserver(() => {
        readTheme();
        const pm = document.body.classList.contains('pixel-mode');
        if (pm !== pixelMode) { pixelMode = pm; applyMode(); }
        else if (W) buildBackground();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(root);
    else window.addEventListener('resize', resize);
    resize();
    if (pixelMode) applyMode();

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(en => { inView = en[0].isIntersecting; }).observe(root);
    }

    ENTER.idle({ dur: 1.5 });
    requestAnimationFrame(frame);

    // Sadece okuma amaçlı küçük bir tanı arayüzü
    window.WhiskerPet = {
        get state() { return cat.state; },
        get x() { return cat.x; },
        get pixel() { return pixelMode; },
        bounds: () => [MIN, MAX]
    };
})();
