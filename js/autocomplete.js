// js/autocomplete.js

// دالة لتغليف الكود وتجنب تضارب المتغيرات
(function() {
    let valueInput = null;
    let fieldSelect = null;
    let layerSelect = null;
    let autocompleteContainer = null;
    let currentFocus; // لتتبع العنصر النشط

    // إغلاق جميع قوائم الإكمال التلقائي
    function closeAllLists(elmnt) {
        const x = document.getElementsByClassName("autocomplete-items");
        for (let i = 0; i < x.length; i++) {
            if (elmnt != x[i] && elmnt != valueInput) {
                x[i].parentNode.removeChild(x[i]);
            }
        }
    }
    window.closeAllLists = closeAllLists; // متاحة عالمياً

    // إضافة الفئة "active" للعنصر
    function addActive(x) {
        if (!x || x.length === 0) return false;
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        x[currentFocus].classList.add("autocomplete-active");
        x[currentFocus].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // إزالة الفئة "active"
    function removeActive(x) {
        if (!x) return;
        for (let i = 0; i < x.length; i++) {
            x[i].classList.remove("autocomplete-active");
        }
    }

    // التعامل مع حدث الإدخال
    function handleInput() {
        if (!valueInput || valueInput.tagName !== 'INPUT' || valueInput.type !== 'text') {
            closeAllLists();
            autocompleteContainer.innerHTML = '';
            return;
        }

        const val = this.value;
        const selectedLayer = layerSelect ? layerSelect.value : null;
        const selectedField = fieldSelect ? fieldSelect.value : null;
        
        // مصدر البيانات (يجب أن يكون layerMap متاحاً)
        const source = (typeof layerMap !== 'undefined' && selectedLayer) ? layerMap[selectedLayer] : null;

        closeAllLists();
        if (!val || !selectedField || !selectedLayer) {
            autocompleteContainer.innerHTML = '';
            return false;
        }
        currentFocus = -1;

        const allFeatures = source ? source.getFeatures() : [];
        const suggestions = new Set(); // اقتراحات فريدة

        allFeatures.forEach(feature => {
            const attributeValue = feature.get(selectedField);
            if (attributeValue !== undefined && attributeValue !== null) {
                const attrStr = attributeValue.toString();
                if (attrStr.toLowerCase().includes(val.toLowerCase())) {
                    suggestions.add(attrStr);
                }
            }
        });

        const sortedSuggestions = Array.from(suggestions).sort();
        autocompleteContainer.innerHTML = '';

        sortedSuggestions.forEach(suggestion => {
            const b = document.createElement("DIV");
            const i = suggestion.toLowerCase().indexOf(val.toLowerCase());
            b.innerHTML = suggestion.substr(0, i) + "<strong>" + suggestion.substr(i, val.length) + "</strong>";
            b.innerHTML += suggestion.substr(i + val.length);
            
            b.addEventListener("click", function(e) {
                valueInput.value = this.textContent;
                closeAllLists();
            });
            autocompleteContainer.appendChild(b);
        });
    }

    // التعامل مع أحداث لوحة المفاتيح
    function handleKeydown(e) {
        if (!valueInput || valueInput.tagName !== 'INPUT' || valueInput.type !== 'text') {
            return;
        }

        let x = autocompleteContainer.getElementsByTagName("div");
        if (x && x.length > 0) {
            if (e.keyCode == 40) { // سهم لأسفل
                currentFocus++;
                addActive(x);
            } else if (e.keyCode == 38) { // سهم لأعلى
                currentFocus--;
                addActive(x);
            } else if (e.keyCode == 13) { // Enter
                e.preventDefault();
                if (currentFocus > -1) {
                    if (x[currentFocus]) x[currentFocus].click();
                }
            }
        }
    }

    // إعداد مستمعي الأحداث
    function setupEventListeners() {
        // إزالة المستمعين القدامى
        if (valueInput) {
            valueInput.removeEventListener('input', handleInput);
            valueInput.removeEventListener('keydown', handleKeydown);
        }

        // الحصول على العناصر
        valueInput = document.getElementById('value-input');
        fieldSelect = document.getElementById('field-select');
        layerSelect = document.getElementById('layer-select');

        // إضافة مستمعي الأحداث إن كان حقل إدخال نصي
        if (valueInput && valueInput.tagName === 'INPUT' && valueInput.type === 'text') {
            valueInput.addEventListener('input', handleInput);
            valueInput.addEventListener("keydown", handleKeydown);
        } else {
            closeAllLists();
            autocompleteContainer.innerHTML = '';
        }
    }

    // الدالة الرئيسية لتهيئة الإكمال التلقائي
    window.initializeAutocomplete = function() {
        // إنشاء حاوية الإكمال التلقائي إذا لم تكن موجودة
        if (!autocompleteContainer) {
            valueInput = document.getElementById('value-input');
            if (!valueInput) {
                console.error("Value input element not found. Autocomplete cannot be initialized.");
                return;
            }
            autocompleteContainer = document.createElement('div');
            autocompleteContainer.id = 'autocomplete-list';
            autocompleteContainer.className = 'autocomplete-items';
            valueInput.parentNode.insertBefore(autocompleteContainer, valueInput.nextSibling);
        }

        setupEventListeners(); // إعداد المستمعين

        // إغلاق القائمة عند النقر خارجها
        document.removeEventListener("click", closeAllLists);
        document.addEventListener("click", function (e) {
            if (!e.target.closest('.autocomplete-items') && e.target !== valueInput) {
                closeAllLists(e.target);
            }
        });

        // مسح الإدخال عند تغيير الحقل أو الطبقة
        if (fieldSelect) {
            fieldSelect.removeEventListener('change', setupEventListeners);
            fieldSelect.addEventListener('change', setupEventListeners);
        }
        if (layerSelect) {
            layerSelect.removeEventListener('change', setupEventListeners);
            layerSelect.addEventListener('change', setupEventListeners);
        }
    };

    // تهيئة الإكمال التلقائي عند تحميل DOM
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => { // تأخير بسيط
            window.initializeAutocomplete();
        }, 100); 
    });

})();