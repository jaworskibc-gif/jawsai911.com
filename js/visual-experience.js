(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const progress = document.querySelector('.vx-progress');
  let queued = false;
  const updateScroll = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    document.body.classList.toggle('vx-scrolled', window.scrollY > 30);
  };
  window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(updateScroll); } }, { passive: true });
  window.addEventListener('resize', updateScroll);
  updateScroll();
  const pause = document.querySelector('.vx-pause');
  pause?.addEventListener('click', () => {
    const paused = pause.closest('.vx-marquee').classList.toggle('is-paused');
    pause.setAttribute('aria-pressed', String(paused));
    pause.setAttribute('aria-label', paused ? 'Resume industry animation' : 'Pause industry animation');
    pause.textContent = paused ? '▶' : 'Ⅱ';
  });
  const slider = document.querySelector('.vx-slider');
  if (slider) {
    const slides = [...slider.children];
    const previous = document.querySelector('[data-vx-prev]');
    const next = document.querySelector('[data-vx-next]');
    const count = document.querySelector('[data-vx-count]');
    let current = 0;
    const update = () => {
      const atEnd = slider.scrollLeft >= slider.scrollWidth - slider.clientWidth - 3;
      const width = slides[1].offsetLeft - slides[0].offsetLeft;
      current = atEnd ? slides.length - 1 : Math.round(slider.scrollLeft / width);
      previous.disabled = slider.scrollLeft < 3;
      next.disabled = atEnd;
      count.textContent = `${String(current + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    };
    const go = delta => {
      const index = Math.max(0, Math.min(slides.length - 1, current + delta));
      slider.scrollTo({ left: slides[index].offsetLeft - slides[0].offsetLeft, behavior: reduced.matches ? 'instant' : 'smooth' });
    };
    previous.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    slider.addEventListener('keydown', event => {
      if (event.target !== slider) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); go(event.key === 'ArrowRight' ? 1 : -1); }
      if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); go(event.key === 'Home' ? -slides.length : slides.length); }
    });
    slider.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }
  if ('IntersectionObserver' in window) {
    const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      if (!reduced.matches) entry.target.classList.add('is-revealing');
      reveal.unobserve(entry.target);
    }), { threshold: 0.12 });
    document.querySelectorAll('.vx-heading,.ccm-header,.premium-development-grid,.vx-step,.photo-band .container,.vx-projects,.faq-grid').forEach(el => {
      el.classList.add('vx-reveal'); reveal.observe(el);
      el.addEventListener('animationend', () => el.classList.remove('is-revealing'), { once: true });
    });
    const steps = [...document.querySelectorAll('.vx-step')];
    const meter = document.querySelector('.vx-process-meter span');
    const process = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      steps.forEach(step => step.classList.toggle('is-active', step === entry.target));
      if (meter) meter.style.transform = `scaleX(${(steps.indexOf(entry.target) + 1) / steps.length})`;
    }), { rootMargin: '-25% 0px -35% 0px', threshold: 0 });
    steps.forEach(step => process.observe(step));
  }
})();
