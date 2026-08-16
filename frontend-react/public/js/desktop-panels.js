/**
 * desktop-panels.js
 * وظائف التحكم في لوحات البحث والنتائج للكمبيوتر
 * تعمل مع اللوحات الأصلية (search-panel, nearby-apartments-panel, results-panel)
 */

(function () {
    'use strict';

    // وظائف التحكم في اللوحات
    function setupDesktopPanels() {
        // إغلاق وفتح لوحة البحث الذكي للكمبيوتر
        const closeSearchBtn = document.getElementById('close-search-panel');
        const openSearchBtn = document.getElementById('open-search-panel-desktop');
        const searchPanel = document.getElementById('search-panel');

        if (closeSearchBtn && searchPanel) {
            closeSearchBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                searchPanel.classList.add('hidden');
                searchPanel.style.removeProperty('display');
            });
        }

        if (openSearchBtn && searchPanel) {
            openSearchBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                searchPanel.classList.remove('hidden');
                searchPanel.style.display = 'block';
            });
        }

        // إغلاق وفتح لوحة البحث من خلال الموقع للكمبيوتر
        const closeNearbyBtn = document.getElementById('close-nearby-panel');
        const openNearbyBtn = document.getElementById('open-nearby-panel-desktop');
        const nearbyPanel = document.getElementById('nearby-apartments-panel');

        if (closeNearbyBtn && nearbyPanel) {
            closeNearbyBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                nearbyPanel.classList.add('hidden');
                nearbyPanel.style.removeProperty('display');
            });
        }
        if (openNearbyBtn && nearbyPanel) {
            openNearbyBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                nearbyPanel.classList.remove('hidden');
                nearbyPanel.style.display = 'block';
            });
        }

        // إغلاق وفتح لوحة النتائج للكمبيوتر
        const closeResultsBtn = document.getElementById('close-results-panel');
        const resultsPanel = document.getElementById('results-panel');

        if (closeResultsBtn && resultsPanel) {
            closeResultsBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                resultsPanel.classList.add('hidden');
                resultsPanel.style.removeProperty('display');
            });
        }
    }

    // تفعيل الوظائف عند تحميل الصفحة
    function initDesktopPanels() {
        setupDesktopPanels();
    }

    // تأخير التحميل لضمان وجود العناصر في DOM
    function delayedInit() {
        setTimeout(initDesktopPanels, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', delayedInit);
    } else {
        delayedInit();
    }

})();
