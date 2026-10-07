/* ==========================================================================
   Notgrizy — portfolio behaviour
   - Renders thumbnail cards from /thumbnails/thumbnails.js (generated file)
     or from any hand-written .thumb-card blocks already in the HTML
   - Keeps every "count" on the page in sync with the real number of cards
   ========================================================================== */
(function () {
  'use strict';

  var DEFAULT_TOOL = 'Photoshop';
  var DEFAULT_KIND = 'Minecraft Thumbnail';

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* ---------------------------------------------------------------
     Thumbnails
  --------------------------------------------------------------- */

  /** "epic_sword_fight-2.PNG" -> "Epic Sword Fight 2" */
  function titleFromFilename(src) {
    var file = String(src || '').split('/').pop().replace(/\.[a-z0-9]+$/i, '');
    return file
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, function (c) { return c.toUpperCase() }) || 'Untitled';
  }

  function buildCard(item) {
    var src = typeof item === 'string' ? item : item.src;
    if (!src) return null;

    var tool = (item && item.tool) || DEFAULT_TOOL;
    var title = (item && item.title) || titleFromFilename(src);

    var art = document.createElement('article');
    art.className = 'thumb-card';
    art.dataset.reveal = '';
    art.tabIndex = 0;
    art.setAttribute('role', 'button');
    art.setAttribute('aria-label', 'Open preview: ' + title);

    var media = document.createElement('div');
    media.className = 'thumb-card__media';

    var badge = document.createElement('span');
    badge.className = 'thumb-card__badge';
    badge.textContent = tool;

    var img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = title + ' — Minecraft thumbnail';
    img.addEventListener('load', function () {
      img.classList.add('is-loaded');
    });
    img.addEventListener('error', function () {
      img.remove();
      var missing = document.createElement('span');
      missing.className = 'thumb-card__missing';
      missing.textContent = 'Image missing';
      media.insertBefore(missing, badge);
    });
    img.src = src;
    // cached images can complete before the listener is attached
    if (img.complete && img.naturalWidth > 0) img.classList.add('is-loaded');

    media.appendChild(img);
    media.appendChild(badge);

    var body = document.createElement('div');
    body.className = 'thumb-card__body';

    var h3 = document.createElement('h3');
    h3.className = 'thumb-card__title';
    h3.textContent = title;

    var meta = document.createElement('span');
    meta.className = 'thumb-card__meta';
    meta.textContent = DEFAULT_KIND;

    body.appendChild(h3);
    body.appendChild(meta);

    art.appendChild(media);
    art.appendChild(body);

    art.addEventListener('click', function () { openLightbox(src, title); });
    art.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(src, title);
      }
    });

    return art;
  }

  /**
   * Source of truth priority:
   *   1. window.THUMBNAILS (generated from the /thumbnails folder)
   *   2. .thumb-card blocks written directly into index.html
   * Returns the number of cards on the page.
   */
  function renderThumbnails() {
    var grid = qs('#thumb-grid');
    var empty = qs('#thumb-empty');
    if (!grid) return 0;

    var data = window.THUMBNAILS;
    var hasGeneratedData = Object.prototype.toString.call(data) === '[object Array]';

    if (hasGeneratedData && data.length) {
      var hadManual = qsa('.thumb-card', grid).length;
      if (hadManual) {
        console.info(
          '[notgrizy] thumbnails.js found — using it as the source of truth. ' +
          'Remove the hand-written cards in index.html to avoid confusion.'
        );
      }
      grid.textContent = '';
      data.forEach(function (item) {
        var card = buildCard(item);
        if (card) grid.appendChild(card);
      });
    }

    var count = qsa('.thumb-card', grid).length;

    if (empty) empty.hidden = count > 0;
    grid.hidden = count === 0;

    return count;
  }

  /* ---------------------------------------------------------------
     Counters
  --------------------------------------------------------------- */

  function animateCount(el, to, duration) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = String(to);
      return;
    }
    var start = performance.now();
    function frame(now) {
      var p = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = String(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function initCounters() {
    var nodes = qsa('[data-count]');
    var run = function (el) { animateCount(el, parseInt(el.dataset.count, 10) || 0, 1100); };

    if (!('IntersectionObserver' in window)) {
      nodes.forEach(run);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          run(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    nodes.forEach(function (el) { io.observe(el); });
  }

  /** Point every counter at the real number of thumbnail cards. */
  function syncCounts(thumbCount) {
    var stat = qs('#stat-thumbs');
    var badge = qs('#work-count');
    // initCounters() already observes [data-count]; updating the dataset is enough
    // for the animated one, the section badge updates immediately.
    if (stat) stat.dataset.count = thumbCount;
    if (badge) badge.textContent = String(thumbCount);
  }

  /* ---------------------------------------------------------------
     Reveal on scroll
  --------------------------------------------------------------- */

  /* ---------------------------------------------------------------
     Copyright year + watermark
   --------------------------------------------------------------- */

  var OWNER = 'Notgrizy';

  /* 366 days - anything larger means the clock is wrong, not the page */
  var MAX_ROLLOVER_DELAY = 366 * 24 * 60 * 60 * 1000;

  /**
   * One source of truth for the year, so the footer and the watermark on
   * every thumbnail can never drift apart. Both read the same value.
   */
  function initCopyright() {
    var year = String(new Date().getFullYear());

    qsa('[data-year]').forEach(function (el) { el.textContent = year; });

    // Read by .thumb-card__media::after and .lightbox__frame::after
    document.documentElement.style.setProperty(
      '--watermark-text', '"\u00a9 ' + year + ' ' + OWNER + '"'
    );

    // Keep a long-lived tab honest when it rolls over at midnight on 31 Dec.
    var untilNewYear = new Date(+year + 1, 0, 1).getTime() - Date.now();
    if (untilNewYear > 0 && untilNewYear < MAX_ROLLOVER_DELAY) {
      setTimeout(initCopyright, untilNewYear + 1000);
    }
  }

  function initReveal() {
    var items = qsa('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------
     Header + mobile nav
  --------------------------------------------------------------- */

  function initHeader() {
    var header = qs('#site-header');
    if (!header) return;
    var apply = function () { header.classList.toggle('is-stuck', window.scrollY > 12); };
    apply();
    window.addEventListener('scroll', apply, { passive: true });

    var toggle = qs('#nav-toggle');
    var nav = qs('#primary-nav');
    if (!toggle || !nav) return;

    var setOpen = function (open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 720) setOpen(false);
    });
  }

  /* ---------------------------------------------------------------
     Copy Discord handle
  --------------------------------------------------------------- */

  function initCopy() {
    qsa('[data-copy]').forEach(function (btn) {
      var label = qs('[data-copy-label]', btn);
      var text = btn.dataset.copy || '';
      var rest = text + ' · Copy';
      var original = label ? label.textContent : '';
      var timer;

      btn.addEventListener('click', function () {
        var done = function (ok) {
          clearTimeout(timer);
          btn.classList.toggle('is-copied', ok);
          if (label) label.textContent = ok ? 'Copied!' : rest;
          if (!ok) console.warn('[notgrizy] clipboard blocked — value is: ' + text);
          timer = setTimeout(function () {
            btn.classList.remove('is-copied');
            if (label) label.textContent = original;
          }, 1800);
        };

        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
        } else {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
          document.body.appendChild(ta);
          ta.select();
          var ok = false;
          try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
          document.body.removeChild(ta);
          done(ok);
        }
      });
    });
  }

  /* ---------------------------------------------------------------
     Lightbox
  --------------------------------------------------------------- */

  var lastFocused = null;

  function openLightbox(src, title) {
    var box = qs('#lightbox');
    var img = qs('#lightbox-img');
    var cap = qs('#lightbox-cap');
    if (!box || !img) return;

    lastFocused = document.activeElement;
    img.src = src;
    img.alt = title || '';
    if (cap) cap.textContent = title || '';
    box.hidden = false;
    document.body.style.overflow = 'hidden';
    var close = qs('.lightbox__close', box);
    if (close) close.focus();
  }

  function closeLightbox() {
    var box = qs('#lightbox');
    if (!box || box.hidden) return;
    box.hidden = true;
    document.body.style.overflow = '';
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function initLightbox() {
    var box = qs('#lightbox');
    if (!box) return;
    box.addEventListener('click', function (e) {
      if (e.target.closest('.lightbox__close') || e.target === box ||
          e.target.classList.contains('lightbox__figure')) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  /* ---------------------------------------------------------------
     Boot
  --------------------------------------------------------------- */

  function boot() {
    var count = renderThumbnails();
    initCounters();
    initCopyright();
    initReveal();
    initHeader();
    initCopy();
    initLightbox();
    syncCounts(count);
    console.info('[notgrizy] ' + count + ' thumbnail' + (count === 1 ? '' : 's') +
                 ' rendered' + (count === 0 ? ' — add images to /thumbnails and run `npm run scan`' : ''));
    console.info('[notgrizy] watermark: \u00a9 ' + new Date().getFullYear() + ' ' + OWNER);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();