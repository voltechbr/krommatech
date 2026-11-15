/* Comportamentos globais mínimos: header sólido ao rolar, revelação única, vídeo do hero. */
(() => {
  const header = document.querySelector('.header');
  if (header) {
    const on = () => header.classList.toggle('is-solid', scrollY > 24);
    on(); addEventListener('scroll', on, { passive: true });
  }
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('is-in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { threshold: .15 });
  els.forEach(e => io.observe(e));
  document.querySelectorAll('.hero__video').forEach(v => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { v.pause(); return; }
    // data-hold: o hero da home só inicia o vídeo quando o loading entrega (js/hero.js)
    new IntersectionObserver(([e]) => e.isIntersecting ? (v.hasAttribute('data-hold') || v.play().catch(() => {})) : v.pause()).observe(v);
  });
})();
