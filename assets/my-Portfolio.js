// @ts-nocheck
(function () {

  /* ── YouTube helpers ── */
  function parseYouTubeId(input) {
    if (!input) return null;
    var clean = input.trim();
    var m = clean.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(clean)) return clean;
    return null;
  }

  function coverYouTube(wrap) {
    var iframe = wrap.querySelector('iframe');
    if (!iframe) return;
    var W = wrap.offsetWidth, H = wrap.offsetHeight;
    if (!W || !H) return;
    var r = W / H, v = 16 / 9;
    var iW, iH;
    if (r > v) { iW = W; iH = W / v; } else { iH = H; iW = H * v; }
    iframe.style.width  = (Math.ceil(iW) + 2) + 'px';
    iframe.style.height = (Math.ceil(iH) + 2) + 'px';
  }

  function injectYouTubes(sectionEl) {
    sectionEl.querySelectorAll('[data-yt-input]:not([data-yt-loaded])').forEach(function (wrap) {
      var ytId = parseYouTubeId(wrap.dataset.ytInput);
      if (!ytId) return;
      wrap.dataset.ytLoaded = '1';
      var iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + ytId +
        '?autoplay=1&mute=1&loop=1&playlist=' + ytId +
        '&controls=0&modestbranding=1&playsinline=1&rel=0';
      iframe.allow = 'autoplay; encrypted-media';
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('loading', 'lazy');
      wrap.appendChild(iframe);
      coverYouTube(wrap);
    });
  }

  /* ── Section init ── */
  function initSection(sectionEl) {
    var track = sectionEl.querySelector('.mp-track');
    var intro = sectionEl.querySelector('.mp-intro');
    if (!track) return;

    var speed    = parseFloat(sectionEl.dataset.speed) || 50;
    var isMobile = window.innerWidth < 750;
    var inEditor = window.Shopify && window.Shopify.designMode;
    var reduced  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* state */
    var scrollStarted  = false;
    var halfWidth      = 0;
    var scrollPos      = 0;
    var vel            = 0;        /* px / ms  */
    var lastTime       = null;
    var isHovered      = false;
    var isDragging     = false;
    var dragStartX     = 0;
    var dragScrollBase = 0;
    var dragPrevX      = 0;
    var dragPrevT      = 0;
    var dragVel        = 0;        /* px / ms, measured during drag */
    var entranceAnim   = null;
    var rafId          = null;

    /* ── begin scrolling ── */
    function beginScroll() {
      if (scrollStarted) return;
      scrollStarted = true;

      /* IMPORTANT: set inline style to 'none' so the CSS translateX(50vw)
         rule does not snap back after the animation fill is removed */
      track.style.transform = 'none';

      if (entranceAnim) { entranceAnim.cancel(); entranceAnim = null; }

      if (intro) {
        intro.getAnimations().forEach(function (a) { a.cancel(); });
        intro.style.transition = 'transform 0.45s ease, opacity 0.45s ease';
        intro.style.transform  = 'translateX(-32px)';
        intro.style.opacity    = '0';
      }

      halfWidth = track.scrollWidth / 2;
      scrollPos = halfWidth - track.clientWidth / 2;
      track.scrollLeft = scrollPos;

      var autoVel = speed / 1000;  /* px / ms */

      function step(ts) {
        if (lastTime === null) { lastTime = ts; rafId = requestAnimationFrame(step); return; }
        var dt = Math.min(ts - lastTime, 50);
        lastTime = ts;

        if (isDragging) {
          /* drag owns scrollLeft — keep seamless wrap in sync */
          scrollPos = track.scrollLeft;
          if (scrollPos >= halfWidth) { scrollPos -= halfWidth; track.scrollLeft = scrollPos; }
        } else if (isHovered) {
          /* inertia coast */
          vel *= Math.pow(0.90, dt / 16.67);
          if (Math.abs(vel) < 0.0005) vel = 0;
          scrollPos += vel * dt;
          if (scrollPos >= halfWidth) scrollPos -= halfWidth;
          if (scrollPos < 0)          scrollPos += halfWidth;
          track.scrollLeft = scrollPos;
        } else {
          /* auto-scroll — blend vel toward autoVel */
          vel += (autoVel - vel) * Math.min(1, 0.08 * dt / 16.67);
          scrollPos += vel * dt;
          if (scrollPos >= halfWidth) scrollPos -= halfWidth;
          if (scrollPos < 0)          scrollPos += halfWidth;
          track.scrollLeft = scrollPos;
        }

        rafId = requestAnimationFrame(step);
      }

      rafId = requestAnimationFrame(step);
    }

    /* ── video observer ── */
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var vids = sectionEl.querySelectorAll('.mp-video');
        if (entry.isIntersecting) {
          injectYouTubes(sectionEl);
          vids.forEach(function (v) { v.play && v.play().catch(function () {}); });
        } else {
          vids.forEach(function (v) { v.pause && v.pause(); });
        }
      });
    }, { threshold: 0.1 }).observe(sectionEl);

    /* ── hover ── */
    track.addEventListener('mouseenter', function () { isHovered = true; });
    track.addEventListener('mouseleave', function () {
      isHovered  = false;
      isDragging = false;
      track.style.cursor = '';
    });

    /* ── wheel — passive:false must be first registration on this element ── */
    track.addEventListener('wheel', function (e) {
      e.preventDefault();

      if (!scrollStarted) {
        /* scrub entrance by transform offset */
        var matrix = new DOMMatrixReadOnly(getComputedStyle(track).transform);
        var curX   = matrix.m41;
        if (entranceAnim) { entranceAnim.cancel(); entranceAnim = null; }
        var raw = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        var newX = Math.max(0, curX - Math.abs(raw) * 3);
        track.style.transform = 'translateX(' + newX + 'px)';
        if (newX <= 0) beginScroll();
        return;
      }

      /* px normalised across deltaMode */
      var raw = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      var px  = e.deltaMode === 1 ? raw * 20
              : e.deltaMode === 2 ? raw * 400
              : raw;

      /* add impulse (px/ms) with cap */
      vel += px / 200;
      var cap = 4;
      if (vel >  cap) vel =  cap;
      if (vel < -cap) vel = -cap;

    }, { passive: false });

    /* ── drag with momentum ── */
    track.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      if (e.target.closest('a, button')) return;
      isDragging     = true;
      dragStartX     = e.clientX;
      dragScrollBase = track.scrollLeft;
      dragPrevX      = e.clientX;
      dragPrevT      = performance.now();
      dragVel        = 0;
      vel            = 0;
      track.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      var now = performance.now();
      var dt  = now - dragPrevT;
      if (dt > 0) dragVel = (dragPrevX - e.clientX) / dt;  /* px/ms */
      dragPrevX = e.clientX;
      dragPrevT = now;
      track.scrollLeft = dragScrollBase + (dragStartX - e.clientX);
      scrollPos = track.scrollLeft;
    });

    document.addEventListener('mouseup', function () {
      if (!isDragging) return;
      isDragging = false;
      vel = dragVel;   /* hand off momentum */
      track.style.cursor = isHovered ? 'grab' : '';
    });

    /* ── touch ── */
    track.addEventListener('touchstart', function () {
      isHovered = true;
      if (!scrollStarted) { beginScroll(); }
    }, { passive: true });
    track.addEventListener('touchend', function () {
      setTimeout(function () { isHovered = false; }, 600);
    }, { passive: true });

    /* ── skip entrance ── */
    if (isMobile || inEditor) { beginScroll(); return; }

    /* ── entrance animation ── */
    var travelPx = window.innerWidth * 0.5;
    var duration = reduced ? 1 : (travelPx / speed) * 1000;
    var delay    = reduced ? 0 : 2500;

    entranceAnim = track.animate(
      [{ transform: 'translateX(50vw)' }, { transform: 'translateX(0px)' }],
      { duration: duration, delay: delay, easing: 'linear', fill: 'forwards' }
    );

    if (intro) {
      intro.animate(
        [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-32px)', opacity: 0 }],
        { duration: duration * 0.7, delay: delay + duration * 0.3, easing: 'ease-in', fill: 'forwards' }
      );
    }

    entranceAnim.onfinish = beginScroll;
  }

  /* ── resize ── */
  window.addEventListener('resize', function () {
    document.querySelectorAll('.mp-yt').forEach(coverYouTube);
  });

  /* ── boot ── */
  function boot() {
    document.querySelectorAll('.mp-section').forEach(initSection);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  document.addEventListener('shopify:section:load', function (e) {
    var el = e.target.querySelector('.mp-section');
    if (el) initSection(el);
  });

})();
