// Elena — Dance Portfolio
// Vanilla JS only: nav, scroll reveals, click-to-load video embeds, gallery lightbox.

document.documentElement.classList.add('js');

// ---------- Nav: solid background after scrolling past the hero top ----------
const nav = document.getElementById('site-nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// ---------- Nav: mobile menu ----------
const toggle = nav.querySelector('.nav-toggle');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});
nav.querySelectorAll('.nav-menu a').forEach((link) =>
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  })
);

// ---------- Scroll reveals ----------
const revealed = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  revealed.forEach((el, i) => {
    // Small stagger between siblings revealed in the same batch
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
    io.observe(el);
  });
} else {
  revealed.forEach((el) => el.classList.add('in-view'));
}

// ---------- Video facades: swap thumbnail for the real embed on click ----------
// Placeholder IDs (anything starting with "PLACEHOLDER") show a friendly note instead.
document.querySelectorAll('.video-facade').forEach((facade) => {
  facade.addEventListener('click', () => {
    const yt = facade.dataset.yt;
    const vimeo = facade.dataset.vimeo;
    const frame = facade.closest('.video-frame');
    const id = yt || vimeo;

    if (!id || id.startsWith('PLACEHOLDER')) {
      if (frame.querySelector('.video-note')) return;
      const note = document.createElement('div');
      note.className = 'video-note';
      note.textContent = 'Video coming soon — add the YouTube or Vimeo ID for this slot in index.html.';
      frame.appendChild(note);
      setTimeout(() => note.remove(), 3500);
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.src = yt
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}?autoplay=1&rel=0`
      : `https://player.vimeo.com/video/${encodeURIComponent(vimeo)}?autoplay=1`;
    iframe.title = facade.dataset.title || 'Dance video';
    iframe.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
    iframe.allowFullscreen = true;
    facade.replaceWith(iframe);
  });
});

// ---------- Gallery lightbox ----------
const lightbox = document.getElementById('lightbox');
const lightboxImg = lightbox.querySelector('.lightbox-img');
const items = Array.from(document.querySelectorAll('.gallery-item img'));
let current = 0;

function showPhoto(index) {
  current = (index + items.length) % items.length;
  lightboxImg.src = items[current].src;
  lightboxImg.alt = items[current].alt;
}

function openLightbox(index) {
  showPhoto(index);
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
  lightbox.querySelector('.lightbox-close').focus();
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = '';
}

items.forEach((img, i) =>
  img.closest('.gallery-item').addEventListener('click', () => openLightbox(i))
);
lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
lightbox.querySelector('.lightbox-prev').addEventListener('click', () => showPhoto(current - 1));
lightbox.querySelector('.lightbox-next').addEventListener('click', () => showPhoto(current + 1));
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (lightbox.hidden) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') showPhoto(current - 1);
  if (e.key === 'ArrowRight') showPhoto(current + 1);
});
