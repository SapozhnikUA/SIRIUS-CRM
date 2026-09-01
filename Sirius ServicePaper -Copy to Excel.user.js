// ==UserScript==
// @name         Sirius ServicePaper — Copy to Excel
// @namespace    https://github.com/SapozhnikUA
// @version      1.0.0
// @homepageURL  https://github.com/SapozhnikUA/SIRIUS-CRM/
// @description  Adds "Copy to Excel" button on ServicePaper page — copies key fields separated by Enter
// @author       SapozhnikUA
// @match        https://survey.beko.com/nps/SiriusServicePaper/html/ServicePaper.html*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ── Helpers ───────────────────────────────────────────────────────────────

    // Find a td.ng-binding whose text starts with the given label and return
    // the value after the colon, trimmed.
    function getFieldValue(label) {
        const tds = document.querySelectorAll('td.ng-binding');
        for (const td of tds) {
            const text = td.textContent.trim();
            if (text.startsWith(label + ':')) {
                return text.slice(label.length + 1).trim();
            }
        }
        return '';
    }

    // Same but also searches <span> inside tds (e.g. "Повне ім'я клієнта")
    function getFieldValueDeep(label) {
        const tds = document.querySelectorAll('td.ng-binding, td.Icerik.ng-binding');
        for (const td of tds) {
            const spans = td.querySelectorAll('span.Baslik.ng-binding');
            for (const span of spans) {
                if (span.textContent.trim().startsWith(label + ':')) {
                    // Value = td text minus the span's text
                    const spanText = span.textContent.trim();
                    const full = td.textContent.trim();
                    return full.slice(spanText.length).trim();
                }
            }
        }
        return '';
    }

    // Parse model field: "759991675390  WHC18D011C1 SF FRIDGE/FREEZER COMBINATIO"
    // Returns { nc12, model }
    // 12NC = first 12-digit number
    // Model = tokens after 12NC up to (but not including) the first all-caps word
    //         that contains "/" or is a known appliance type word
    function parseModel(raw) {
        const nc12Match = raw.match(/(\d{12})/);
        const nc12 = nc12Match ? nc12Match[1] : '';
        if (!nc12) return { nc12: '', model: raw.trim() };

        // Text after 12NC
        const rest = raw.slice(raw.indexOf(nc12) + 12).trim();

        // Split into tokens, take while token is NOT a pure-uppercase word containing /
        // or a known type descriptor (FRIDGE, FREEZER, WASHING, DISHWASHER, OVEN, HOB…)
        const TYPE_RE = /^[A-Z0-9]+\/[A-Z0-9]+/;        // e.g. FRIDGE/FREEZER
        const PURE_CAPS = /^[A-Z][A-Z0-9\-]{3,}$/;       // e.g. COMBINATIO, FREESTANDING

        const tokens = rest.split(/\s+/);
        const modelTokens = [];
        for (const tok of tokens) {
            if (TYPE_RE.test(tok) || (PURE_CAPS.test(tok) && modelTokens.length >= 1)) break;
            modelTokens.push(tok);
        }

        return { nc12, model: modelTokens.join(' ').trim() };
    }

    // ── Main: collect data ────────────────────────────────────────────────────
    function collectData() {
        const orderNo      = getFieldValue('Номер заявки');
        const txDate       = getFieldValue('Дата транзакції');
        const defect       = getFieldValue('Проблема в ремонті');

        const modelRaw     = getFieldValueDeep('Модель');
        const serial       = getFieldValueDeep('Серійний номер').replace(/\s/g, '');
        const clientName   = getFieldValueDeep("Повне ім'я клієнта");
        const address      = getFieldValueDeep('Адреса');
        const phone        = getFieldValueDeep('Контактний телефон').replace(/[^\d+]/g, '');
        const saleDate     = getFieldValueDeep('Дата виставлення рахунка');

        const { nc12, model } = parseModel(modelRaw);
        const barcode = nc12 + serial;  // 12NC + serial = 24 chars

        // Output rows (tab-separated for Excel paste, one row per Enter)
        const lines = [
            orderNo,
            txDate.split(" ")[0],
            nc12,
            model,
            '',           // дефект — empty
            "'"+barcode,
            '',           // дефект — empty
            defect,
            '',           // Рішення — empty
            clientName,
            address,
            "'"+phone,
            saleDate,
        ];

        return lines.join('\n');
    }

    // ── Button ────────────────────────────────────────────────────────────────
    const BTN_STYLE = [
        'display:inline-block',
        'margin-right:12px',
        'padding:4px 12px',
        'background:#1565c0',
        'color:#fff',
        'border:none',
        'border-radius:4px',
        'cursor:pointer',
        'font-size:13px',
        'font-family:inherit',
        'vertical-align:middle',
    ].join(';');

    function addButton() {
        // Find the Export PDF button row
        const exportBtn = document.querySelector('input[value="Export Pdf"]');
        if (!exportBtn) return;

        if (document.querySelector('#scs-copy-btn')) return; // already added

        const btn = document.createElement('button');
        btn.id = 'scs-copy-btn';
        btn.type = 'button';
        btn.textContent = '📋 Копіювати в Excel';
        btn.setAttribute('style', BTN_STYLE);

        btn.addEventListener('click', () => {
            const text = collectData();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text)
                    .then(() => {
                    btn.textContent = '✅ Скопійовано!';
                    setTimeout(() => { btn.textContent = '📋 Копіювати в Excel'; }, 1500);
                })
                    .catch(() => fallbackCopy(text, btn));
            } else {
                fallbackCopy(text, btn);
            }
        });

        // Insert before the Export PDF button
        exportBtn.parentNode.insertBefore(btn, exportBtn);
    }

    function fallbackCopy(text, btn) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.textContent = '✅ Скопійовано!';
        setTimeout(() => { btn.textContent = '📋 Копіювати в Excel'; }, 1500);
    }

    // ── Wait for AngularJS to render ──────────────────────────────────────────
    // The page uses AngularJS ($scope, ng-binding) — content renders after JS init.
    function waitAndAdd() {
        // Poll until Export PDF button appears (AngularJS rendered)
        const interval = setInterval(() => {
            if (document.querySelector('input[value="Export Pdf"]')) {
                clearInterval(interval);
                // Extra small delay for ng-binding values to populate
                setTimeout(addButton, 300);
            }
        }, 200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitAndAdd);
    } else {
        waitAndAdd();
    }

})();