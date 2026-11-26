(() => {
  document.documentElement.classList.add('js');

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------------------------------------------------------------
     Hero: Bildsequenz aus roboter-drehung-90.mp4 (~90°), per Scroll gescrubbt
  ---------------------------------------------------------------- */
  const FRAMES = 117;
  const src = i => `assets/hero/f${String(i).padStart(3, '0')}.webp`;
  const stage = document.querySelector('.stage');
  const canvas = document.querySelector('.stage__canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  const intro = document.querySelector('.stage__copy--intro');
  const chapter = document.querySelector('.stage__copy--chapter');

  const images = new Array(FRAMES);
  const ready = new Uint8Array(FRAMES);

  // Grob-zu-fein laden: erst jedes 16. Bild, dann Lücken füllen
  const order = [];
  for (let step = 16; step >= 1; step /= 2) {
    for (let i = 0; i < FRAMES; i += step) if (!order.includes(i)) order.push(i);
  }
  if (!order.includes(FRAMES - 1)) order.splice(1, 0, FRAMES - 1);

  let next = 0;
  const loadNext = () => {
    if (next >= order.length) return;
    const i = order[next++];
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { images[i] = img; ready[i] = 1; if (Math.abs(i - Math.round(shown)) < 20) needsDraw = true; loadNext(); };
    img.onerror = loadNext;
    img.src = src(i);
  };
  for (let k = 0; k < 6; k++) loadNext();

  const nearestReady = i => {
    for (let d = 0; d < FRAMES; d++) {
      if (i - d >= 0 && ready[i - d]) return i - d;
      if (i + d < FRAMES && ready[i + d]) return i + d;
    }
    return -1;
  };

  let target = 0, shown = 0, drawnIdx = -1, needsDraw = true;
  const draw = () => {
    const idx = nearestReady(Math.round(shown));
    if (idx < 0 || (idx === drawnIdx && !needsDraw)) return;
    ctx.drawImage(images[idx], 0, 0, canvas.width, canvas.height);
    drawnIdx = idx; needsDraw = false;
  };

  let stageTop = 0, stageRun = 1;
  const measure = () => {
    const r = stage.getBoundingClientRect();
    stageTop = r.top + scrollY;
    stageRun = Math.max(1, stage.offsetHeight - innerHeight);
  };

  const update = () => {
    const p = clamp((scrollY - stageTop) / stageRun, 0, 1);

    // Drehung: von 4 % bis 88 % des Scrollwegs
    target = smooth(0.04, 0.88, p) * (FRAMES - 1);

    // Texte: Intro geht, Kapitel kommt
    const a = 1 - smooth(0.02, 0.26, p);
    const b = smooth(0.62, 0.9, p);
    intro.style.opacity = a;
    intro.style.visibility = a < 0.01 ? 'hidden' : 'visible';
    chapter.style.opacity = b;
    chapter.style.visibility = b < 0.01 ? 'hidden' : 'visible';
    if (!reduce) {
      intro.style.transform = `translateY(${(-48 * (1 - a)).toFixed(1)}px)`;
      intro.style.filter = a < 1 ? `blur(${(8 * (1 - a)).toFixed(1)}px)` : '';
      chapter.style.transform = `translateY(${(36 * (1 - b)).toFixed(1)}px)`;
      chapter.style.filter = b < 1 ? `blur(${(8 * (1 - b)).toFixed(1)}px)` : '';
    }
  };

  const tick = () => {
    if (reduce) shown = target;
    else {
      const d = target - shown;
      shown = Math.abs(d) < 0.05 ? target : shown + d * 0.16;
    }
    draw();
    requestAnimationFrame(tick);
  };

  measure(); update();
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', () => { measure(); update(); });
  addEventListener('load', () => { measure(); update(); });
  requestAnimationFrame(tick);

  // "Scrollen" führt ans Ende der Drehung
  document.querySelectorAll('[data-scroll-to="end"]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    scrollTo({ top: stageTop + stageRun, behavior: reduce ? 'auto' : 'smooth' });
  }));

  /* ---------------------------------------------------------------
     Fokus-Karten (ganze Seite): pro Gruppe ist die Karte in Lesehöhe aktiv.
     Karten in derselben Rasterzeile (Projekte) werden gemeinsam aktiv.
  ---------------------------------------------------------------- */
  const groups = [...document.querySelectorAll('[data-focus-group]')].map(g => [...g.children]);
  const setActive = () => {
    const mid = innerHeight * 0.48;
    for (const cards of groups) {
      const m = cards.map(el => {
        const r = el.getBoundingClientRect();
        const c = (r.top + r.bottom) / 2;
        return { el, c, d: r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid)) };
      });
      const best = m.reduce((a, b) => (b.d < a.d ? b : a));
      m.forEach(x => x.el.classList.toggle('is-active', Math.abs(x.c - best.c) < 40));
    }
  };
  addEventListener('scroll', setActive, { passive: true });
  setActive();

  /* ---------------------------------------------------------------
     Skill-Balken füllen sich beim Erscheinen; Navigation markiert Abschnitt
  ---------------------------------------------------------------- */
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { threshold: 0.4 });
  document.querySelectorAll('.skills').forEach(el => io.observe(el));

  const links = [...document.querySelectorAll('.nav__links a')];
  const sections = links.map(a => document.querySelector(a.getAttribute('href')));
  const navIo = new IntersectionObserver(entries => entries.forEach(e => {
    const i = sections.indexOf(e.target);
    if (e.isIntersecting) links.forEach((a, j) => a.setAttribute('aria-current', String(i === j)));
  }), { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => s && navIo.observe(s));
  /* ---------------------------------------------------------------
     Lightbox für Projekt-Screenshots
  ---------------------------------------------------------------- */
  const box = document.querySelector('.lightbox');
  if (box && box.showModal) {
    const boxImg = box.querySelector('img');
    let opener = null;
    document.querySelectorAll('[data-zoom]').forEach(btn => btn.addEventListener('click', () => {
      opener = btn;
      boxImg.src = btn.dataset.zoom;
      boxImg.alt = btn.querySelector('img')?.alt || '';
      box.showModal();
    }));
    box.querySelector('.lightbox__close').addEventListener('click', () => box.close());
    box.addEventListener('click', e => { if (e.target === box) box.close(); });
    box.addEventListener('close', () => opener && opener.focus());
  }
})();
