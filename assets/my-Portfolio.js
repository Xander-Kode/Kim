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
    var W = wrap.offsetWidth;
    var H = wrap.offsetHeight;
    if (!W || !H) return;
    var wRatio = W / H;
    var vRatio = 16 / 9;
    var iW, iH;
    if (wRatio > vRatio) {
      iW = W;
      iH = W / vRatio;
    } else {
      iH = H;
      iW = H * vRatio;
    }
    iW = Math.ceil(iW) + 2;
    iH = Math.ceil(iH) + 2;
    iframe.style.width = iW + 'px';
    iframe.style.height = iH + 'px';
  }

  function injectYouTubes(sectionEl) {
    var nodes = sectionEl.querySelectorAll('[data-yt-input]:not([data-yt-loaded])');
    nodes.forEach(function (wrap) {
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

  /* ── Auto-scroll ── */
  function startAutoScroll(track, speed) {
    var halfWidth = track.scrollWidth / 2;
    var scrollPos = halfWidth - track.clientWidth / 2;
    track.scrollLeft = scrollPos;

    var lastTime = null;
    var isHovered = false;
    var isInteracting = false;
    var rafId = null;
    var touchStartX = 0;

    function step(ts) {
      if (lastTime !== null) {
        var dt = ts - lastTime;
        if (!isHovered && !isInteracting) {
          scrollPos += (speed * dt) / 1000;
          if (scrollPos >= halfWidth) {
            scrollPos -= halfWidth;
          }
          track.scrollLeft = scrollPos;
        } else {
          scrollPos = track.scrollLeft;
          if (scrollPos >= halfWidth) {
            scrollPos -= halfWidth;
            track.scrollLeft = scrollPos;
          }
        }
      }
      lastTime = ts;
      rafId = requestAnimationFrame(step);
    }

    rafId = requestAnimationFrame(step);

    track.addEventListener('mouseenter', function () { isHovered = true; });
    track.addEventListener('mouseleave', function () { isHovered = false; });

    track.addEventListener('touchstart', function (e) {
      isInteracting = true;
      touchStartX = e.touches[0].clientX;
    }, { passive: true });

    track.addEventListener('touchend', function () {
      setTimeout(function () { isInteracting = false; }, 800);
    }, { passive: true });

    return function destroy() {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }

  /* ── Section init ── */
  function initSection(sectionEl) {
    var track = sectionEl.querySelector('.mp-track');
    var intro = sectionEl.querySelector('.mp-intro');
    if (!track) return;

    var speed = parseFloat(sectionEl.dataset.speed) || 50;
    var isMobile = window.innerWidth < 750;
    var inEditor = window.Shopify && window.Shopify.designMode;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Section visibility observer: play videos & inject YouTubes */
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var videos = sectionEl.querySelectorAll('.mp-video');
        if (entry.isIntersecting) {
          injectYouTubes(sectionEl);
          videos.forEach(function (v) { v.play && v.play().catch(function () {}); });
        } else {
          videos.forEach(function (v) { v.pause && v.pause(); });
        }
      });
    }, { threshold: 0.1 });
    sectionObserver.observe(sectionEl);

    /* Mobile or editor: skip entrance animation */
    if (isMobile || inEditor) {
      track.style.transform = '';
      startAutoScroll(track, speed);
      return;
    }

    /* Entrance animation via Web Animations API */
    var travelPx = window.innerWidth * 0.5;
    var entranceDuration = reducedMotion ? 1 : (travelPx / speed) * 1000;
    var entranceDelay = reducedMotion ? 0 : 2500;

    var entrance = track.animate(
      [
        { transform: 'translateX(50vw)' },
        { transform: 'translateX(0px)' }
      ],
      {
        duration: entranceDuration,
        delay: entranceDelay,
        easing: 'linear',
        fill: 'forwards'
      }
    );

    /* Intro panel exits as track comes in */
    if (intro) {
      intro.animate(
        [
          { transform: 'translateX(0px)', opacity: 1 },
          { transform: 'translateX(-30px)', opacity: 0 }
        ],
        {
          duration: entranceDuration * 0.7,
          delay: entranceDelay + entranceDuration * 0.3,
          easing: 'ease-in',
          fill: 'forwards'
        }
      );
    }

    var scrollStarted = false;

    entrance.onfinish = function () {
      track.style.transform = '';
      if (!scrollStarted) {
        scrollStarted = true;
        startAutoScroll(track, speed);
      }
    };

    /* Wheel/touch: cancel entrance and manually control translate offset */
    var revealed = false;

    function reveal(deltaX) {
      if (revealed) return;

      var matrix = new DOMMatrixReadOnly(getComputedStyle(track).transform);
      var currentX = matrix.m41;

      entrance.cancel();

      if (currentX <= 0) {
        revealed = true;
        track.style.transform = '';
        if (!scrollStarted) {
          scrollStarted = true;
          startAutoScroll(track, speed);
        }
        return;
      }

      var newX = Math.max(0, currentX - Math.abs(deltaX) * 2.5);
      track.style.transform = 'translateX(' + newX + 'px)';

      if (newX <= 0) {
        revealed = true;
        track.style.transform = '';
        if (intro) {
          intro.getAnimations().forEach(function (a) { a.cancel(); });
          intro.style.transform = 'translateX(-30px)';
          intro.style.opacity = '0';
        }
        if (!scrollStarted) {
          scrollStarted = true;
          startAutoScroll(track, speed);
        }
      }
    }

    track.addEventListener('wheel', function (e) {
      if (e.deltaY !== 0 || e.deltaX !== 0) {
        reveal(Math.abs(e.deltaY) + Math.abs(e.deltaX));
      }
    }, { passive: true });

    var touchRevealStart = 0;
    track.addEventListener('touchstart', function (e) {
      touchRevealStart = e.touches[0].clientX;
    }, { passive: true });
    track.addEventListener('touchmove', function (e) {
      var dx = touchRevealStart - e.touches[0].clientX;
      if (dx > 0) reveal(dx);
    }, { passive: true });
  }

  /* ── Resize: re-cover iframes ── */
  window.addEventListener('resize', function () {
    document.querySelectorAll('.mp-yt').forEach(coverYouTube);
  });

  /* ── Boot ── */
  function boot() {
    document.querySelectorAll('.mp-section').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ── Shopify editor reload ── */
  document.addEventListener('shopify:section:load', function (e) {
    var sectionEl = e.target.querySelector('.mp-section');
    if (sectionEl) initSection(sectionEl);
  });

})();
