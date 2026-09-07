/**
 * js/results-share.js
 * زر "نسخ رابط النتائج" داخل لوحة النتائج + إعادة تنفيذ البحث تلقائياً عند
 * فتح رابط مُشارك (البحث الذكي / البحث السريع / البحث من خلال الموقع)
 */
(function () {
    'use strict';

    function wireCopyButton() {
        const btn = document.getElementById('copy-results-link-btn');
        if (!btn || btn.dataset.wired) return;
        btn.dataset.wired = '1';

        btn.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();

            const link = window.buildResultsShareLink ? window.buildResultsShareLink() : null;
            if (!link) {
                if (window.toast) window.toast('لا توجد نتيجة بحث حالية لمشاركتها.', 'warning');
                else alert('لا توجد نتيجة بحث حالية لمشاركتها.');
                return;
            }

            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(link);
                } else {
                    const ta = document.createElement('textarea');
                    ta.value = link;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                }
                if (window.toast) window.toast('✅ تم نسخ رابط النتائج، يمكنك مشاركته الآن.', 'success');
                else alert('تم نسخ رابط النتائج، يمكنك مشاركته الآن.');
            } catch (err) {
                if (window.toast) window.toast('تعذر نسخ الرابط، يرجى المحاولة يدوياً.', 'error');
                else alert('تعذر نسخ الرابط: ' + link);
            }
        });
    }

    async function replayFromUrlIfPresent() {
        const state = window.parseResultsShareParam ? window.parseResultsShareParam() : null;
        if (!state) return;

        let attempts = 0;
        const maxAttempts = 40; // ~8 ثوانٍ كحد أقصى
        const tryReplay = async function () {
            attempts++;
            let ok = false;
            try {
                if (state.type === 'attribute' && typeof window.replayAttributeSearch === 'function') {
                    ok = await window.replayAttributeSearch(state);
                } else if (state.type === 'quick' && typeof window.replayQuickSearch === 'function') {
                    ok = await window.replayQuickSearch(state);
                } else if (state.type === 'location' && typeof window.replayLocationSearch === 'function') {
                    ok = await window.replayLocationSearch(state);
                }
            } catch (err) {
                console.warn('تعذر إعادة تنفيذ البحث المشترك:', err.message);
            }

            if (!ok && attempts < maxAttempts) {
                setTimeout(tryReplay, 200);
            }
        };

        setTimeout(tryReplay, 1500);
    }

    document.addEventListener('userLoggedIn', function () {
        setTimeout(wireCopyButton, 500);
        replayFromUrlIfPresent();
    });

    if (document.readyState !== 'loading') {
        setTimeout(wireCopyButton, 2000);
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(wireCopyButton, 2000);
        });
    }
})();