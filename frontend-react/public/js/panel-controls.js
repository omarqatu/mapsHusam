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
    let offsetX = 0, offsetY = 0;

    handle.addEventListener('mousedown', dragMouseDown);

    // دعم اللمس للموبايل
    handle.addEventListener('touchstart', dragTouchStart, { passive: false });

    // بعض العناصر (مثل بانر التواصل) مثبتة عبر قواعد CSS بأولوية !important
    // (top/left/right/transform)، والقيم العادية عبر style.prop = value لا يمكنها
    // التغلب على !important الخاص بملف CSS خارجي، لذلك نستخدم setProperty مع
    // أولوية 'important' لضمان عمل السحب فعلياً على كل العناصر بدون استثناء.
    function setImportantStyle(el, prop, value) {
        el.style.setProperty(prop, value, 'important');
    }

    function dragMouseDown(e) {
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;

        const rect = element.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        setImportantStyle(element, 'position', 'fixed');
        setImportantStyle(element, 'left', rect.left + 'px');
        setImportantStyle(element, 'top', rect.top + 'px');
        setImportantStyle(element, 'right', 'auto');
        setImportantStyle(element, 'bottom', 'auto');
        setImportantStyle(element, 'transform', 'none');

        document.addEventListener('mouseup', closeDragElement);
        document.addEventListener('mousemove', elementDrag);

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

        setImportantStyle(element, 'left', newLeft + 'px');
        setImportantStyle(element, 'top', newTop + 'px');
    }

    function closeDragElement() {
        isDragging = false;
        element.classList.remove('dragging');
        document.removeEventListener('mouseup', closeDragElement);
        document.removeEventListener('mousemove', elementDrag);
    }

    // دعم اللمس للموبايل
    function dragTouchStart(e) {
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        const touch = e.touches[0];

        const rect = element.getBoundingClientRect();
        offsetX = touch.clientX - rect.left;
        offsetY = touch.clientY - rect.top;

        setImportantStyle(element, 'position', 'fixed');
        setImportantStyle(element, 'left', rect.left + 'px');
        setImportantStyle(element, 'top', rect.top + 'px');
        setImportantStyle(element, 'right', 'auto');
        setImportantStyle(element, 'bottom', 'auto');
        setImportantStyle(element, 'transform', 'none');

        document.addEventListener('touchend', closeDragElement);
        document.addEventListener('touchmove', elementTouchDrag, { passive: false });

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

        setImportantStyle(element, 'left', newLeft + 'px');
        setImportantStyle(element, 'top', newTop + 'px');
    }
}

// تصدير الدوال للاستخدام الخارجي
window.initializePanelControls = initializePanelControls;
window.initializeBannerDraggable = initializeBannerDraggable;
window.makeDraggable = makeDraggable;