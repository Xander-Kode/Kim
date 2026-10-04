// @ts-nocheck
(function () {

  /* ── YouTube helpers ── */

  function parseYouTubeId(input) {
    if (!input) return '';
    var m = input.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
    );
    return m ? m[1] : input.replace(/\s/g, '').slice(0, 11);
  }

  function coverYouTube(wrap) {
    var iframe = wrap.querySelector('iframe');
    if (!iframe) return;
    var w = wrap.offsetWidth;
    var h = wrap.offsetHeight;
    if (w / h > 16 / 9) {
      iframe.style.width = w + 'px';
      iframe.style.height = Math.ceil(w * 9 / 16) + 'px';
    } else {
      iframe.style.height = h + 'px';
      iframe.style.width = Math.ceil(h * 16 / 9) + 'px';
    }
  }

  function injectYouTubes(sectionEl) {
    sectionEl.querySelectorAll('.my-portfolio__yt-wrap[data-yt-input]:not([data-yt-loaded])').forEach(function (wrap) {
      var id = parseYouTubeId(wrap.dataset.ytInput || '');
      if (!id) return;
      wrap.dataset.ytLoaded = '1';
      var iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + id
        + '?autoplay=1&mute=1&loop=1&playlist=' + id
        + '&controls=0&playsinline=1&rel=0&modestbranding=1';
      iframe.allow = 'autoplay; encrypted-media';
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allowfullscreen', '');
      wrap.appendChild(iframe);
      coverYouTube(wrap);
    });
  }

  /* ── Per-section init ── */

  function initSection(sectionEl) {
    var track = sectionEl.querySelector('.my-portfolio__track-wrap');
    var intro = sectionEl.querySelector('.my-portfolio__intro');
    if (!track) return;

    var speed = parseFloat(sectionEl.dataset.mpSpeed) || 50;
    var isMobile = window.innerWidth < 750;

    /* ── Video play/pause when section enters viewport ── */
    var sectionObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        sectionEl.querySelectorAll('video.my-portfolio__video').forEach(function (v) {
          if (entry.isIntersecting) {
            v.play().catch(function () {});
          } else {
            v.pause();
          }
        });
        if (entry.isIntersecting) injectYouTubes(sectionEl);
      });
    }, { threshold: 0.1 });
    sectionObs.observe(sectionEl);

    /* ── Skip entrance animation on mobile or in Shopify editor ── */
    if (isMobile || (window.Shopify && window.Shopify.designMode)) {
      track.style.transform = '';
      startAutoScroll(track, speed);
      return;
    }

    /* ── Entrance animation ── */
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var entranceDuration = reducedMotion ? 1 : (window.innerWidth / 2 / speed) * 1000;
    var entranceDelay = 2500;

    var entrance = track.animate(
      [{ transform: 'translateX(50vw)' }, { transform: 'translateX(0)' }],
      { duration: entranceDuration, delay: entranceDelay, easing: 'linear', fill: 'forwards' }
    );

    var exitAnim = null;
    if (intro) {
      exitAnim = intro.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-100%)' }],
        {
          duration: entranceDuration * 0.7,
          delay: entranceDelay + entranceDuration * 0.3,
          easing: 'linear',
          fill: 'forwards'
        }
      );
      exitAnim.onfinish = function () { intro.style.visibility = 'hidden'; };
    }

    entrance.onfinish = function () {
      track.style.transform = '';
      startAutoScroll(track, speed);
    };

    /* ── Wheel / touch reveal ── */
    var revealOffset = null;

    function reveal(delta) {
      if (!delta) return;
      if (revealOffset === null) {
        var computed = getComputedStyle(track).transform;
        revealOffset = computed === 'none' ? 0 : new DOMMatrixReadOnly(computed).m41;
        if (exitAnim) { exitAnim.onfinish = null; exitAnim.cancel(); }
        entrance.cancel();
      }
      var introWidth = intro ? intro.offsetWidth : 0;
      revealOffset = Math.max(0, Math.min(introWidth, revealOffset - delta));
      track.style.transform = 'translateX(' + revealOffset + 'px)';
      if (intro) {
        var introShift = Math.min(0, (revealOffset - introWidth * 0.7) / 0.7);
        intro.style.transform = 'translateX(' + introShift + 'px)';
        intro.style.visibility = revealOffset > 0 ? 'visible' : 'hidden';
      }
      if (revealOffset <= 0) {
        track.style.transform = '';
        startAutoScroll(track, speed);
      }
    }

    window.addEventListener('wheel', function (e) {
      var delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      var unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerWidth : 1;
      reveal(delta * unit);
    }, { passive: true });

    var touchX = null;
    sectionEl.addEventListener('touchstart', function (e) {
      touchX = e.touches[0].clientX;
    }, { passive: true });
    sectionEl.addEventListener('touchmove', function (e) {
      if (touchX === null) return;
      reveal(touchX - e.touches[0].clientX);
      touchX = e.touches[0].clientX;
    }, { passive: true });
    sectionEl.addEventListener('touchend', function () { touchX = null; }, { passive: true });
    sectionEl.addEventListener('touchcancel', function () { touchX = null; }, { passive: true });
  }

  /* ── Auto-scroll loop ── */

  function startAutoScroll(track, speed) {
    var isHovered = false;
    var isInteracting = false;
    var interactionTimer;
    var scrollPos = 0;
    var lastTime = 0;
    var initialized = false;

    function interact() {
      isInteracting = true;
      clearTimeout(interactionTimer);
      interactionTimer = setTimeout(function () { isInteracting = false; }, 500);
    }

    track.addEventListener('mouseenter', function () { isHovered = true; });
    track.addEventListener('mouseleave', function () { isHovered = false; });
    track.addEventListener('touchstart', function () { isHovered = true; interact(); }, { passive: true });
    track.addEventListener('touchend', function () {
      setTimeout(function () { isHovered = false; }, 1000);
    }, { passive: true });
    track.addEventListener('scroll', function () {
      if (Math.abs(track.scrollLeft - scrollPos) > 2) interact();
    }, { passive: true });

    function loop(time) {
      if (!lastTime) lastTime = time;
      var dt = time - lastTime;
      lastTime = time;

      var halfWidth = track.scrollWidth / 2;

      if (!initialized && halfWidth > 0) {
        scrollPos = 0;
        track.scrollLeft = 0;
        initialized = true;
        requestAnimationFrame(loop);
        return;
      }

      if (!isHovered && !isInteracting) {
        scrollPos += (speed * dt) / 1000;
        if (scrollPos >= halfWidth) scrollPos -= halfWidth;
        track.scrollLeft = scrollPos;
      } else {
        scrollPos = track.scrollLeft;
        if (scrollPos >= halfWidth) {
          track.scrollLeft = scrollPos - halfWidth;
          scrollPos = track.scrollLeft;
        } else if (scrollPos <= 0 && halfWidth > 0) {
          track.scrollLeft = halfWidth - 1;
          scrollPos = track.scrollLeft;
        }
      }

      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
  }

  /* ── Resize: re-cover YouTube iframes ── */

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      document.querySelectorAll('.my-portfolio__yt-wrap[data-yt-loaded]').forEach(function (w) {
        coverYouTube(w);
      });
    }, 100);
  });

  /* ── Boot ── */

  function boot(root) {
    var scope = root || document;
    scope.querySelectorAll('.my-portfolio').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(); });
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', function (e) {
    var section = e.target.querySelector('.my-portfolio');
    if (section) initSection(section);
  });

})();
