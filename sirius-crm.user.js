// ==UserScript==
// @name         Sirius CRM
// @namespace    https://github.com/SapozhnikUA
// @version      1.3.0
// @homepageURL  https://github.com/SapozhnikUA/SIRIUS-CRM/
// @downloadURL  https://github.com/SapozhnikUA/SIRIUS-CRM/raw/refs/heads/main/sirius-crm.user.js
// @updateURL    https://github.com/SapozhnikUA/SIRIUS-CRM/raw/refs/heads/main/sirius-crm.user.js
// @description  Barcode formatter + copy-on-click (both halves) + red notification badge + WO/WC id nowrap + phone copy button
// @author       SapozhnikUA
// @match        https://sirius-crm.beko.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ── Styles ───────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* Red notification badge */
    .MuiBadge-badge.scs-badge-alert {
      background-color: #e53935 !important;
      color: #fff !important;
      animation: scs-pulse 1.8s ease-in-out infinite;
    }
    @keyframes scs-pulse {
      0%   { box-shadow: 0 0 0 0px rgba(229,57,53,0.5); }
      70%  { box-shadow: 0 0 0 6px rgba(229,57,53,0); }
      100% { box-shadow: 0 0 0 0px rgba(229,57,53,0); }
    }

    /* Barcode — first half, click to select/copy */
    .scs-barcode-copy {
      cursor: pointer;
      border-bottom: 1px dashed currentColor;
    }
    .scs-barcode-copy:hover {
      background-color: rgba(255, 235, 59, 0.35);
    }
    .scs-barcode-copy.scs-copied {
      background-color: rgba(76, 175, 80, 0.35);
    }

    /* WO: <id> — keep together; WO id underlined, WC id not */
    .scs-wo-wrap {
      white-space: nowrap;
    }
    .scs-wo-id {
      text-decoration: underline;
    }

    /* Phone — copy-to-clipboard button */
    .scs-phone-copy {
      position: absolute;
      top: 50%;
      right: 8px;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      padding: 2px;
      margin: 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      color: #757575;
      z-index: 2;
    }
    .scs-phone-copy:hover {
      color: #1976d2;
    }
    .scs-phone-copy.scs-copied {
      color: #4caf50;
    }
  `;
  document.head.appendChild(style);

  // ── 1. Barcode formatter + copy-on-click ────────────────────────────────
  // "Штрих-код:XXXXXXXXXXXXXXXXXXXX" → "Штрих-код: <span>XXXXXXXXXX</span>  * XXXXXXXXXX"
  // Clicking the first 10-digit span selects it (and copies to clipboard) without spaces.
  const BARCODE_RE = /Штрих-код:\s*(\d{10})(\d{10})/;

  function tryBarcode(textNode) {
    const m = BARCODE_RE.exec(textNode.nodeValue);
    if (!m) return undefined;

    const before = textNode.nodeValue.slice(0, m.index);
    const after = textNode.nodeValue.slice(m.index + m[0].length);
    const [, first, second] = m;

    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));

    frag.appendChild(document.createTextNode('Штрих-код: '));

    const span1 = document.createElement('span');
    span1.className = 'scs-barcode-copy';
    span1.textContent = first;
    span1.dataset.copyValue = first;
    span1.title = 'Клік — виділити та скопіювати без пробілів';
    frag.appendChild(span1);

    frag.appendChild(document.createTextNode('  * '));

    const span2 = document.createElement('span');
    span2.className = 'scs-barcode-copy';
    span2.textContent = second;
    span2.dataset.copyValue = second;
    span2.title = 'Клік — виділити та скопіювати без пробілів';
    frag.appendChild(span2);

    let afterNode = null;
    if (after) {
      afterNode = document.createTextNode(after);
      frag.appendChild(afterNode);
    }

    textNode.parentNode.replaceChild(frag, textNode);
    return afterNode;
  }

  // ── 2. "WO: 12345678" / "WC: 12345678" — nowrap (WO id also underlined) ──
  const WO_RE = /WO:\s*(\d+)/;
  const WC_RE = /WC:\s*(\d+)/;

  function makeIdWrapTrier(re, label, underline) {
    return function (textNode) {
      const m = re.exec(textNode.nodeValue);
      if (!m) return undefined;

      const before = textNode.nodeValue.slice(0, m.index);
      const after = textNode.nodeValue.slice(m.index + m[0].length);
      const id = m[1];

      const frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));

      const wrap = document.createElement('span');
      wrap.className = 'scs-wo-wrap';
      wrap.appendChild(document.createTextNode(label + ': '));

      const idSpan = document.createElement('span');
      if (underline) idSpan.className = 'scs-wo-id';
      idSpan.textContent = id;
      wrap.appendChild(idSpan);

      frag.appendChild(wrap);

      let afterNode = null;
      if (after) {
        afterNode = document.createTextNode(after);
        frag.appendChild(afterNode);
      }

      textNode.parentNode.replaceChild(frag, textNode);
      return afterNode;
    };
  }

  const tryWO = makeIdWrapTrier(WO_RE, 'WO', true);
  const tryWC = makeIdWrapTrier(WC_RE, 'WC', false);

  // Recursively applies barcode/WO/WC formatting to a text node and to
  // whatever text node remains after the match (so multiple matches in one
  // node, or several rules, get processed in a chain).
  function formatTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;

    let after = tryBarcode(node);
    if (after !== undefined) {
      formatTextNode(after);
      return;
    }

    after = tryWO(node);
    if (after !== undefined) {
      formatTextNode(after);
      return;
    }

    after = tryWC(node);
    if (after !== undefined) {
      formatTextNode(after);
      return;
    }
  }

  function formatTextNodesIn(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      formatTextNode(root);
      return;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach(formatTextNode);
  }

  // ── 3. Red notification badge ───────────────────────────────────────────
  function updateBadges() {
    document.querySelectorAll('.MuiBadge-badge.MuiBadge-anchorOriginTopRightRectangle')
      .forEach((badge) => {
        const count = parseInt(badge.textContent.trim(), 10);
        badge.classList.toggle('scs-badge-alert', !isNaN(count) && count > 0);
      });
  }

  // ── 4. Phone — copy-to-clipboard button ─────────────────────────────────
  // Adds a small "copy" icon inside each .react-tel-input container.
  // Copies the phone number as "+<digits>" — no spaces, parentheses, dashes.
  const PHONE_COPY_ICON =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">' +
    '<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>' +
    '</svg>';

  function cleanPhoneNumber(raw) {
    // Keep '+' only if it is the first character, then digits only.
    const hasPlus = raw.trim().startsWith('+');
    const digits = raw.replace(/[^\d]/g, '');
    return (hasPlus ? '+' : '') + digits;
  }

  function addPhoneCopyButtons(root) {
    const containers = [];
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (root.matches && root.matches('.react-tel-input')) containers.push(root);
      if (root.querySelectorAll) {
        root.querySelectorAll('.react-tel-input').forEach((el) => containers.push(el));
      }
    }

    containers.forEach((container) => {
      if (container.querySelector('.scs-phone-copy')) return; // already added

      const input = container.querySelector('input.form-control');
      if (!input) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'scs-phone-copy';
      btn.title = 'Скопіювати номер (без пробілів/дужок)';
      btn.innerHTML = PHONE_COPY_ICON;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const value = cleanPhoneNumber(input.value || '');
        if (!value) return;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(value).catch(() => {});
        }

        btn.classList.add('scs-copied');
        setTimeout(() => btn.classList.remove('scs-copied'), 500);
      });

      if (!container.style.position) container.style.position = 'relative';
      // Leave room for the button so the phone text isn't covered
      input.style.paddingRight = '28px';

      container.appendChild(btn);
    });
  }

  // ── Copy-on-click handler ────────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    const target = e.target.closest('.scs-barcode-copy');
    if (!target) return;

    const value = target.dataset.copyValue || target.textContent;

    // Visually select the text (no surrounding spaces)
    const range = document.createRange();
    range.selectNodeContents(target);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    // Copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).catch(() => {});
    }

    // Brief visual feedback
    target.classList.add('scs-copied');
    setTimeout(() => target.classList.remove('scs-copied'), 500);
  });

  // ── MutationObserver — handles all dynamic content ──────────────────────
  const observer = new MutationObserver((mutations) => {
    updateBadges();
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
          formatTextNodesIn(node);
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
          addPhoneCopyButtons(node);
        }
      });
      if (m.type === 'characterData') {
        formatTextNode(m.target);
      }
    });
  });

  function start() {
    formatTextNodesIn(document.body);
    updateBadges();
    addPhoneCopyButtons(document.body);
    observer.observe(document.body, {
      childList: true, subtree: true, characterData: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();
