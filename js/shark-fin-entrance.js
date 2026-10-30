(() => {
  'use strict';
  // Bump the key when the entrance choreography changes so visitors who saw
  // an earlier build get one fresh entrance on the next deployment.
  const SESSION_KEY = 'jaws:fin-entrance:v2';
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let claimed = false;
  const seen = () => { try { return sessionStorage.getItem(SESSION_KEY) === 'played'; } catch { return claimed; } };
  const claim = () => { claimed = true; try { sessionStorage.setItem(SESSION_KEY, 'played'); } catch { /* Document-only fallback if storage is unavailable. */ } };
  class SharkFinEntrance {
    constructor(stage, options = {}) {
      this.stage = stage;
      this.options = { enabled: true, duration: 2800, playOnce: true, reducedMotion: false, ...options };
      this.animations = [];
      this.original = stage.querySelector(':scope > img');
      stage.classList.add('shark-fin-stage');
      stage.setAttribute('aria-hidden', 'true');
      if (this.options.enabled && !motionPreference.matches && !this.options.reducedMotion && !(this.options.playOnce && seen())) stage.classList.add('is-preparing');
      this.move = document.createElement('div'); this.move.className = 'shark-fin-motion';
      this.move.innerHTML = '<div class="shark-fin-rotation"><div class="shark-fin-art"></div><div class="shark-fin-art is-outbound"></div></div><div class="shark-fin-wake"></div>';
      stage.append(this.move);
      this.turn = this.move.firstElementChild; this.art = this.turn.firstElementChild; this.outboundArt = this.turn.lastElementChild;
      this.wake = this.move.lastElementChild;
      this.stop = this.stop.bind(this);
      motionPreference.addEventListener('change', this.stop);
      window.addEventListener('pagehide', this.stop);
      this.resize = new ResizeObserver(() => { if (this.running) this.stop(); this.measure(); });
      this.resize.observe(stage);
      this.ready();
    }
    measure() {
      const width = this.stage.clientWidth, height = this.stage.clientHeight;
      const scale = this.original ? height / 512 : height / 280;
      const w = 320 * scale, h = 265 * scale;
      const rest = this.options.restPosition || (this.original ? { x: width - 468 * scale, y: 125 * scale } : { x: (width - w) * .42, y: 8 * scale });
      Object.assign(this.move.style, { width: w + 'px', height: h + 'px', left: rest.x + 'px', top: rest.y + 'px' });
      for (const art of [this.art, this.outboundArt]) {
        art.style.backgroundSize = `${2048 * scale}px ${512 * scale}px`;
        art.style.backgroundPosition = `${-1580 * scale}px ${-125 * scale}px`;
      }
      const sign = 1; // The approved artwork faces left on the return; rest is never mirrored.
      const room = sign > 0 ? width - rest.x - w - 12 : rest.x - 12;
      // Give the swim enough travel to read clearly on a real screen while
      // remaining bounded inside the hero animation layer.
      this.distance = sign * Math.max(0, Math.min(room, width * .32, 220));
      this.rest = rest;
      this.constrained = !!this.original && rest.x < -w * .15;
    }
    async ready() {
      if (this.original) { try { await this.original.decode(); } catch { this.stage.classList.remove('is-preparing'); this.stage.dataset.finState = 'asset-unavailable'; return; } }
      else { const image = new Image(); image.src = '/assets/premium/approved-linkedin-banner.webp'; try { await image.decode(); } catch { return; } }
      this.measure();
      // Let ResizeObserver's first notification run before starting the entrance.
      requestAnimationFrame(() => requestAnimationFrame(() => this.play()));
    }
    play() {
      this.stage.classList.remove('is-preparing');
      if (!this.options.enabled || motionPreference.matches || this.options.reducedMotion || (this.options.playOnce && seen()) || !this.move.animate) {
        this.stage.dataset.finState = 'static'; return;
      }
      if (this.constrained || Math.abs(this.distance) < 12) { this.stage.dataset.finState = 'static-constrained'; return; }
      claim(); this.running = true; this.stage.classList.add('is-swimming'); this.stage.dataset.finState = 'swimming';
      const d = this.distance;
      // Coordinate frames describe a shallow arc while the child changes heading.
      // Outbound is reflected so the leading tip faces travel; return restores the original artwork.
      const points = [
        [0, 0, 0], [.0714, d * .08, -1], [.2857, d * .88, 2],
        [.3571, d, 0], [.4107, d * 1.015, -5], [.4643, d * .96, -9],
        [.5357, d * .84, -4], [.68, d * .49, 1.5], [.8214, d * .10, 1], [1, 0, 0]
      ];
      const frames = [];
      for (let step = 0; step <= 140; step++) {
        const t = step / 140;
        let i = points.findIndex((p, index) => index < points.length - 1 && t <= points[index + 1][0]);
        if (i < 0) i = points.length - 2;
        const a = points[i], b = points[i + 1], previous = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 2)];
        const dt = b[0] - a[0], u = (t - a[0]) / dt;
        const interpolate = axis => {
          const m0 = i === 0 ? 0 : (b[axis] - previous[axis]) / (b[0] - previous[0]);
          const m1 = i + 1 === points.length - 1 ? 0 : (next[axis] - a[axis]) / (next[0] - a[0]);
          return (2*u**3-3*u*u+1)*a[axis] + (u**3-2*u*u+u)*dt*m0 + (-2*u**3+3*u*u)*b[axis] + (u**3-u*u)*dt*m1;
        };
        frames.push({ offset:t, transform:`translate3d(${interpolate(1)}px,${interpolate(2)}px,0)` });
      }
      const duration = Math.max(1000, Math.min(4000, this.options.duration));
      this.animations.push(this.move.animate(frames, { duration, fill: 'both' }));
      this.animations.push(this.turn.animate([
        {offset:0,transform:'rotateY(0deg) rotateZ(0deg)'},
        {offset:.3571,transform:'rotateY(0deg) rotateZ(0deg)'},
        {offset:.4107,transform:'rotateY(40deg) rotateZ(-2deg)'},
        {offset:.4643,transform:'rotateY(65deg) rotateZ(-1.5deg)'},
        {offset:.5357,transform:'rotateY(0deg) rotateZ(0deg)'},
        {offset:1,transform:'rotateY(0deg) rotateZ(0deg)'}
      ], {duration,fill:'both',easing:'linear'}));
      // Blend the two headings at maximum perspective narrowing, avoiding an
      // edge-on disappearance or a 180-degree coin flip of a flat image plane.
      this.animations.push(this.art.animate([
        {offset:0,opacity:0},{offset:.4107,opacity:0},{offset:.49,opacity:1},{offset:1,opacity:1}
      ], {duration,fill:'both'}));
      this.animations.push(this.outboundArt.animate([
        {offset:0,opacity:1},{offset:.4107,opacity:1},{offset:.49,opacity:0},{offset:1,opacity:0}
      ], {duration,fill:'both'}));
      this.animations.push(this.wake.animate([
        {opacity:0,transform:'scaleX(.6)'},{offset:.25,opacity:.3,transform:'scaleX(1)'},
        {offset:.54,opacity:.12,transform:'scaleX(.7)'},{offset:.78,opacity:.2,transform:'scaleX(1)'},
        {opacity:0,transform:'scaleX(.8)'}
      ], {duration,fill:'both'}));
      // Reveal the stationary environment only during the settle; never move the banner's text or globe.
      if (this.original) this.animations.push(this.original.animate([
        {opacity:0},{offset:.8214,opacity:0},{opacity:1}
      ], {duration,fill:'both'}));
      Promise.all(this.animations.map(a => a.finished)).then(() => this.stop()).catch(() => {});
    }
    stop() {
      this.animations.forEach(a => a.cancel()); this.animations = []; this.running = false;
      this.stage.classList.remove('is-swimming', 'is-preparing'); this.stage.dataset.finState = 'static';
    }
    destroy() { this.stop(); this.resize.disconnect(); motionPreference.removeEventListener('change', this.stop); window.removeEventListener('pagehide', this.stop); this.move.remove(); }
  }
  window.SharkFinEntrance = SharkFinEntrance;
  document.querySelectorAll('[data-shark-fin]').forEach(stage => new SharkFinEntrance(stage));
})();
