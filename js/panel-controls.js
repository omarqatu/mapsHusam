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

        // إضافة وظيفة السحب
        const header = panel.querySelector('.panel-header');
        if (header) {
            makeDraggable(panel, header);
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
    const toggleBtn = document.querySelector('.banner-toggle-btn');
    if (bannerWrapper && banner && toggleBtn) {
        // استخدام زر التصغير كـ handle للسحب
        bannerWrapper.classList.add('draggable');
        makeDraggable(bannerWrapper, toggleBtn);
    }
}

// دالة جعل العنصر قابلاً للسحب
function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let isDragging = false;

    handle.onmousedown = dragMouseDown;

    // دعم اللمس للموبايل
    handle.ontouchstart = dragTouchStart;

    function dragMouseDown(e) {
        e.preventDefault();
        isDragging = true;
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;

        // إزالة التموضع الثابت عند بدء السحب
        element.style.top = element.offsetTop + 'px';
        element.style.left = element.offsetLeft + 'px';
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        element.style.transform = 'none';

        // إضافة class لمنع transition أثناء السحب
        element.classList.add('dragging');
    }

    function elementDrag(e) {
        if (!isDragging) return;
        e.preventDefault();

        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        let newTop = element.offsetTop - pos2;
        let newLeft = element.offsetLeft - pos1;

        // حدود الشاشة
        const maxTop = window.innerHeight - element.offsetHeight;
        const maxLeft = window.innerWidth - element.offsetWidth;

        newTop = Math.max(0, Math.min(newTop, maxTop));
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));

        element.style.top = newTop + 'px';
        element.style.left = newLeft + 'px';
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
        pos3 = touch.clientX;
        pos4 = touch.clientY;
        document.ontouchend = closeDragElement;
        document.ontouchmove = elementTouchDrag;

        element.style.top = element.offsetTop + 'px';
        element.style.left = element.offsetLeft + 'px';
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        element.style.transform = 'none';

        // إضافة class لمنع transition أثناء السحب
        element.classList.add('dragging');
    }

    function elementTouchDrag(e) {
        if (!isDragging) return;
        e.preventDefault();

        const touch = e.touches[0];
        pos1 = pos3 - touch.clientX;
        pos2 = pos4 - touch.clientY;
        pos3 = touch.clientX;
        pos4 = touch.clientY;

        let newTop = element.offsetTop - pos2;
        let newLeft = element.offsetLeft - pos1;

        const maxTop = window.innerHeight - element.offsetHeight;
        const maxLeft = window.innerWidth - element.offsetWidth;

        newTop = Math.max(0, Math.min(newTop, maxTop));
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));

        element.style.top = newTop + 'px';
        element.style.left = newLeft + 'px';
    }
}

// تصدير الدوال للاستخدام الخارجي
window.initializePanelControls = initializePanelControls;
window.initializeBannerDraggable = initializeBannerDraggable;
window.makeDraggable = makeDraggable;
