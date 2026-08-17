/**
 * sats-widget.js — SATUNO Business
 * 
 * Usage (auto-detect):
 *   <script src="sats-widget.js" data-currency="MXN"></script>
 *
 * Usage (manual):
 *   <span data-sats-price="1299">$1,299</span>
 *   <script src="sats-widget.js" data-currency="MXN"></script>
 *
 * Options (data attributes on the script tag):
 *   data-currency   — ISO currency code (MXN, USD, EUR...) default: auto-detect
 *   data-color      — Badge color (default: #F7931A)
 *   data-mode       — "append" | "replace" | "inline" (default: append)
 *   data-lightning  — Your Lightning address for the Pay button
 *   data-lang       — "es" | "en" (default: auto from browser)
 */

(function() {
  'use strict';

  // ── Config from script tag ────────────────────────────────────
  var scriptTag = document.currentScript ||
    document.querySelector('script[src*="sats-widget"]');

  var CONFIG = {
    currency:    (scriptTag && scriptTag.getAttribute('data-currency'))    || 'AUTO',
    color:       (scriptTag && scriptTag.getAttribute('data-color'))       || '#F7931A',
    mode:        (scriptTag && scriptTag.getAttribute('data-mode'))        || 'append',
    lightning:   (scriptTag && scriptTag.getAttribute('data-lightning'))   || '',
    lang:        (scriptTag && scriptTag.getAttribute('data-lang'))        || 
                 (navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es',
    denomination:(scriptTag && scriptTag.getAttribute('data-denomination'))|| 'sats',
  };

  // ── Strings ───────────────────────────────────────────────────
  var STR = {
    es: { pay: 'Pagar con ⚡ Lightning', sats: 'sats', close: 'Cerrar',
          scanning: 'Escaneando QR con tu wallet Lightning',
          amount: 'Monto', address: 'Dirección Lightning',
          noWallet: '¿No tienes wallet Lightning?',
          getOne: 'Descarga una gratis:' },
    en: { pay: 'Pay with ⚡ Lightning', sats: 'sats', close: 'Close',
          scanning: 'Scan QR with your Lightning wallet',
          amount: 'Amount', address: 'Lightning address',
          noWallet: "Don't have a Lightning wallet?",
          getOne: 'Get one free:' },
  };
  var T = STR[CONFIG.lang] || STR.es;

  // ── Currency database ─────────────────────────────────────────
  var CURRENCIES = {
    MXN: { cg: 'mxn', sym: '$',  dec: '.', thou: ',' },
    USD: { cg: 'usd', sym: '$',  dec: '.', thou: ',' },
    EUR: { cg: 'eur', sym: '€',  dec: ',', thou: '.' },
    GBP: { cg: 'gbp', sym: '£',  dec: '.', thou: ',' },
    BRL: { cg: 'brl', sym: 'R$', dec: ',', thou: '.' },
    COP: { cg: 'cop', sym: '$',  dec: ',', thou: '.' },
    ARS: { cg: 'ars', sym: '$',  dec: ',', thou: '.' },
    CAD: { cg: 'cad', sym: '$',  dec: '.', thou: ',' },
    AUD: { cg: 'aud', sym: '$',  dec: '.', thou: ',' },
    JPY: { cg: 'jpy', sym: '¥',  dec: '.', thou: ',' },
  };

  // ── Auto-detect currency ──────────────────────────────────────
  function detectCurrency() {
    if (CONFIG.currency !== 'AUTO' && CURRENCIES[CONFIG.currency]) {
      return CONFIG.currency;
    }
    var host   = location.hostname.toLowerCase();
    var locale = (navigator.language || 'en').toLowerCase();
    if (host.endsWith('.mx')) return 'MXN';
    if (host.endsWith('.br') || host.endsWith('.com.br')) return 'BRL';
    if (host.endsWith('.ar')) return 'ARS';
    if (host.endsWith('.co') && !host.endsWith('.com')) return 'COP';
    if (host.endsWith('.de') || host.endsWith('.fr') || host.endsWith('.es')) return 'EUR';
    if (host.endsWith('.uk') || host.endsWith('.co.uk')) return 'GBP';
    if (locale.startsWith('es-mx')) return 'MXN';
    if (locale.startsWith('pt-br')) return 'BRL';
    if (locale.startsWith('de') || locale.startsWith('fr')) return 'EUR';
    return 'USD';
  }

  // ── State ─────────────────────────────────────────────────────
  var activeCurrency = detectCurrency();
  var activeDef      = CURRENCIES[activeCurrency] || CURRENCIES.USD;
  var btcRate        = null;
  var observer       = null;
  var processed      = new WeakSet();

  // ── Fetch BTC rate ────────────────────────────────────────────
  var CACHE_KEY = 'sats_widget_rate_' + activeDef.cg;

  function fetchRate(callback) {
    // Try cache first (valid for 7 min)
    try {
      var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.ts < 420000) {
        callback(cached.rate);
        return;
      }
    } catch(e) {}

    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=' + activeDef.cg)
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var rate = d && d.bitcoin && d.bitcoin[activeDef.cg];
        if (rate) {
          btcRate = rate;
          try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ rate: rate, ts: Date.now() })); } catch(e) {}
          callback(rate);
        }
      })
      .catch(function() { callback(null); });
  }

  // ── Conversion ────────────────────────────────────────────────
  function toSats(amount) {
    if (!btcRate) return null;
    return Math.round((amount / btcRate) * 100000000);
  }

  function formatSats(sats) {
    if (sats >= 1000000) return (sats / 1000000).toFixed(1) + 'M ' + T.sats;
    if (sats >= 10000)   return Math.round(sats / 1000) + 'k ' + T.sats;
    return sats.toLocaleString() + ' ' + T.sats;
  }

  function formatBtc(amount) {
    var btc = amount / btcRate;
    if (btc >= 0.1)    return '₿' + btc.toFixed(3);
    if (btc >= 0.01)   return '₿' + btc.toFixed(4);
    if (btc >= 0.001)  return '₿' + btc.toFixed(5);
    if (btc >= 0.0001) return '₿' + btc.toFixed(6);
    return '₿' + btc.toFixed(8);
  }

  function formatLabel(amount) {
    var sats  = toSats(amount);
    var denom = CONFIG.denomination;
    if (denom === 'btc')  return formatBtc(amount);
    if (denom === 'both') return '~' + formatSats(sats) + ' / ' + formatBtc(amount);
    return '~' + formatSats(sats); // default: sats
  }

  function parseAmount(str) {
    var s = str.replace(/[^\d.,]/g, '');
    if (activeDef.dec === ',') {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
    return parseFloat(s);
  }

  // ── Inject styles ─────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('sats-widget-styles')) return;
    var style = document.createElement('style');
    style.id  = 'sats-widget-styles';
    var c = CONFIG.color;
    style.textContent = [
      '.sats-badge{display:inline-flex;align-items:center;gap:5px;',
        'background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);',
        'border-radius:5px;padding:2px 8px;font-size:0.8em;font-weight:700;',
        'color:' + c + ';white-space:nowrap;vertical-align:middle;',
        'font-family:-apple-system,sans-serif;margin-left:6px;cursor:default}',

      '.sats-pay-btn{display:inline-flex;align-items:center;gap:6px;',
        'background:' + c + ';color:#fff;border:none;border-radius:7px;',
        'padding:8px 16px;font-size:0.85em;font-weight:700;cursor:pointer;',
        'font-family:-apple-system,sans-serif;margin-left:8px;',
        'transition:opacity .15s;text-decoration:none}',
      '.sats-pay-btn:hover{opacity:.88}',

      '.sats-modal-overlay{display:none;position:fixed;inset:0;',
        'background:rgba(0,0,0,0.7);z-index:999999;',
        'align-items:center;justify-content:center}',
      '.sats-modal-overlay.open{display:flex}',

      '.sats-modal{background:#111;border:1px solid #2a2a2a;',
        'border-top:3px solid ' + c + ';border-radius:12px;',
        'padding:28px;max-width:340px;width:90%;',
        'font-family:-apple-system,sans-serif;color:#f0f0f0}',

      '.sats-modal-title{font-size:16px;font-weight:700;',
        'color:' + c + ';margin-bottom:16px}',

      '.sats-modal-amount{font-size:28px;font-weight:800;',
        'color:' + c + ';margin-bottom:4px}',

      '.sats-modal-fiat{font-size:13px;color:#777;margin-bottom:20px}',

      '.sats-qr{width:180px;height:180px;background:#fff;',
        'border-radius:8px;margin:0 auto 16px;display:flex;',
        'align-items:center;justify-content:center;overflow:hidden}',

      '.sats-qr img{width:100%;height:100%}',

      '.sats-lightning-addr{font-size:11px;color:#555;',
        'text-align:center;word-break:break-all;margin-bottom:16px;',
        'font-family:monospace}',

      '.sats-modal-close{width:100%;background:#1a1a1a;',
        'border:1px solid #2a2a2a;color:#777;border-radius:7px;',
        'padding:10px;font-size:13px;cursor:pointer;',
        'font-family:inherit;transition:all .15s}',
      '.sats-modal-close:hover{border-color:' + c + ';color:' + c + '}',
      '.sats-wallet-section{margin-top:16px;padding-top:14px;border-top:1px solid #2a2a2a}',
      '.sats-wallet-label{font-size:11px;color:#555;text-align:center;margin-bottom:4px}',
      '.sats-wallet-btns{display:flex;flex-direction:column;gap:7px}',
      '.sats-wallet-btn{display:flex;align-items:center;gap:10px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:9px 12px;text-decoration:none;color:#ccc;transition:border-color .15s;cursor:pointer}',
      '.sats-wallet-btn:hover{border-color:' + c + ';color:#fff}',
      '.sats-wallet-icon{font-size:16px;flex-shrink:0}',
      '.sats-wallet-name{font-size:13px;font-weight:600;flex:1}',
      '.sats-wallet-tag{font-size:10px;color:#555;background:#111;border:1px solid #222;border-radius:4px;padding:2px 6px;white-space:nowrap}',
    ].join('');
    document.head.appendChild(style);
  }

  // ── Lightning modal ───────────────────────────────────────────
  var modalEl = null;

  function createModal() {
    if (modalEl) return;
    modalEl = document.createElement('div');
    modalEl.className = 'sats-modal-overlay';
    modalEl.innerHTML = [
      '<div class="sats-modal">',
        '<div class="sats-modal-title">⚡ ' + T.pay + '</div>',
        '<div class="sats-modal-amount" id="sats-m-sats"></div>',
        '<div class="sats-modal-fiat" id="sats-m-fiat"></div>',
        '<div class="sats-qr" id="sats-m-qr">',
          '<img id="sats-m-qr-img" src="" alt="Lightning QR"/>',
        '</div>',
        '<div class="sats-lightning-addr" id="sats-m-addr"></div>',
        '<button class="sats-modal-close" id="sats-m-close">' + T.close + '</button>',
        '<div class="sats-wallet-section">',
          '<div class="sats-wallet-label">' + (T.noWallet || "Don\'t have a Lightning wallet?") + '</div>',
          '<div class="sats-wallet-label" style="margin-bottom:8px">' + (T.getOne || "Get one free:") + '</div>',
          '<div class="sats-wallet-btns">',
            '<a class="sats-wallet-btn" href="https://www.walletofsatoshi.com" target="_blank" rel="noopener">',
              '<span class="sats-wallet-icon">🟠</span>',
              '<span class="sats-wallet-name">Wallet of Satoshi</span>',
              '<span class="sats-wallet-tag">Beginner</span>',
            '</a>',
            '<a class="sats-wallet-btn" href="https://strike.me" target="_blank" rel="noopener">',
              '<span class="sats-wallet-icon">⚡</span>',
              '<span class="sats-wallet-name">Strike</span>',
              '<span class="sats-wallet-tag">Mexico / US</span>',
            '</a>',
            '<a class="sats-wallet-btn" href="https://muun.com" target="_blank" rel="noopener">',
              '<span class="sats-wallet-icon">🔒</span>',
              '<span class="sats-wallet-name">Muun</span>',
              '<span class="sats-wallet-tag">Self-custody</span>',
            '</a>',
          '</div>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(modalEl);

    modalEl.addEventListener('click', function(e) {
      if (e.target === modalEl) closeModal();
    });
    document.getElementById('sats-m-close').addEventListener('click', closeModal);
  }

  function openModal(sats, fiatText) {
    createModal();
    document.getElementById('sats-m-sats').textContent = formatSats(sats);
    document.getElementById('sats-m-fiat').textContent = fiatText;

    var addr   = CONFIG.lightning;
    var amount = sats;
    var lnurl  = 'lightning:' + addr + '?amount=' + amount;

    // QR code via free API (no key needed)
    var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' +
                encodeURIComponent(lnurl);
    document.getElementById('sats-m-qr-img').src = qrUrl;
    document.getElementById('sats-m-addr').textContent = addr;

    modalEl.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (modalEl) modalEl.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── Create badge + pay button ─────────────────────────────────
  function makeBadge(amount, fiatText) {
    var sats = toSats(amount);
    var wrap = document.createElement('span');
    wrap.setAttribute('data-sats-done', '1');

    // Sats badge
    var badge = document.createElement('span');
    badge.className   = 'sats-badge';
    badge.textContent = formatLabel(amount);
    wrap.appendChild(badge);

    // Lightning pay button (only if merchant has Lightning address)
    if (CONFIG.lightning) {
      var btn = document.createElement('button');
      btn.className   = 'sats-pay-btn';
      btn.textContent = T.pay;
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        openModal(sats, fiatText);
      });
      wrap.appendChild(btn);
    }

    return wrap;
  }

  // ── Process a single element with data-sats-price ─────────────
  function processManualEl(el) {
    if (processed.has(el)) return;
    if (el.nextSibling && el.nextSibling.getAttribute &&
        el.nextSibling.getAttribute('data-sats-done')) return;

    var raw    = el.getAttribute('data-sats-price');
    var amount = parseFloat(raw);
    if (isNaN(amount) || amount <= 0) return;

    var sats  = toSats(amount);
    if (!sats) return;

    var fiat  = el.textContent.trim();
    processed.add(el);
    el.parentNode.insertBefore(makeBadge(amount, fiat), el.nextSibling);
  }

  // ── Auto-detect prices in text nodes ─────────────────────────
  var PRICE_REGEX = new RegExp(
    '(?:' +
      '(?:\\$|€|£|R\\$|¥|₹|₩|₺|zł|kr|CHF)\\s*(\\d[\\d\\s,\\.]+)' +
    '|' +
      '(\\d[\\d\\s,\\.]+)\\s*(?:MXN|USD|EUR|GBP|BRL|COP|ARS|pesos?|dollars?)\\b' +
    ')',
    'g'
  );

  var SKIP_TAGS = new Set(['SCRIPT','STYLE','NOSCRIPT','INPUT','TEXTAREA',
                           'SELECT','BUTTON','CODE','PRE','HEAD']);

  function processTextNode(node) {
    if (processed.has(node)) return;
    var text = node.textContent;
    if (!text || !text.trim()) return;
    if (!/\d/.test(text)) return;

    var parent = node.parentElement;
    if (!parent) return;
    if (SKIP_TAGS.has(parent.tagName)) return;
    if (parent.getAttribute('data-sats-done')) return;

    PRICE_REGEX.lastIndex = 0;
    var matches = [];
    var m;
    while ((m = PRICE_REGEX.exec(text)) !== null) {
      var raw    = (m[1] || m[2] || '').replace(/\s/g, '');
      var amount = parseAmount(raw);
      if (isNaN(amount) || amount < 1 || amount > 100000000) continue;
      matches.push({ full: m[0], index: m.index, end: m.index + m[0].length, amount: amount });
    }
    if (!matches.length) return;

    processed.add(node);
    parent.setAttribute('data-sats-done', '1');

    var frag = document.createDocumentFragment();
    var last = 0;

    matches.forEach(function(match) {
      if (match.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, match.index)));
      }
      frag.appendChild(document.createTextNode(match.full));
      if (toSats(match.amount)) frag.appendChild(makeBadge(match.amount, match.full));
      last = match.end;
    });

    if (last < text.length) {
      frag.appendChild(document.createTextNode(text.slice(last)));
    }
    parent.replaceChild(frag, node);
  }

  // ── Walk DOM ──────────────────────────────────────────────────
  function walkDOM(root) {
    if (!btcRate) return;

    // Manual: data-sats-price elements
    var manualEls = (root.querySelectorAll ? root : document)
      .querySelectorAll('[data-sats-price]:not([data-sats-done])');
    for (var i = 0; i < manualEls.length; i++) processManualEl(manualEls[i]);

    // Auto: text nodes
    if (root.nodeType === Node.TEXT_NODE) {
      processTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    if (SKIP_TAGS.has(root.tagName)) return;
    if (root.getAttribute('data-sats-done')) return;

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node) {
        var p = node.parentElement;
        if (!p || SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.getAttribute('data-sats-done')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(processTextNode);
  }

  // ── MutationObserver for dynamic content ─────────────────────
  var mutBatch = [], mutTimer = null;

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType === Node.ELEMENT_NODE ||
              node.nodeType === Node.TEXT_NODE) {
            mutBatch.push(node);
          }
        });
      });
      if (mutBatch.length) {
        clearTimeout(mutTimer);
        mutTimer = setTimeout(function() {
          var batch = mutBatch.splice(0);
          batch.forEach(walkDOM);
        }, 300);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    injectStyles();
    fetchRate(function(rate) {
      if (!rate) return;
      btcRate = rate;
      walkDOM(document.body);
      startObserver();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
