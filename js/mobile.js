/* KROMMA TECH — Etapa 12: comportamentos de toque (só ativam onde fazem sentido; nada muda no desktop com mouse). */
(() => {
  /* 1) Vitrine em celular: indicador do trilho arrastável (1 traço por card visível) */
  const grid = document.getElementById('vitrine');
  if (grid) {
    const dots = document.createElement('div');
    dots.className = 'feat__dots'; dots.setAttribute('aria-hidden', 'true');
    grid.after(dots);
    let raf = 0;
    const draw = () => {
      raf = 0;
      const n = [...grid.querySelectorAll('.pc')].filter(c => !c.hidden).length;
      if (dots.children.length !== n) dots.replaceChildren(...Array.from({ length: n }, () => document.createElement('i')));
      const max = grid.scrollWidth - grid.clientWidth;
      const idx = max > 2 ? Math.round(grid.scrollLeft / max * (n - 1)) : 0;
      [...dots.children].forEach((d, i) => d.classList.toggle('is-on', i === idx));
      dots.hidden = n < 2;
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(draw); };
    grid.addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    new MutationObserver(queue).observe(grid, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
    draw();
  }

  /* 2) Mapa em tela de toque: não prende a rolagem da página. Um toque ativa o mapa; tocar fora (ou sair da seção) desativa. */
  const map = document.querySelector('.loc__map');
  if (map && matchMedia('(hover:none) and (pointer:coarse)').matches) {
    const tap = document.createElement('button');
    tap.type = 'button'; tap.className = 'loc__tap'; tap.setAttribute('aria-label', 'Ativar o mapa para mover e dar zoom');
    tap.innerHTML = '<span class="label">Toque para mexer no mapa</span>';
    map.appendChild(tap);
    const off = () => map.classList.remove('is-live'), on = () => map.classList.add('is-live');
    tap.addEventListener('click', on);
    document.addEventListener('touchstart', e => { if (!map.contains(e.target)) off(); }, { passive: true });
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { if (!e.isIntersecting) off(); }).observe(map);
  }
})();
