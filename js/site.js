/* KROMMA TECH — Etapa 3: menu, header ao rolar, WhatsApp, item ativo. */
(() => {
  /* ► Número do WhatsApp (só dígitos, com DDI+DDD, ex.: 5541999999999). Vazio = botões levam à seção #contato. */
  const WA_NUMBER = '';
  const WA_TEXT = 'Olá! Vim pelo site da Kromma Tech e gostaria de atendimento.';
  // sem número configurado, esconde os canais que só existem para o WhatsApp (data-wa-only)
  if (!WA_NUMBER) document.querySelectorAll('[data-wa-only]').forEach(e => e.hidden = true);
  // sem WhatsApp configurado, o botão vira ligação para o telefone da loja (visível na fachada) — nunca um link que não faz nada
  const PHONE = '+554130324864';
  document.querySelectorAll('[data-wa]').forEach(a => {
    if (WA_NUMBER) { a.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(a.dataset.waMsg || WA_TEXT)}`; a.target = '_blank'; a.rel = 'noopener'; }
    else { a.href = 'tel:' + PHONE; if (a.dataset.telLabel) (a.querySelector('.wa-t') || a).textContent = a.dataset.telLabel; }
  });

  const root = document.documentElement, header = document.querySelector('.header'),
        burger = document.querySelector('.burger'), drawer = document.getElementById('drawer');
  const setMenu = open => {
    drawer.classList.toggle('is-open', open); root.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open); burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    burger.querySelector('use').setAttribute('href', `assets/icons/sprite.svg#i-${open ? 'close' : 'menu'}`);
    drawer.inert = !open;
  };
  setMenu(false);
  burger.addEventListener('click', () => setMenu(!drawer.classList.contains('is-open')));
  drawer.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  matchMedia('(min-width:961px)').addEventListener('change', () => setMenu(false));

  // header: some ao descer, volta ao subir
  let last = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY, hide = y > last && y > 480 && !root.classList.contains('menu-open');
    header.classList.toggle('is-hidden', hide); last = y;
  }, { passive: true });

  // item ativo do menu
  const links = [...document.querySelectorAll('.nav a')];
  const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(l => l.classList.toggle('is-active', l === map.get(e.target.id)));
  }), { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
})();

/* ETAPA 4 · vitrine: filtro por categoria + mensagem de WhatsApp por produto */
(() => {
  const grid = document.getElementById('vitrine'); if (!grid) return;
  const cards = [...grid.querySelectorAll('.pc')], chips = [...document.querySelectorAll('.chip')], note = document.querySelector('.feat__note');
  const filter = f => {
    cards.forEach(c => c.hidden = f !== 'all' && c.dataset.cat !== f);
    grid.classList.toggle('is-filtered', f !== 'all');
    chips.forEach(b => { const on = b.dataset.f === f; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    note.hidden = cards.some(c => !c.hidden);
  };
  chips.forEach(b => b.addEventListener('click', () => filter(b.dataset.f)));
  document.querySelectorAll('.cat[data-cat]').forEach(a => a.addEventListener('click', () => { if (a.getAttribute('href') === '#produtos') filter(a.dataset.cat); }));
  filter('all');
})();
