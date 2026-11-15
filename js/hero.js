/* KROMMA TECH — Etapa 2: controle do hero.
   · libera as animações de entrada e o vídeo quando o loading entrega (evento kromma:hero-go) ou, sem loading, logo ao carregar;
   · parallax leve de rolagem (--p) e de ponteiro (só mouse), pausado quando o hero sai da tela. */
(() => {
  const root = document.documentElement, hero = document.querySelector('.hero--home');
  if (!hero) return;
  const video = hero.querySelector('.hero__video');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let released = false;
  const release = () => {
    if (released) return; released = true;
    root.classList.add('hero-go');
    if (video) {
      video.removeAttribute('data-hold');
      const save = navigator.connection && navigator.connection.saveData; // economia de dados: mantém o poster
      if (!reduce && !save) { try { video.currentTime = 0; } catch (e) {} video.play().catch(() => {}); }
    }
  };
  document.addEventListener('kromma:hero-go', release);
  if (!root.classList.contains('has-intro')) requestAnimationFrame(release);
  setTimeout(release, 7200); // rede de segurança (o loading nunca segura o site)

  // ajuste de título: se a fonte (ou a fonte reserva) deixar uma linha mais larga que o espaço, reduz proporcionalmente; nunca aumenta
  const title = hero.querySelector('.hero__title'), copy = hero.querySelector('.hero__copy');
  const fit = () => {
    if (!title || !copy) return;
    title.style.setProperty('--fit', 1);
    const avail = Math.min(copy.clientWidth, innerWidth - 2 * parseFloat(getComputedStyle(copy.parentElement).paddingLeft || 0));
    const need = Math.max(...[...title.querySelectorAll('.line__in')].map(n => { const r = document.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect().width; }));
    title.style.setProperty('--fit', need > avail ? Math.max(.5, avail / need * .985).toFixed(3) : 1);
  };
  fit(); addEventListener('resize', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  if (reduce) return;

  // rolagem: --p (0→1) alimenta parallax do vídeo e saída suave do texto
  let sTick = false, visible = true;
  const scroll = () => {
    sTick = false;
    const p = Math.min(1, Math.max(0, scrollY / Math.max(1, hero.offsetHeight)));
    hero.style.setProperty('--p', p.toFixed(3));
  };
  addEventListener('scroll', () => { if (!sTick) { sTick = true; requestAnimationFrame(scroll); } }, { passive: true });
  scroll();
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(hero);

  // ponteiro: só com mouse; o vídeo "respira" alguns pixels
  if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const loop = () => {
      cx += (tx - cx) * .08; cy += (ty - cy) * .08;
      hero.style.setProperty('--mx', cx.toFixed(2) + 'px'); hero.style.setProperty('--my', cy.toFixed(2) + 'px');
      raf = (Math.abs(tx - cx) + Math.abs(ty - cy) > .05 && visible) ? requestAnimationFrame(loop) : 0;
    };
    hero.addEventListener('pointermove', e => {
      tx = -(e.clientX / innerWidth - .5) * 22; ty = -(e.clientY / innerHeight - .5) * 12;
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
  }
})();
