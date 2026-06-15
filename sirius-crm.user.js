// ==UserScript==
// @name         Sirius CRM
// @namespace    https://github.com/SapozhnikUA
// @version      1.0.0
// @description  Barcode formatter + red notification badge
// @author       SapozhnikUA
// @match        https://sirius-crm.beko.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ── 1. Barcode formatter ──────────────────────────────────────────────────
  // "Штрих-код:XXXXXXXXXXXXXXXXXX" → "Штрих-код: XXXXXXXXXX * XXXXXXXXXX"
  const BARCODE_RE = /Штрих-код:\s*(\d{10})(\d{10})/g;

  function formatBarcodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      BARCODE_RE.lastIndex = 0;
      if (BARCODE_RE.test(node.nodeValue)) nodes.push(node);
    }
    nodes.forEach((n) => {
      const newVal = n.nodeValue.replace(/Штрих-код:\s*(\d{10})(\d{10})/g, 'Штрих-код: $1 * $2');
      if (newVal !== n.nodeValue) n.nodeValue = newVal;
    });
  }

  // ── 2. Red notification badge ─────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
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
  `;
  document.head.appendChild(style);

  function updateBadges() {
    document.querySelectorAll('.MuiBadge-badge.MuiBadge-anchorOriginTopRightRectangle')
      .forEach((badge) => {
        const count = parseInt(badge.textContent.trim(), 10);
        badge.classList.toggle('scs-badge-alert', !isNaN(count) && count > 0);
      });
  }

  // ── MutationObserver — handles both features ──────────────────────────────
  const observer = new MutationObserver((mutations) => {
    updateBadges();
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) formatBarcodes(node);
        else if (node.nodeType === Node.TEXT_NODE) {
          BARCODE_RE.lastIndex = 0;
          if (BARCODE_RE.test(node.nodeValue)) {
            node.nodeValue = node.nodeValue.replace(
              /Штрих-код:\s*(\d{10})(\d{10})/g, 'Штрих-код: $1 * $2'
            );
          }
        }
      });
      if (m.type === 'characterData') {
        BARCODE_RE.lastIndex = 0;
        const n = m.target;
        if (BARCODE_RE.test(n.nodeValue)) {
          n.nodeValue = n.nodeValue.replace(
            /Штрих-код:\s*(\d{10})(\d{10})/g, 'Штрих-код: $1 * $2'
          );
        }
      }
    });
  });

  function start() {
    formatBarcodes(document.body);
    updateBadges();
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
