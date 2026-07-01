/**
 * panel-controls.js - نظام التحكم باللوحات (سحب، تصغير، إغلاق)
 */

// تهيئة نظام التحكم باللوحات عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    initializePanelControls();
    initializeBannerDraggable();
});

function initializePanelControls() {
    // تطبيق على جميع اللوحات
    const panels = document.querySelectorAll('.panel-right');

    panels.forEach(panel => {
        // إضافة وظيفة التصغير
        const minimizeBtn = panel.querySelector('.panel-minimize-btn');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', function() {
                panel.classList.toggle('minimized');
                this.textContent = panel.classList.contains('minimized') ? '+' : '−';
            });
        }

        // إضافة وظيفة السحب باستخدام زر التحريك المخصص
        const dragBtn = panel.querySelector('.panel-drag-btn');
        if (dragBtn) {
            makeDraggable(panel, dragBtn);
        }

        // إضافة وظيفة الإغلاق
        const closeBtn = panel.querySelector('.panel-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                panel.classList.add('hidden');
                panel.classList.remove('minimized'); // إزالة حالة التصغير
                const minimizeBtn = panel.querySelector('.panel-minimize-btn');
                if (minimizeBtn) {
                    minimizeBtn.textContent = '−'; // إعادة زر التصغير للحالة الافتراضية
                }
                // إعادة تعيين الموقع عند الإغلاق (لللوحات العادية فقط)
                if (!panel.id.includes('provider')) {
                    panel.style.top = '';
                    panel.style.left = '';
                    panel.style.right = '';
                    panel.style.bottom = '';
                }
            });
        }
    });
}

// تهيئة السحب للبنر
function initializeBannerDraggable() {
    const bannerWrapper = document.querySelector('.feedback-banner-wrapper');
    const banner = document.querySelector('.feedback-banner');
    const dragBtn = document.querySelector('.banner-drag-btn');
    if (bannerWrapper && banner && dragBtn) {
        // منع propagation من زر التحريك إلى الرابط
        dragBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        });

        // استخدام زر التحريك الجديد كـ handle للسحب
        bannerWrapper.classList.add('draggable');
        makeDraggable(bannerWrapper, dragBtn);
    }
}

// دالة جعل العنصر قابلاً للسحب
function makeDraggable(element, handle) {
    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    handle.onmousedown = dragMouseDown;

    // دعم اللمس للموبايل
    handle.ontouchstart = dragTouchStart;

    function dragMouseDown(e) {
        e.preventDefault();
        isDragging = true;

        const rect = element.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        element.style.position = 'fixed';
        element.style.left = rect.left + 'px';
        element.style.top = rect.top + 'px';
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        element.style.transform = 'none';

        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;

        element.classList.add('dragging');
    }

    function elementDrag(e) {
        if (!isDragging) return;
        e.preventDefault();

        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;

        // حدود الشاشة
        const maxTop = window.innerHeight - element.offsetHeight;
        const maxLeft = window.innerWidth - element.offsetWidth;

        newTop = Math.max(0, Math.min(newTop, maxTop));
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));

        element.style.left = newLeft + 'px';
        element.style.top = newTop + 'px';
    }

    function closeDragElement() {
        isDragging = false;
        element.classList.remove('dragging');
        document.onmouseup = null;
        document.onmousemove = null;
    }

    // دعم اللمس للموبايل
    function dragTouchStart(e) {
        isDragging = true;
        const touch = e.touches[0];

        const rect = element.getBoundingClientRect();
        offsetX = touch.clientX - rect.left;
        offsetY = touch.clientY - rect.top;

        element.style.position = 'fixed';
        element.style.left = rect.left + 'px';
        element.style.top = rect.top + 'px';
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        element.style.transform = 'none';

        document.ontouchend = closeDragElement;
        document.ontouchmove = elementTouchDrag;

        element.classList.add('dragging');
    }

    function elementTouchDrag(e) {
        if (!isDragging) return;
        e.preventDefault();

        const touch = e.touches[0];
        let newLeft = touch.clientX - offsetX;
        let newTop = touch.clientY - offsetY;

        const maxTop = window.innerHeight - element.offsetHeight;
        const maxLeft = window.innerWidth - element.offsetWidth;

        newTop = Math.max(0, Math.min(newTop, maxTop));
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));

        element.style.left = newLeft + 'px';
        element.style.top = newTop + 'px';
    }
}

// تصدير الدوال للاستخدام الخارجي
window.initializePanelControls = initializePanelControls;
window.initializeBannerDraggable = initializeBannerDraggable;
window.makeDraggable = makeDraggable;
