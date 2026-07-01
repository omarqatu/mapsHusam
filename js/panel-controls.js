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
        // استخدام زر التحريك الجديد كـ handle للسحب
        bannerWrapper.classList.add('draggable');
        makeDraggable(bannerWrapper, dragBtn);
    }
}

// دالة جعل العنصر قابلاً للسحب
function makeDraggable(element, handle) {
    let isDragging = false;
    let startX = 0, startY = 0;
    let currentX = 0, currentY = 0;
    let initialLeft = 0, initialTop = 0;

    handle.onmousedown = dragMouseDown;

    // دعم اللمس للموبايل
    handle.ontouchstart = dragTouchStart;

    function dragMouseDown(e) {
        e.preventDefault();
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        // الحصول على الموقع الحالي
        const rect = element.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        // استخدام position: fixed و transform للسرعة
        element.style.position = 'fixed';
        element.style.left = initialLeft + 'px';
        element.style.top = initialTop + 'px';
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        element.style.transform = 'translate3d(0, 0, 0)';
        element.style.willChange = 'transform';

        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;

        element.classList.add('dragging');
    }

    function elementDrag(e) {
        if (!isDragging) return;
        e.preventDefault();

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        currentX = deltaX;
        currentY = deltaY;

        let newLeft = initialLeft + deltaX;
        let newTop = initialTop + deltaY;

        // حدود الشاشة
        const maxTop = window.innerHeight - element.offsetHeight;
        const maxLeft = window.innerWidth - element.offsetWidth;

        newTop = Math.max(0, Math.min(newTop, maxTop));
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));

        // استخدام transform translate3d للـ hardware acceleration
        element.style.transform = `translate3d(${newLeft - initialLeft}px, ${newTop - initialTop}px, 0)`;
        element.style.left = initialLeft + 'px';
        element.style.top = initialTop + 'px';
    }

    function closeDragElement() {
        if (!isDragging) return;
        isDragging = false;

        // حفظ الموقع النهائي
        const rect = element.getBoundingClientRect();
        element.style.transform = 'none';
        element.style.left = rect.left + 'px';
        element.style.top = rect.top + 'px';
        element.style.willChange = 'auto';

        element.classList.remove('dragging');
        document.onmouseup = null;
        document.onmousemove = null;
    }

    // دعم اللمس للموبايل
    function dragTouchStart(e) {
        isDragging = true;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;

        const rect = element.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        element.style.position = 'fixed';
        element.style.left = initialLeft + 'px';
        element.style.top = initialTop + 'px';
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        element.style.transform = 'translate3d(0, 0, 0)';
        element.style.willChange = 'transform';

        document.ontouchend = closeDragElement;
        document.ontouchmove = elementTouchDrag;

        element.classList.add('dragging');
    }

    function elementTouchDrag(e) {
        if (!isDragging) return;
        e.preventDefault();

        const touch = e.touches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;

        let newLeft = initialLeft + deltaX;
        let newTop = initialTop + deltaY;

        const maxTop = window.innerHeight - element.offsetHeight;
        const maxLeft = window.innerWidth - element.offsetWidth;

        newTop = Math.max(0, Math.min(newTop, maxTop));
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));

        element.style.transform = `translate3d(${newLeft - initialLeft}px, ${newTop - initialTop}px, 0)`;
        element.style.left = initialLeft + 'px';
        element.style.top = initialTop + 'px';
    }
}

// تصدير الدوال للاستخدام الخارجي
window.initializePanelControls = initializePanelControls;
window.initializeBannerDraggable = initializeBannerDraggable;
window.makeDraggable = makeDraggable;
