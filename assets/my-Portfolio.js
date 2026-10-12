if (!customElements.get('my-portfolio')) {
  customElements.define(
    'my-portfolio',
    class MyPortfolio extends HTMLElement {
      frame = 0;
      /** @type {AbortController | null} */
      abort = null;

      connectedCallback() {
        const inner = /** @type {HTMLElement | null} */ (this.querySelector('.mp-inner'));
        const intro = /** @type {HTMLElement | null} */ (this.querySelector('.mp-intro'));
        const firstBlock = /** @type {HTMLElement | null} */ (inner && inner.querySelector('.mp-block'));
        if (!inner || !firstBlock || !firstBlock.children.length) return;

        this.abort = new AbortController();
        const opts = { passive: true, signal: this.abort.signal };
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const autoSpeed = reducedMotion ? 0 : parseFloat(this.dataset.speed || '') || 0;

        let initialized = false;
        let halfWidth = 0;
        let scrollPos = 0;
        let lastTime = 0;
        let userVelocity = 0;
        let triggerScrollLeft = -1;
        let introWidth = intro ? intro.offsetWidth : 0;
        // Keeps the intro hidden after a forward loop wrap
        let introSuppressed = false;
        let isHovering = false;
        /** @type {number | null} */
        let touchX = null;
        let lastTouchDx = 0;

        const measure = () => {
          halfWidth = firstBlock.offsetWidth;
          introWidth = intro ? intro.offsetWidth : 0;
          if (intro && introWidth > 0) {
            const blockGap = parseFloat(getComputedStyle(firstBlock).paddingRight) || 0;
            triggerScrollLeft = halfWidth - blockGap - introWidth;
          }
        };

        // Modulo, not a single subtraction: a long frame gap or hard fling can move more than one loop width
        const wrap = () => {
          if (halfWidth <= 0) return;
          if (scrollPos >= halfWidth) {
            scrollPos %= halfWidth;
            introSuppressed = true;
          } else if (scrollPos < 0) {
            scrollPos = (scrollPos % halfWidth) + halfWidth;
            introSuppressed = false;
          }
        };

        const updateIntro = () => {
          if (!intro || introWidth <= 0 || triggerScrollLeft < 0) return;

          if (introSuppressed) {
            if (scrollPos < triggerScrollLeft + introWidth) return;
            introSuppressed = false;
          }

          const offset = scrollPos - triggerScrollLeft;
          if (offset <= 0) {
            intro.style.transform = 'translateX(0)';
            intro.style.visibility = 'visible';
          } else if (offset >= introWidth) {
            intro.style.transform = 'translateX(-' + introWidth + 'px)';
            intro.style.visibility = 'hidden';
          } else {
            intro.style.transform = 'translateX(-' + offset + 'px)';
            intro.style.visibility = 'visible';
          }
        };

        const render = () => {
          inner.style.transform = 'translateX(-' + scrollPos + 'px)';
          updateIntro();
        };

        window.addEventListener('resize', () => {
          if (!initialized) return;
          measure();
          wrap();
          render();
        }, opts);

        // Hovering pauses auto-scroll so the wheel owns direction and speed
        this.addEventListener('mouseenter', () => { isHovering = true; }, opts);
        this.addEventListener('mouseleave', () => { isHovering = false; }, opts);

        window.addEventListener('wheel', (e) => {
          const raw = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
          const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerWidth : 1;
          userVelocity += raw * unit * (isHovering ? 3 : 0.2);
        }, opts);

        this.addEventListener('touchstart', (e) => {
          const touch = e.touches[0];
          if (!touch) return;
          touchX = touch.clientX;
          lastTouchDx = 0;
        }, opts);

        this.addEventListener('touchmove', (e) => {
          const touch = e.touches[0];
          if (!touch || touchX === null || !initialized) return;
          const nextX = touch.clientX;
          lastTouchDx = touchX - nextX;
          scrollPos += lastTouchDx;
          wrap();
          render();
          touchX = nextX;
        }, opts);

        this.addEventListener('touchend', () => {
          userVelocity += lastTouchDx * 60;
          touchX = null;
        }, opts);

        this.addEventListener('touchcancel', () => { touchX = null; }, opts);

        /** @param {number} time */
        const tick = (time) => {
          if (!lastTime) lastTime = time;
          // Clamped so returning to a backgrounded tab doesn't jump the track
          const deltaTime = Math.min(time - lastTime, 100);
          lastTime = time;

          if (!initialized) {
            measure();
            if (halfWidth > 0) {
              scrollPos = 0;
              initialized = true;
              render();
            }
            this.frame = requestAnimationFrame(tick);
            return;
          }

          const decay = isHovering ? 0.95 : 0.88;
          userVelocity *= Math.pow(decay, deltaTime / 16.67);
          const baseSpeed = isHovering ? 0 : autoSpeed;
          scrollPos += ((baseSpeed + userVelocity) * deltaTime) / 1000;
          wrap();
          render();

          this.frame = requestAnimationFrame(tick);
        };

        this.frame = requestAnimationFrame(tick);
      }

      disconnectedCallback() {
        if (this.abort) this.abort.abort();
        cancelAnimationFrame(this.frame);
      }
    }
  );
}
