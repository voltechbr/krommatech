/* KROMMA TECH — loading cinematográfico (~2,5 s). Só roda se <html class="has-intro">.
   Uma roda 3D de verdade (WebGL, js/wheel3d.js) atravessa a tela na HORIZONTAL, da esquerda para a direita:
   entra por fora do quadro, acelera, gira com a rotação de uma roda rolando, cresce de leve (proximidade) e sai pela direita.
   Não há movimento de profundidade: a câmera é fixa e a trajetória é um eixo só.
   O resto (logo, rastros, brilho, cortina) é DOM animado por Web Animations API (compositor).
   Linha do tempo (ms):  0 logo · 900 roda entra · ~1500 hero liberado e cortina vermelha segue a roda · 2400 roda sai · 2540 fim */
(() => {
  const root = document.documentElement, el = document.getElementById('intro');
  if (!el) return;
  if (!root.classList.contains('has-intro')) { el.remove(); return; }
  try { sessionStorage.setItem('kromma:intro', '1'); } catch (e) {}

  const $ = s => el.querySelector(s);
  const W = innerWidth, H = innerHeight, narrow = W < 720 || W / H < .9;
  const EXPO = 'cubic-bezier(.16,1,.3,1)';
  const T_W = 900, D_W = narrow ? 1350 : 1500, T_END = T_W + D_W + 140, SHUT = 24;   // roda: 900→2400 · fim em 2540
  const anims = [];
  const run = (node, keys, o) => { const a = node.animate(keys, { fill: 'both', easing: 'linear', ...o }); anims.push(a); return a; };
  const rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(); // determinístico
  const f = n => n.toFixed(1);
  const c01 = x => Math.min(1, Math.max(0, x));
  const sm = x => { x = c01(x); return x * x * (3 - 2 * x); };

  /* ---------- trajetória da roda (única fonte de verdade: usada pelo 3D e pelo DOM) ---------- */
  const R0 = narrow ? Math.min(H * .34, W * .6) : Math.min(H * .42, W * .3);   // raio do pneu (px)
  const cy = H * .5 + (narrow ? 0 : H * .015);
  const X0 = -R0 * 1.5, X1 = W + R0 * 1.55, ACC = .2;
  const uOf = t => c01((t - T_W) / D_W);
  const prog = u => ACC * u + (1 - ACC) * u * u;                  // aceleração: começa rápida o bastante e termina em velocidade máxima
  const spd = u => (ACC + 2 * (1 - ACC) * u) / (2 - ACC);        // 0,1 … 1
  const xOf = u => X0 + (X1 - X0) * prog(u);
  const rOf = u => R0 * (.94 + .17 * Math.pow(u, 1.3));          // cresce ~18% ao passar: proximidade, sem vir do fundo
  const spinOf = u => .5 + 1.2 * (xOf(u) - X0) / R0;             // rolagem (rad); 1,2× para dar mais velocidade
  const yawOf = u => -(24 - 12 * Math.sin(Math.PI * u)) * Math.PI / 180;
  const PITCH = 6 * Math.PI / 180;
  const poseAt = t => { const u = uOf(t), x = xOf(u); return { px: x, py: cy, R: rOf(u), yaw: yawOf(u), pitch: PITCH, spin: spinOf(u), envRot: (x / W - .5) * .9 }; };
  const wxT = t => xOf(uOf(t));

  /* ---------- roda 3D ---------- */
  const canvas = $('.intro__wheel');
  const ratio = Math.max(.75, Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(3.4e6 / (W * H))));
  const wheel = window.KrommaWheel ? window.KrommaWheel.create(canvas, W, H, ratio, R0) : null;   // null → sem WebGL: segue só com rastros
  let N = narrow ? 8 : 14, cleared = false, slow = 0, lastT = 0, nT = 0;
  const drawWheel = t => {
    if (!wheel) return;
    if (t < T_W - 60 || t > T_W + D_W + 60) { if (!cleared) { wheel.clear(); cleared = true; } return; }
    cleared = false;
    const poses = [];
    for (let k = 0; k < N; k++) poses.push(poseAt(t + SHUT * ((k + .5 + (rnd() - .5) * .7) / N - .5)));
    wheel.render(poses, Math.abs(wxT(t + SHUT / 2) - wxT(t - SHUT / 2)) / N);
    if (lastT) { slow += (t - lastT > 27) ? 1 : -.5; slow = Math.max(0, slow); nT++; if (slow > 5 && N > 6) { N -= 2; slow = 0; } }   // desempenho: reduz sub-quadros se o aparelho sofrer
    lastT = t;
  };

  /* ---------- rastros, brilho e flare (horizontais, atrás/à frente da roda) ---------- */
  const SAMPLES = 36, t0k = T_W - 60, durK = D_W + 140;
  const times = Array.from({ length: SAMPLES + 1 }, (_, j) => t0k + durK * j / SAMPLES);
  const off = t => (t - t0k) / durK;
  const trail = $('.intro__trail');

  const nS = narrow ? 16 : 30;
  for (let i = 0; i < nS; i++) {
    const d = document.createElement('i');
    d.className = 'intro__streak' + (i % 5 === 0 ? ' intro__streak--w' : i % 3 === 0 ? '' : ' intro__streak--r');
    const yo = (rnd() * 2 - 1) * R0 * .95, h = rnd() < .25 ? 3 : rnd() < .5 ? 2 : 1, len = R0 * (.8 + rnd() * 2.2);
    const lag = rnd() < .5 ? 0 : 40 + rnd() * 160, gap = R0 * rnd() * .15, ua = .08 + rnd() * .35, om = .45 + rnd() * .5;
    d.style.cssText = `width:${f(len)}px;height:${h}px`; trail.appendChild(d);
    run(d, times.map(t => {
      const u = uOf(t), R = rOf(u), sp = spd(u);
      const xe = wxT(t - lag) - Math.sqrt(Math.max(0, 1 - Math.pow(yo / R, 2))) * R * .94 - gap;
      const L = Math.max(.02, sm(sp * 1.15)) * len, o = om * sm((u - ua) / .12) * c01(sp * 1.5) * (1 - sm((u - .9) / .1));
      return { offset: off(t), opacity: o, transform: `translate3d(${f(xe - len)}px,${f(cy + yo)}px,0) scaleX(${(L / len).toFixed(3)})` };
    }), { duration: durK, delay: t0k });
  }

  const aura = document.createElement('div'), AS = R0 * 3.6;
  aura.className = 'intro__aura'; aura.style.cssText = `width:${f(AS)}px;height:${f(AS * .8)}px`; trail.insertBefore(aura, trail.firstChild);
  run(aura, times.map(t => { const u = uOf(t), sp = spd(u); return { offset: off(t), opacity: .85 * sm(sp * 1.3) * (1 - sm((u - .92) / .08)) * sm(u / .1), transform: `translate3d(${f(wxT(t) - AS / 2)}px,${f(cy - AS * .4)}px,0)` }; }), { duration: durK, delay: t0k });

  const flare = $('.intro__flare'), FW = W * .9;
  flare.style.width = f(FW) + 'px';
  run(flare, times.map(t => { const u = uOf(t), sp = spd(u); return { offset: off(t), opacity: .6 * sm((sp - .4) / .5) * (1 - sm((u - .93) / .07)), transform: `translate3d(${f(wxT(t) - FW / 2)}px,${f(cy - 1)}px,0) scaleX(${(.35 + .65 * sp).toFixed(3)})` }; }), { duration: durK, delay: t0k });

  /* ---------- cortina diagonal (12° da logo): a borda acompanha o eixo da roda e libera o HERO atrás dela ---------- */
  const dx = H * Math.tan(12 * Math.PI / 180), scene = $('.intro__scene'), edge = $('.intro__edge');
  const LO = -dx / 2 - 30;
  const exOf = t => Math.max(LO, wxT(t) + .12 * rOf(uOf(t)));
  const wk = [], ek = [], WN = 48;
  for (let j = 0; j <= WN; j++) {
    const t = T_W + D_W * j / WN, ex = exOf(t), o = j / WN;
    wk.push({ offset: o, clipPath: `polygon(${f(ex + dx / 2)}px 0,${f(W + dx + 60)}px 0,${f(W + dx + 60)}px 100%,${f(ex - dx / 2)}px 100%)` });
    ek.push({ offset: o, opacity: ex > LO + 4 ? 1 : 0, transform: `translate3d(${f(ex)}px,0,0) skewX(-12deg)` });
  }
  run(scene, wk, { duration: D_W, delay: T_W });
  run(edge, ek, { duration: D_W, delay: T_W });
  let T_GO = T_W + D_W * .45, T_MID = T_W + D_W * .5;
  for (let t = T_W; t <= T_W + D_W; t += 5) { if (exOf(t) > 0) { T_GO = t; break; } }
  for (let t = T_W; t <= T_W + D_W; t += 5) { if (wxT(t) >= W / 2) { T_MID = t; break; } }

  // tremor curto quando a roda cruza o centro
  run($('.intro__stage'), [
    { transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(-3px,2px,0)', offset: .2 }, { transform: 'translate3d(4px,-3px,0)', offset: .4 },
    { transform: 'translate3d(-3px,-1px,0)', offset: .6 }, { transform: 'translate3d(1px,1px,0)', offset: .8 }, { transform: 'translate3d(0,0,0)' }
  ], { duration: 320, delay: T_MID - 120 });

  /* ---------- logo: aparece no centro e pousa no header (FLIP) ---------- */
  const logo = $('.intro__logo'), ring = $('.intro__ring');
  const L = Math.min(Math.max(Math.min(W, H) * .36, 150), 260), LH = L * 367 / 376;
  logo.style.width = L + 'px';
  const hl = document.querySelector('.header .logo'), r = hl ? hl.getBoundingClientRect() : { left: 16, top: 8, width: 56 };
  const c0 = `translate3d(${f(W / 2 - L / 2)}px,${f(H / 2 - LH / 2)}px,0)`;
  run(logo, [
    { offset: 0, opacity: 0, transform: `${c0} scale(1.22)`, easing: EXPO },
    { offset: .26, opacity: 1, transform: `${c0} scale(1)` },
    { offset: .42, opacity: 1, transform: `${c0} scale(1)`, easing: EXPO },
    { offset: 1, opacity: 1, transform: `translate3d(${f(r.left)}px,${f(r.top)}px,0) scale(${(r.width / L).toFixed(4)})` }
  ], { duration: 1500 });
  Object.assign(ring.style, { width: L * .98 + 'px', height: L * .98 + 'px', left: f(W / 2 - L * .49) + 'px', top: f(H / 2 - L * .49) + 'px' });
  run(ring, [{ opacity: .9, transform: 'scale(.9)' }, { opacity: 0, transform: 'scale(2.1)' }], { duration: 900, delay: 330, easing: EXPO });
  const line = $('.intro__line');
  run(line, [{ opacity: 1, transform: 'scaleX(0)' }, { opacity: 1, transform: 'scaleX(1)', offset: .55 }, { opacity: 0, transform: 'scaleX(1)' }], { duration: 1000, delay: 80, easing: EXPO });

  /* ---------- fim, pular e entrega ao hero ---------- */
  const skip = $('.intro__skip');
  run(skip, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 800 });
  let went = false, ended = false, manual = /[?&]hold(=|&|$)/.test(location.search);   // ?intro&hold congela no quadro 0 (QA)
  const go = () => { if (went) return; went = true; document.dispatchEvent(new CustomEvent('kromma:hero-go')); };
  const end = () => {
    if (ended) return; ended = true; go();
    root.classList.add('hero-go'); root.classList.remove('has-intro');
    anims.forEach(a => { try { a.cancel(); } catch (e) {} }); el.remove();
  };
  const t0 = performance.now();
  (function tick() {
    if (ended || manual) return;
    const t = performance.now() - t0;
    if (t >= T_GO) go();
    if (t >= T_END) return end();
    drawWheel(t);
    requestAnimationFrame(tick);
  })();
  const quit = () => {
    if (ended) return; go();
    const o = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-out', fill: 'forwards' });
    o.onfinish = end; setTimeout(end, 450);
  };
  skip.addEventListener('click', quit);
  addEventListener('keydown', e => { if (e.key === 'Escape') quit(); });

  // depuração/QA: ?intro e, no console, __krommaIntro.seek(ms) congela a animação num instante (0–2540)
  window.__krommaIntro = { seek(t) { manual = true; anims.forEach(a => { try { a.pause(); a.currentTime = t; } catch (e) {} }); cleared = false; drawWheel(t); return { T_GO, T_MID, T_END, N, gl: !!wheel }; },
    still(t, n) { manual = true; cleared = false; const k = N; N = n || 1; const sh = SHUT; wheel && wheel.render(Array.from({ length: N }, () => poseAt(t)), 0); N = k; } };
})();
