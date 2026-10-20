/* =========================================================
   Happy Dussehra 2026 - game + effects
   Plain JS, no dependencies. Mobile-first: particle counts scale
   with screen size, touch hold-to-charge, haptics, reduced-motion.
   ========================================================= */
(() => {
    'use strict';

    /* ---------- tiny helpers ---------- */
    const $ = (id) => document.getElementById(id);
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const rand = (a, b) => a + Math.random() * (b - a);
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = () => mqReduce.matches;
    const isSmall = () => window.innerWidth < 768;
    /* particle budget: ~half on phones, minimal when reduced motion */
    const budget = () => (reduced() ? 0.25 : isSmall() ? 0.55 : 1);

    const PALETTE = ['#ffd700', '#ff9933', '#ff5e00', '#ff2d95', '#2de2ff', '#7dff6b', '#ffffff'];

    const store = {
        get(k, d) { try { const v = localStorage.getItem('dussehra2026:' + k); return v === null ? d : v; } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem('dussehra2026:' + k, String(v)); } catch (e) { /* storage blocked */ } }
    };

    const state = {
        sound: store.get('sound', '1') === '1',
        haptics: store.get('haptics', '1') === '1',
        name: store.get('name', ''),
        best: parseInt(store.get('best', '0'), 10) || 0
    };

    /* ---------- elements ---------- */
    const hero = $('hero'), heroInner = $('heroInner'), stage = $('stage'), scene = $('scene');
    const rama = $('rama'), ravan = $('ravan'), arrow = $('arrow'), flashEl = $('flash'), fxLayer = $('fxLayer');
    const hpFill = $('hpFill'), hpTrail = $('hpTrail'), hpText = $('hpText'), hpBar = $('hpBar');
    const scoreText = $('scoreText'), comboEl = $('combo'), pips = [...document.querySelectorAll('#pips .pip')], pipsWrap = $('pips');
    const shootBtn = $('shootBtn'), shootHolder = $('shootHolder'), shootMain = $('shootMain'), shootHint = $('shootHint');
    const charge = $('charge'), chargeFill = $('chargeFill'), chargeLabel = $('chargeLabel'), chargeZone = $('chargeZone');
    const soundBtn = $('soundBtn'), soundIcon = $('soundIcon'), hapticBtn = $('hapticBtn');
    const music = $('audioPlayer'), playBtn = $('playBtn'), progressBar = $('progressBar'), progressContainer = $('progressContainer');
    const scrubber = $('scrubber'), timeDisplay = $('timeDisplay');
    const splash = $('splash'), beginBtn = $('beginBtn'), beginMuteBtn = $('beginMuteBtn'), nameInput = $('nameInput');
    const victory = $('victory'), toastEl = $('toast'), srStatus = $('srStatus');
    const heads = [...ravan.querySelectorAll('.rhead')];
    const bowString = $('bowString'), drawArm = $('drawArm'), nocked = $('nocked');
    const bowAnchor = $('bowAnchor'), ravanTarget = $('ravanTarget');

    /* ---------- config ---------- */
    const CFG = {
        maxArrows: 10, hp: 100, normal: 10, perfect: 20, // 10 normal arrows always kill; a super charged arrow does double
        zone: [0.72, 0.92],          // sweet spot on the 0..1 charge meter
        period: 950,                 // ms to charge 0 -> 1
        tapMs: 200                   // shorter press = plain tap (normal shot)
    };
    chargeZone.parentElement.style.setProperty('--zone-start', (CFG.zone[0] * 100) + '%');
    chargeZone.parentElement.style.setProperty('--zone-width', ((CFG.zone[1] - CFG.zone[0]) * 100) + '%');
    const LOSS_ORDER = [0, 2, 3, 6, 1, 5, 4, 7, 9, 8]; // top-outer heads fall first, centre head last

    /* ---------- accessibility / feedback helpers ---------- */
    const say = (msg) => { srStatus.textContent = ''; setTimeout(() => { srStatus.textContent = msg; }, 30); };
    let toastTimer;
    function toast(msg, ms = 2600) {
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
    }
    const canVibrate = typeof navigator.vibrate === 'function';
    function buzz(pattern) {
        if (!canVibrate || !state.haptics) return;
        try { navigator.vibrate(pattern); } catch (e) { /* unsupported */ }
    }

    /* =========================================================
       Sound effects (Web Audio, generated - no files)
       ========================================================= */
    let actx = null, master = null, noiseBuf = null;
    function ensureAudio() {
        if (actx) return actx;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try {
            actx = new AC();
            master = actx.createGain();
            master.gain.value = 0.7;
            master.connect(actx.destination);
        } catch (e) { actx = null; }
        return actx;
    }
    function resumeAudio() {
        const c = ensureAudio();
        if (c && c.state === 'suspended') c.resume().catch(() => {});
    }
    function tone({ f = 440, f2 = null, t = 0.15, type = 'sine', vol = 0.2, delay = 0 }) {
        if (!actx || !state.sound) return;
        const now = actx.currentTime + delay;
        const o = actx.createOscillator(), gn = actx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, now);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + t);
        gn.gain.setValueAtTime(0.0001, now);
        gn.gain.exponentialRampToValueAtTime(vol, now + 0.012);
        gn.gain.exponentialRampToValueAtTime(0.0001, now + t);
        o.connect(gn); gn.connect(master);
        o.start(now); o.stop(now + t + 0.03);
    }
    function noise({ t = 0.2, vol = 0.2, freq = 1200, q = 0.8, delay = 0 }) {
        if (!actx || !state.sound) return;
        if (!noiseBuf) {
            noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
            const d = noiseBuf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        const now = actx.currentTime + delay;
        const src = actx.createBufferSource(), bp = actx.createBiquadFilter(), gn = actx.createGain();
        src.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
        gn.gain.setValueAtTime(vol, now);
        gn.gain.exponentialRampToValueAtTime(0.0001, now + t);
        src.connect(bp); bp.connect(gn); gn.connect(master);
        src.start(now); src.stop(now + t + 0.03);
    }
    const sfx = {
        zone() { tone({ f: 1250, t: 0.06, type: 'triangle', vol: 0.07 }); },
        release() { noise({ t: 0.2, vol: 0.28, freq: 2600 }); tone({ f: 900, f2: 180, t: 0.2, type: 'triangle', vol: 0.12 }); },
        hit() { tone({ f: 170, f2: 45, t: 0.28, vol: 0.55 }); noise({ t: 0.22, vol: 0.28, freq: 900 }); },
        perfect() { [660, 880, 1320].forEach((f, i) => tone({ f, t: 0.35, type: 'triangle', vol: 0.17, delay: i * 0.07 })); },
        boom() { tone({ f: 120, f2: 30, t: 0.7, vol: 0.7 }); noise({ t: 0.8, vol: 0.5, freq: 500, q: 0.4 }); },
        victory() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone({ f, t: 0.42, type: 'triangle', vol: 0.18, delay: i * 0.12 })); },
        ding(i = 0) { tone({ f: 880 + i * 110, t: 0.5, vol: 0.15 }); },
        vice() { tone({ f: 520, f2: 780, t: 0.18, type: 'triangle', vol: 0.12 }); }
    };

    /* =========================================================
       FX canvas: sparks, fireworks, confetti, petals, trails
       ========================================================= */
    const fx = (() => {
        const canvas = $('fx'), ctx = canvas.getContext('2d');
        const parts = [];
        let W = 0, H = 0, dpr = 1, running = false, last = 0;
        const cap = () => (isSmall() ? 320 : 720);

        function resize() {
            const w = window.innerWidth, h = canvas.clientHeight || window.innerHeight;
            if (w === W && Math.abs(h - H) < 1) return; // ignores mobile address-bar resizes (canvas is 100lvh)
            W = w; H = h;
            dpr = Math.min(window.devicePixelRatio || 1, isSmall() ? 1 : 1.5); // sparks don't need retina sharpness; saves fill-rate on phones
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function add(p) {
            if (parts.length >= cap()) return;
            parts.push(p);
            kick();
        }
        function spark(x, y, o = {}) {
            const a = o.angle !== undefined ? o.angle : rand(0, Math.PI * 2);
            const s = o.speed || rand(60, 240);
            const life = o.life || rand(0.5, 1);
            add({ k: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life,
                size: o.size || rand(1.5, 3), color: o.color || pick(PALETTE), g: o.g === undefined ? 200 : o.g, drag: o.drag || 0.98 });
        }
        function burst(x, y, n, o = {}) {
            n = Math.round(n * budget());
            const colors = o.colors || PALETTE;
            for (let i = 0; i < n; i++) {
                spark(x, y, {
                    angle: (i / n) * Math.PI * 2 + rand(-0.15, 0.15),
                    speed: rand(o.min || 80, o.max || 260), life: rand(0.6, o.life || 1.1),
                    size: rand(1.6, o.size || 3.2), color: pick(colors), g: o.g === undefined ? 220 : o.g, drag: 0.972
                });
            }
        }
        function sparkle(x, y, n = 8) {
            if (reduced()) return;
            n = Math.max(1, Math.round(n * (isSmall() ? 0.8 : 1)));
            for (let i = 0; i < n; i++) spark(x, y, { speed: rand(30, 130), life: rand(0.35, 0.7), size: rand(1.4, 2.6), color: pick(['#fff3b0', '#ffd700', '#ffb347']), g: 60 });
        }
        function trail(x, y, hot) {
            if (reduced()) return;
            const n = hot ? 3 : 2;
            for (let i = 0; i < n; i++) {
                spark(x + rand(-3, 3), y + rand(-3, 3), {
                    speed: rand(10, 60), life: rand(0.25, hot ? 0.6 : 0.45), size: rand(1.6, hot ? 4 : 3),
                    color: hot ? pick(['#ff3b00', '#ff9d00', '#fff3b0']) : pick(['#ffd700', '#ff9933', '#fff3b0']), g: -30
                });
            }
        }
        function firework(x, y, color) {
            const n = Math.round(46 * budget());
            const base = color || pick(PALETTE);
            for (let i = 0; i < n; i++) {
                const ring = i % 2 ? 1 : 0.62;
                spark(x, y, {
                    angle: (i / n) * Math.PI * 2 + rand(-0.06, 0.06), speed: rand(90, 230) * ring, life: rand(0.9, 1.5),
                    size: rand(1.6, 2.8), color: Math.random() < 0.7 ? base : pick(PALETTE), g: 90, drag: 0.965
                });
            }
        }
        function rocket(x, ty, color) {
            const d = rand(0.55, 0.85);
            add({ k: 3, x, y: H, vx: rand(-14, 14), vy: (ty - H) / d, life: d, max: d, color, size: 2, g: 0, drag: 1 });
        }
        function fireworks(count, spanMs) {
            count = Math.max(2, Math.round(count * (reduced() ? 0.25 : isSmall() ? 0.65 : 1)));
            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    if (document.hidden) return;
                    rocket(rand(0.12, 0.88) * W, rand(0.1, 0.5) * H, pick(PALETTE));
                }, (i / count) * spanMs + rand(0, 200));
            }
        }
        function shower(n, kind) {
            n = Math.round(n * budget());
            for (let i = 0; i < n; i++) {
                const life = rand(5, 9);
                add({ k: kind, x: rand(0, W), y: -rand(10, H * 0.45), vx: rand(-30, 30), vy: rand(70, 190), life, max: life,
                    w: kind === 1 ? rand(5, 9) : rand(4, 7), h: kind === 1 ? rand(8, 14) : rand(7, 11),
                    rot: rand(0, 6.28), vr: rand(-6, 6), flip: rand(0, 6.28), vf: rand(3, 8), sway: rand(0, 6.28),
                    color: kind === 1 ? pick(PALETTE) : pick(['#ff9933', '#ffb347', '#ff5e00', '#ffd700', '#ff7aa8']), g: 40, drag: 1 });
            }
        }
        const confetti = (n) => shower(n, 1);
        const petals = (n) => shower(n, 2);

        function clear() {
            parts.length = 0;
            ctx.clearRect(0, 0, W, H);
        }

        function frame(t) {
            if (!parts.length) { running = false; ctx.clearRect(0, 0, W, H); return; }
            const dt = Math.min(0.033, (t - last) / 1000) || 0.016;
            last = t;
            ctx.clearRect(0, 0, W, H);
            let mode = '';
            const setMode = (m) => { if (mode !== m) { ctx.globalCompositeOperation = m; mode = m; } };
            for (let i = parts.length - 1; i >= 0; i--) {
                const p = parts[i];
                p.life -= dt;
                if (p.life <= 0 || (p.k !== 3 && p.y > H + 40)) {
                    const dead = p;
                    parts[i] = parts[parts.length - 1]; parts.pop();
                    if (dead.k === 3) firework(dead.x, dead.y, dead.color);
                    continue;
                }
                if (p.k === 0) {
                    const d = Math.pow(p.drag, dt * 60);
                    p.vx *= d; p.vy = p.vy * d + p.g * dt;
                    p.x += p.vx * dt; p.y += p.vy * dt;
                    setMode('lighter');
                    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
                    ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); ctx.lineTo(p.x, p.y); ctx.stroke();
                } else if (p.k === 3) {
                    p.x += p.vx * dt; p.y += p.vy * dt;
                    if (Math.random() < 0.8) spark(p.x, p.y, { speed: rand(5, 40), angle: Math.PI / 2 + rand(-0.5, 0.5), life: rand(0.2, 0.4), size: 2, color: '#ffe7a3', g: 20 });
                    setMode('lighter');
                    ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 6.283); ctx.fill();
                } else {
                    p.vy = Math.min(p.vy + p.g * dt, p.k === 1 ? 220 : 120);
                    p.sway += dt * 2.2; p.rot += p.vr * dt; p.flip += p.vf * dt;
                    p.x += (p.vx + Math.sin(p.sway) * (p.k === 2 ? 55 : 25)) * dt; p.y += p.vy * dt;
                    setMode('source-over');
                    ctx.globalAlpha = clamp(p.life * 1.2, 0, 1);
                    ctx.fillStyle = p.color;
                    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
                    const sq = Math.cos(p.flip);
                    if (p.k === 1) { ctx.scale(1, sq); ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
                    else { ctx.beginPath(); ctx.ellipse(0, 0, p.w, Math.max(1, Math.abs(sq) * p.h), 0, 0, 6.283); ctx.fill(); }
                    ctx.restore();
                }
            }
            setMode('source-over'); ctx.globalAlpha = 1;
            requestAnimationFrame(frame);
        }
        function kick() {
            if (running) return;
            running = true; last = performance.now();
            requestAnimationFrame(frame);
        }
        resize();
        let rt = 0;
        window.addEventListener('resize', () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(resize); });
        return { burst, sparkle, trail, fireworks, confetti, petals, clear, resize };
    })();

    /* =========================================================
       Ambient scenery: stars, embers, parallax, reveal
       ========================================================= */
    (function buildSky() {
        const stars = $('stars'), embers = $('embers');
        /* Stars: 3 animated layers, each ONE element carrying many box-shadow dots
           (instead of ~100 separately animated nodes - far cheaper on phones). */
        const starLayer = (n, size, glow, delay) => {
            const el = document.createElement('i');
            el.className = 'star-layer';
            el.style.width = el.style.height = size + 'px';
            const shadows = [];
            for (let i = 0; i < n; i++) shadows.push(`${rand(0, 100).toFixed(1)}vw ${rand(0, 80).toFixed(1)}vh ${glow}px 0 ${glow ? '#fff3d0' : '#fff'}`);
            el.style.boxShadow = shadows.join(',');
            el.style.animationDelay = delay + 's';
            return el;
        };
        const per = isSmall() ? 34 : 60;
        stars.append(starLayer(per, 2, 0, 0), starLayer(per, 2, 0, -1.3), starLayer(isSmall() ? 7 : 12, 3, 5, -2.4));
        const ef = document.createDocumentFragment();
        const nEmb = isSmall() ? 9 : 20;
        for (let i = 0; i < nEmb; i++) {
            const e = document.createElement('i');
            const d = rand(7, 14);
            e.className = 'ember';
            e.style.setProperty('--x', rand(0, 100) + '%');
            e.style.setProperty('--s', rand(3, 7).toFixed(1) + 'px');
            e.style.setProperty('--d', d.toFixed(1) + 's');
            e.style.setProperty('--delay', (-rand(0, d)).toFixed(1) + 's');
            e.style.setProperty('--dx', rand(-60, 60).toFixed(0) + 'px');
            ef.appendChild(e);
        }
        embers.appendChild(ef);
    })();

    const parLayers = [...document.querySelectorAll('[data-par]')];
    let parTick = false;
    function onScroll() {
        if (parTick || reduced()) return;
        parTick = true;
        requestAnimationFrame(() => {
            const y = window.scrollY;
            if (y < hero.offsetHeight * 1.2) parLayers.forEach((el) => { el.style.transform = `translate3d(0,${(y * parseFloat(el.dataset.par)).toFixed(1)}px,0)`; });
            parTick = false;
        });
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('paused', document.hidden));

    (function reveal() {
        const els = [...document.querySelectorAll('.reveal')];
        if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
        els.forEach((e) => io.observe(e));
    })();

    /* desktop-only card tilt + shine (phones use the scroll-in glow instead) */
    if (mqFine.matches && !reduced()) {
        document.querySelectorAll('.tilt').forEach((card) => {
            card.addEventListener('pointermove', (e) => {
                const r = card.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
                card.style.setProperty('--ry', ((px - 0.5) * 8).toFixed(2) + 'deg');
                card.style.setProperty('--rx', ((0.5 - py) * 6).toFixed(2) + 'deg');
                card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
                card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
            });
            card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
        });
    }

    /* tap sparkles on phones, light cursor trail on desktop */
    let splashOpen = true;
    document.addEventListener('pointerdown', (e) => {
        if (reduced() || splashOpen) return;
        if (e.target.closest && e.target.closest('#shootBtn, .audio-progress-container')) return;
        fx.sparkle(e.clientX, e.clientY, 9);
    }, { passive: true });
    if (mqFine.matches) {
        let lastTrail = 0;
        document.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse' || splashOpen || reduced()) return;
            const now = performance.now();
            if (now - lastTrail < 45) return;
            lastTrail = now;
            fx.sparkle(e.clientX, e.clientY, 1);
        }, { passive: true });
    }

    /* =========================================================
       Game
       ========================================================= */
    const g = {
        hp: CFG.hp, arrows: CFG.maxArrows, used: 0, perfects: 0, streak: 0,
        score: 0, shown: 0, phase: 'idle', meter: 0, chargeStart: 0, pointerId: null, inZone: false
    };
    let suppressClick = false;
    let scoreTween = 0;

    function setPhase(p) {
        g.phase = p;
        shootBtn.setAttribute('aria-disabled', (p === 'flying' || p === 'burning') ? 'true' : 'false');
        shootHolder.classList.toggle('ready', p === 'idle' || p === 'won');
        shootHolder.classList.toggle('charging', p === 'charging');
        shootBtn.classList.toggle('pressed', p === 'charging');
    }

    function renderPips() {
        pips.forEach((pip, i) => pip.classList.toggle('used', i >= g.arrows));
        pipsWrap.setAttribute('aria-label', `${g.arrows} arrows left`);
    }
    function renderShootText() {
        if (g.phase === 'won') {
            shootMain.textContent = 'Play Again! 🔄';
            shootHint.textContent = 'Tap to start a new battle';
        } else {
            shootMain.textContent = 'Shoot Arrow! 🏹';
            shootHint.textContent = `Hold to charge · ${g.arrows} left`;
        }
    }
    function renderHP() {
        const f = clamp(g.hp / CFG.hp, 0, 1);
        hpFill.style.transform = `scaleX(${f})`;
        hpTrail.style.transform = `scaleX(${f})`;
        hpFill.classList.toggle('mid', g.hp <= 50 && g.hp > 20);
        hpFill.classList.toggle('low', g.hp <= 20);
        hpText.textContent = `${g.hp} HP`;
        hpBar.setAttribute('aria-valuenow', String(g.hp));
        const lostCount = 10 - Math.ceil(g.hp / 10);
        heads.forEach((h, i) => h.classList.toggle('lost', LOSS_ORDER.indexOf(i) < lostCount));
    }
    function addScore(n) {
        g.score += n;
        cancelAnimationFrame(scoreTween);
        const from = g.shown, to = g.score, t0 = performance.now(), dur = reduced() ? 1 : 500;
        const step = (now) => {
            const t = clamp((now - t0) / dur, 0, 1);
            g.shown = Math.round(lerp(from, to, 1 - Math.pow(1 - t, 3)));
            scoreText.textContent = g.shown.toLocaleString();
            if (t < 1) scoreTween = requestAnimationFrame(step);
        };
        scoreTween = requestAnimationFrame(step);
        scoreText.classList.remove('bump'); void scoreText.offsetWidth; scoreText.classList.add('bump');
    }
    function showCombo(mult) {
        if (mult < 2) { comboEl.hidden = true; return; }
        comboEl.hidden = true; void comboEl.offsetWidth;
        comboEl.textContent = '🔥 ×' + mult;
        comboEl.setAttribute('aria-label', 'Combo times ' + mult);
        comboEl.className = 'combo' + (mult >= 3 ? ' x3' : '');
        comboEl.hidden = false;
    }

    /* --- bow drawing --- */
    function setDraw(d) {
        const nx = 128 - d * 20;
        bowString.setAttribute('d', `M132 62 L${nx.toFixed(1)} 130 L132 198`);
        drawArm.setAttribute('d', `M70 104 Q${((70 + nx) / 2).toFixed(1)} ${(124 + d * 4).toFixed(1)} ${nx.toFixed(1)} 130`);
        nocked.setAttribute('transform', `translate(${(-d * 20).toFixed(1)} 0)`);
    }

    /* --- charge meter --- */
    const tri = (x) => { const p = x % 2; return p < 1 ? p : 2 - p; };
    function chargeLoop(now) {
        if (g.phase !== 'charging') return;
        const el = now - g.chargeStart;
        const v = tri(el / CFG.period);
        g.meter = v;
        chargeFill.style.transform = `scaleX(${v.toFixed(3)})`;
        setDraw(clamp(el / 350, 0, 1));
        const inZone = el >= CFG.tapMs && v >= CFG.zone[0] && v <= CFG.zone[1];
        if (inZone !== g.inZone) {
            g.inZone = inZone;
            charge.classList.toggle('perfect', inZone);
            if (inZone) { sfx.zone(); buzz(8); }
        }
        chargeLabel.textContent = inZone ? 'SUPER!' : 'CHARGING';
        requestAnimationFrame(chargeLoop);
    }
    function resetChargeUI() {
        charge.classList.remove('on', 'perfect');
        chargeFill.style.transform = 'scaleX(0)';
        chargeLabel.textContent = 'HOLD';
        g.inZone = false;
    }
    function addRipple(e) {
        const r = shootBtn.getBoundingClientRect();
        const s = document.createElement('span');
        s.className = 'ripple';
        s.style.left = (e.clientX - r.left) + 'px';
        s.style.top = (e.clientY - r.top) + 'px';
        shootBtn.appendChild(s);
        s.addEventListener('animationend', () => s.remove());
    }

    function startCharge(e) {
        if (g.phase !== 'idle') return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        resumeAudio();
        g.phase = 'charging';
        g.pointerId = e.pointerId === undefined ? null : e.pointerId;
        g.chargeStart = performance.now();
        g.meter = 0;
        setPhase('charging');
        charge.classList.add('on');
        if (e.clientX !== undefined && e.clientX !== 0) addRipple(e);
        try { if (g.pointerId !== null) shootBtn.setPointerCapture(g.pointerId); } catch (err) { /* ok */ }
        requestAnimationFrame(chargeLoop);
    }
    function endCharge(e, cancelled) {
        if (g.phase !== 'charging') return;
        if (e && g.pointerId !== null && e.pointerId !== undefined && e.pointerId !== g.pointerId) return;
        const held = performance.now() - g.chargeStart;
        const perfect = held >= CFG.tapMs && g.meter >= CFG.zone[0] && g.meter <= CFG.zone[1];
        resetChargeUI();
        if (cancelled) { setPhase('idle'); setDraw(0); return; }
        suppressClick = true;
        fire(perfect);
    }

    /* --- geometry helpers (scene-local px, robust to the finisher zoom) --- */
    function sceneScale() {
        const s = scene.getBoundingClientRect();
        return { rect: s, k: scene.offsetWidth ? s.width / scene.offsetWidth : 1 };
    }
    function localCenter(el) {
        const { rect, k } = sceneScale();
        const r = el.getBoundingClientRect();
        return { x: (r.left + r.width / 2 - rect.left) / k, y: (r.top + r.height / 2 - rect.top) / k };
    }
    function toScreen(p) {
        const { rect, k } = sceneScale();
        return { x: rect.left + p.x * k, y: rect.top + p.y * k };
    }
    function elScreenCenter(el) {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    /* --- flying arrow --- */
    function flyArrow(from, to, dur, flaming, onHit) {
        arrow.classList.toggle('flaming', flaming);
        arrow.classList.add('on');
        arrow.style.willChange = 'transform';
        const w = arrow.offsetWidth, h = arrow.offsetHeight;
        const dist = Math.hypot(to.x - from.x, to.y - from.y);
        const arc = Math.min(46, dist * 0.14);
        const pos = (p) => ({ x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p) - arc * Math.sin(Math.PI * p) });
        const t0 = performance.now();
        const step = (now) => {
            const t = clamp((now - t0) / dur, 0, 1);
            const p = flaming ? t : Math.pow(t, 1.5);
            const a = pos(p), b = pos(Math.min(1, p + 0.015));
            const ang = Math.atan2(b.y - a.y, b.x - a.x);
            arrow.style.transform = `translate3d(${(a.x - w).toFixed(1)}px,${(a.y - h / 2).toFixed(1)}px,0) rotate(${ang.toFixed(3)}rad)`;
            const tail = toScreen({ x: a.x - Math.cos(ang) * w * 0.7, y: a.y - Math.sin(ang) * w * 0.7 });
            fx.trail(tail.x, tail.y, flaming);
            if (t < 1) requestAnimationFrame(step);
            else { arrow.classList.remove('on'); arrow.style.willChange = ''; onHit(); }
        };
        requestAnimationFrame(step);
    }

    function fire(perfect) {
        if (g.phase !== 'idle' && g.phase !== 'charging') return;
        if (g.arrows <= 0) return;
        setPhase('flying');
        const dmg = perfect ? CFG.perfect : CFG.normal;
        const kill = g.hp - dmg <= 0;
        g.arrows--; g.used++;
        renderPips(); renderShootText();
        setDraw(0);
        rama.classList.add('flying', 'shot');
        setTimeout(() => rama.classList.remove('shot'), 300);
        sfx.release(); buzz(10);
        const from = localCenter(bowAnchor), to = localCenter(ravanTarget);
        if (kill) stage.classList.add('zoom');
        const dur = reduced() ? 260 : kill ? 1350 : 520;
        flyArrow(from, to, dur, kill, () => impact(dmg, perfect, kill, to));
    }

    function spawnFloat(cls, html, p) {
        const el = document.createElement('div');
        el.className = cls;
        el.style.setProperty('--x', p.x + 'px');
        el.style.setProperty('--y', p.y + 'px');
        if (html !== null) el.innerHTML = html;
        fxLayer.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
        setTimeout(() => el.remove(), 1500);
    }
    function flash(big) {
        flashEl.classList.remove('on', 'big'); void flashEl.offsetWidth;
        flashEl.classList.add(big ? 'big' : 'on');
    }
    function shake(big) {
        if (reduced()) return;
        heroInner.classList.remove('shake', 'shake-big'); void heroInner.offsetWidth;
        heroInner.classList.add(big ? 'shake-big' : 'shake');
    }

    function impact(dmg, perfect, kill, localPt) {
        const sp = toScreen(localPt);
        flash(false);
        ravan.classList.add('flash');
        spawnFloat('ring' + (perfect ? ' perfect' : ''), null, localPt);
        fx.burst(sp.x, sp.y, perfect ? 38 : 20, { colors: perfect ? ['#ff2d95', '#2de2ff', '#ffffff', '#ffd700'] : ['#ffd700', '#ff9933', '#ff5e00', '#ffffff'] });
        sfx.hit();
        if (perfect) setTimeout(sfx.perfect, 80);
        buzz(perfect ? [30, 40, 30] : 25);
        scene.classList.add('freeze'); // hit-stop

        setTimeout(() => {
            scene.classList.remove('freeze');
            ravan.classList.remove('flash');
            ravan.classList.remove('hit'); void ravan.offsetWidth; ravan.classList.add('hit');
            setTimeout(() => ravan.classList.remove('hit'), 380);
            rama.classList.remove('flying');
            shake(false);
            g.hp = Math.max(0, g.hp - dmg);
            hpBar.classList.remove('hurt'); void hpBar.offsetWidth; hpBar.classList.add('hurt');
            renderHP();

            if (perfect) g.perfects++;
            g.streak = perfect ? g.streak + 1 : 0;
            const mult = clamp(g.streak, 1, 3);
            const pts = (perfect ? 150 : 40) * mult;
            addScore(pts);
            showCombo(g.streak >= 2 ? mult : 0);
            const label = perfect ? `<span>-${dmg}</span><small>SUPER CHARGED!<br>${mult > 1 ? '×' + mult + ' ' : ''}+${pts}</small>` : `<span>-${dmg}</span><small>+${pts}</small>`;
            spawnFloat('dmg' + (perfect ? ' perfect' : ''), label, { x: localPt.x, y: localPt.y - 14 });
            say(`${perfect ? 'Super charged shot. ' : ''}Ravan hit for ${dmg}. ${g.hp} health left.`);

            if (kill) finisher();
            else setTimeout(() => { setPhase('idle'); renderShootText(); }, reduced() ? 50 : 350);
        }, reduced() ? 0 : 70);
    }

    /* --- finisher: Ravan Dahan --- */
    function finisher() {
        setPhase('burning');
        ravan.classList.add('burning');
        rama.classList.add('victor');
        buzz([40, 30, 40, 30, 60]);
        setTimeout(explode, reduced() ? 250 : 1200);
    }
    function explode() {
        const c = elScreenCenter(ravanTarget);
        ravan.classList.remove('burning');
        ravan.classList.add('exploded');
        flash(true);
        shake(true);
        sfx.boom();
        setTimeout(sfx.victory, 350);
        buzz([80, 40, 80, 40, 160]);
        fx.burst(c.x, c.y, 80, { max: 380, life: 1.5, size: 4, g: 160 });
        fx.burst(c.x, c.y, 40, { colors: ['#ff3b00', '#ff9d00', '#fff3b0'], max: 200, g: -40, life: 1.3, size: 4 });
        fx.fireworks(14, 4500);
        fx.confetti(170);
        fx.petals(40);
        const bonus = g.arrows * 100 + 500;
        addScore(bonus);
        say('Ravan is defeated. Good triumphs over evil!');
        setTimeout(() => stage.classList.remove('zoom'), reduced() ? 0 : 700);
        setTimeout(() => { setPhase('won'); renderShootText(); showVictory(); }, reduced() ? 400 : 1500);
    }

    /* --- victory card --- */
    function showVictory() {
        const stars = g.used <= 7 ? 3 : g.used <= 9 ? 2 : 1;
        const isBest = g.score > state.best;
        if (isBest) { state.best = g.score; store.set('best', g.score); }
        $('vGreet').textContent = state.name ? `Happy Dussehra, ${state.name}! 🪔` : 'Happy Dussehra! 🪔';
        $('vBest').textContent = state.best.toLocaleString();
        $('vArrows').textContent = g.used + ' / ' + CFG.maxArrows;
        $('vPerfects').textContent = String(g.perfects);
        $('vNewBest').hidden = !isBest;
        const starEls = [...document.querySelectorAll('#vStars .star-big')];
        starEls.forEach((s) => s.classList.remove('on'));
        $('vStars').setAttribute('aria-label', `${stars} out of 3 stars`);
        victory.hidden = false;
        $('vAgain').focus({ preventScroll: true });
        const sEl = $('vScore'), t0 = performance.now(), dur = reduced() ? 1 : 1100;
        const step = (now) => {
            const t = clamp((now - t0) / dur, 0, 1);
            sEl.textContent = Math.round(g.score * (1 - Math.pow(1 - t, 3))).toLocaleString();
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        starEls.forEach((s, i) => {
            if (i >= stars) return;
            setTimeout(() => { s.classList.add('on'); sfx.ding(i); buzz(15); }, reduced() ? 0 : 450 + i * 380);
        });
    }
    function hideVictory() {
        if (victory.hidden) return;
        victory.hidden = true;
        shootBtn.focus({ preventScroll: true });
    }

    function resetGame() {
        hideVictory();
        cancelAnimationFrame(scoreTween);
        Object.assign(g, { hp: CFG.hp, arrows: CFG.maxArrows, used: 0, perfects: 0, streak: 0, score: 0, shown: 0, meter: 0 });
        scoreText.textContent = '0';
        comboEl.hidden = true;
        stage.classList.remove('zoom');
        ravan.classList.remove('burning', 'exploded', 'hit', 'flash');
        ravan.classList.remove('respawn'); void ravan.offsetWidth; ravan.classList.add('respawn');
        setTimeout(() => ravan.classList.remove('respawn'), 700);
        rama.classList.remove('victor', 'flying', 'shot');
        scene.classList.remove('freeze');
        fxLayer.innerHTML = '';
        fx.clear();
        setDraw(0);
        resetChargeUI();
        renderHP(); renderPips(); setPhase('idle'); renderShootText();
        say('New battle. Five arrows ready.');
    }

    /* --- shoot button wiring --- */
    shootBtn.addEventListener('pointerdown', (e) => { suppressClick = false; if (g.phase !== 'won') startCharge(e); });
    window.addEventListener('pointerup', (e) => endCharge(e, false));
    window.addEventListener('pointercancel', (e) => endCharge(e, true));
    shootBtn.addEventListener('contextmenu', (e) => e.preventDefault());
    shootBtn.addEventListener('click', () => {
        if (suppressClick) { suppressClick = false; return; }
        resumeAudio();
        if (g.phase === 'won') resetGame();
        else if (g.phase === 'idle') fire(false);   // keyboard Enter/Space or assistive tech
    });
    /* keyboard parity: hold Space / Enter to charge, release to fire */
    shootBtn.addEventListener('keydown', (e) => {
        if ((e.key === ' ' || e.key === 'Enter') && g.phase !== 'won') {
            e.preventDefault();
            if (!e.repeat) startCharge({ pointerType: 'keyboard' });
        }
    });
    shootBtn.addEventListener('keyup', (e) => {
        if ((e.key === ' ' || e.key === 'Enter') && g.phase === 'charging' && g.pointerId === null) {
            e.preventDefault();
            endCharge(null, false);
            suppressClick = false;
        } else if ((e.key === ' ' || e.key === 'Enter') && g.phase === 'won') {
            e.preventDefault();
            resetGame();
        }
    });

    $('vAgain').addEventListener('click', resetGame);
    $('vClose').addEventListener('click', hideVictory);
    victory.addEventListener('click', (e) => { if (e.target === victory) hideVictory(); });
    document.addEventListener('keydown', (e) => {
        if (victory.hidden) return;
        if (e.key === 'Escape') hideVictory();
        if (e.key === 'Tab') {
            const f = [$('vClose'), $('vAgain'), $('vShare')];
            const i = f.indexOf(document.activeElement);
            const next = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
            e.preventDefault(); f[next].focus();
        }
    });

    /* --- share --- */
    function copyText(text) {
        const done = () => toast('Link copied! Paste it in WhatsApp 💬');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(() => legacyCopy(text, done));
        } else legacyCopy(text, done);
    }
    function legacyCopy(text, done) {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;font-size:16px';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { toast('Copy this link: ' + location.href); }
        ta.remove();
    }
    async function share(customText) {
        const url = location.href.split('#')[0];
        const text = customText || `I defeated Ravan in ${g.used} arrows and scored ${g.score.toLocaleString()}! 🏹 Can you beat me? Happy Dussehra 2026 🪔`;
        if (navigator.share) {
            try { await navigator.share({ title: 'Happy Dussehra 2026', text, url }); return; }
            catch (e) { if (e && e.name === 'AbortError') return; }
        }
        copyText(`${text} ${url}`);
    }
    $('vShare').addEventListener('click', () => share());

    /* =========================================================
       Sound / vibration toggles
       ========================================================= */
    function syncToggles() {
        soundBtn.setAttribute('aria-pressed', String(state.sound));
        soundIcon.textContent = state.sound ? '🔊' : '🔇';
        music.muted = !state.sound;
        hapticBtn.setAttribute('aria-pressed', String(state.haptics));
    }
    soundBtn.addEventListener('click', () => {
        state.sound = !state.sound; store.set('sound', state.sound ? '1' : '0');
        syncToggles(); resumeAudio();
        toast(state.sound ? 'Sound on 🔊' : 'Sound off 🔇', 1400);
    });
    if (!canVibrate) hapticBtn.remove();
    else hapticBtn.addEventListener('click', () => {
        state.haptics = !state.haptics; store.set('haptics', state.haptics ? '1' : '0');
        syncToggles();
        toast(state.haptics ? 'Vibration on 📳' : 'Vibration off', 1400);
        buzz(30);
    });

    /* =========================================================
       Music player
       ========================================================= */
    const fmt = (s) => { if (!isFinite(s)) return '0:00'; return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
    function updatePlayButton() {
        playBtn.textContent = music.paused ? '▶' : '⏸';
        playBtn.setAttribute('aria-label', music.paused ? 'Play music' : 'Pause music');
    }
    function updateProgress() {
        const d = music.duration;
        const pct = d && isFinite(d) ? clamp(music.currentTime / d, 0, 1) : 0;
        progressBar.style.transform = `scaleX(${pct})`;
        scrubber.style.left = (pct * 100) + '%';
        timeDisplay.textContent = `${fmt(music.currentTime)} / ${fmt(d)}`;
        progressContainer.setAttribute('aria-valuenow', String(Math.round(pct * 100)));
    }
    playBtn.addEventListener('click', () => {
        resumeAudio();
        if (music.paused) music.play().catch(() => toast('Tap again to play the music 🎵'));
        else music.pause();
    });
    ['timeupdate', 'loadedmetadata', 'durationchange'].forEach((ev) => music.addEventListener(ev, updateProgress));
    ['play', 'pause', 'ended'].forEach((ev) => music.addEventListener(ev, updatePlayButton));

    let dragging = false;
    function seekFromEvent(e) {
        const r = progressContainer.getBoundingClientRect();
        const x = clamp(e.clientX - r.left, 0, r.width);
        const d = music.duration;
        if (d && isFinite(d)) music.currentTime = (x / r.width) * d;
        updateProgress();
    }
    progressContainer.addEventListener('pointerdown', (e) => {
        dragging = true;
        try { progressContainer.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
        seekFromEvent(e);
    });
    progressContainer.addEventListener('pointermove', (e) => { if (dragging) seekFromEvent(e); });
    ['pointerup', 'pointercancel'].forEach((ev) => progressContainer.addEventListener(ev, () => { dragging = false; }));
    progressContainer.addEventListener('keydown', (e) => {
        const d = music.duration;
        if (!d || !isFinite(d)) return;
        if (e.key === 'ArrowRight') { music.currentTime = Math.min(d, music.currentTime + 5); e.preventDefault(); }
        if (e.key === 'ArrowLeft') { music.currentTime = Math.max(0, music.currentTime - 5); e.preventDefault(); }
    });

    /* =========================================================
       Diyas + vice cards
       ========================================================= */
    const diyas = [...document.querySelectorAll('.diya')];
    const diyaCount = $('diyaCount');
    let litCount = 0;
    diyas.forEach((d, i) => d.addEventListener('click', () => {
        resumeAudio();
        if (d.classList.contains('lit')) { sfx.ding(i); return; }
        d.classList.add('lit');
        d.setAttribute('aria-pressed', 'true');
        d.setAttribute('aria-label', `Diya ${i + 1} is lit`);
        litCount++;
        diyaCount.textContent = `${litCount}/${diyas.length}`;
        sfx.ding(i); buzz(15);
        const c = elScreenCenter(d);
        fx.burst(c.x, c.y - 10, 14, { colors: ['#ffd700', '#ff9933', '#fff3b0'], max: 160, g: 80 });
        if (litCount === diyas.length) {
            $('diyaSection').classList.add('all-lit');
            setTimeout(() => {
                sfx.victory(); buzz([30, 30, 60]);
                fx.fireworks(5, 1400);
                fx.petals(24);
                toast('Your home glows with light! ✨ Happy Dussehra!', 3600);
            }, 250);
            say('All five diyas are lit.');
        }
    }));

    const vices = [...document.querySelectorAll('.vice')];
    const viceCount = $('viceCount');
    let viceSeen = 0;
    vices.forEach((v) => v.addEventListener('click', () => {
        resumeAudio();
        const open = v.getAttribute('aria-pressed') === 'true';
        v.setAttribute('aria-pressed', String(!open));
        if (open || v.dataset.seen) return;
        v.dataset.seen = '1';
        viceSeen++;
        viceCount.textContent = `${viceSeen}/${vices.length}`;
        sfx.vice(); buzz(12);
        const c = elScreenCenter(v);
        fx.sparkle(c.x, c.y, 12);
        if (viceSeen === vices.length) {
            setTimeout(() => {
                sfx.victory(); buzz([30, 30, 60]);
                fx.fireworks(6, 1800); fx.confetti(70);
                toast('You found all 10! Now conquer your inner Ravan 💪', 4200);
            }, 400);
        }
    }));

    /* =========================================================
       Intro splash
       ========================================================= */
    function begin(withSound) {
        const n = nameInput.value.trim().replace(/\s+/g, ' ').slice(0, 24);
        state.name = n; store.set('name', n);
        state.sound = withSound; store.set('sound', withSound ? '1' : '0');
        ensureAudio(); resumeAudio();
        syncToggles();
        if (withSound) music.play().catch(() => {});
        splashOpen = false;
        splash.classList.add('out');
        hero.classList.add('started');
        document.documentElement.style.overflow = '';
        setTimeout(() => { splash.hidden = true; }, 600);
    }
    beginBtn.addEventListener('click', () => begin(true));
    beginMuteBtn.addEventListener('click', () => begin(false));
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); } });
    nameInput.value = state.name;
    document.documentElement.style.overflow = 'hidden';

    /* initial render */
    setDraw(0);
    renderHP(); renderPips(); renderShootText(); setPhase('idle');
    updateProgress(); updatePlayButton(); syncToggles();
    try { beginBtn.focus({ preventScroll: true }); } catch (e) { /* ok */ }
})();
