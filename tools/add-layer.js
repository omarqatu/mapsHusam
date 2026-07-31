#!/usr/bin/env node

/**
 * أداة إضافة طبقة جديدة تلقائياً
 * تقوم بتعديل جميع الملفات المطلوبة لإضافة طبقة خدمة أو عقارات
 * 
 * الاستخدام:
 * node tools/add-layer.js --type service --name glass_tech --arabic "فني زجاج وسكريت" --icon "🪟"
 * node tools/add-layer.js --type realestate --name Buildings --arabic "المباني"
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const type = args.find(a => a.startsWith('--type='))?.split('=')[1];
const name = args.find(a => a.startsWith('--name='))?.split('=')[1];
const arabic = args.find(a => a.startsWith('--arabic='))?.split('=')[1];
const icon = args.find(a => a.startsWith('--icon='))?.split('=')[1];

if (!type || !name || !arabic) {
    console.log('❌ خطأ: يجب تحديد type, name, arabic');
    console.log('الاستخدام:');
    console.log('  node tools/add-layer.js --type service --name glass_tech --arabic "فني زجاج وسكريت" --icon "🪟"');
    console.log('  node tools/add-layer.js --type realestate --name Buildings --arabic "المباني"');
    process.exit(1);
}

console.log(`🚀 جاري إضافة طبقة: ${name} (${arabic})`);
console.log(`📋 النوع: ${type}`);
console.log(`🎨 الأيقونة: ${icon || 'غير محدد'}`);

// الملفات التي سيتم تعديلها
const filesToModify = {
    service: [
        'server.js',
        'js/layers.js',
        'js/popup.js',
        'js/edit-core.js',
        'js/quick-search.js',
        'js/no-map-search.js',
        'js/global-search.js',
        'admin-users.html'
    ],
    realestate: [
        'server.js',
        'js/config.js',
        'js/layers.js',
        'js/popup.js',
        'js/editPolygons.js'
    ]
};

const files = filesToModify[type] || [];

console.log(`📁 سيتم تعديل ${files.length} ملفات:`);
files.forEach(f => console.log(`   - ${f}`));

// دالة تعديل ملف
function modifyFile(filePath, modifications) {
    try {
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  الملف غير موجود: ${filePath}`);
            return false;
        }

        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        modifications.forEach(mod => {
            if (content.includes(mod.find)) {
                content = content.replace(mod.find, mod.replace);
                modified = true;
            } else {
                console.log(`⚠️  لم يتم العثور على: ${mod.find.substring(0, 50)}...`);
            }
        });

        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ تم تعديل: ${filePath}`);
            return true;
        } else {
            console.log(`⚠️  لم يتم تعديل: ${filePath} (لم يتم العثور على النصوص المطلوبة)`);
            return false;
        }
    } catch (error) {
        console.log(`❌ خطأ في تعديل ${filePath}:`, error.message);
        return false;
    }
}

// تعديلات لطبقة الخدمة
if (type === 'service') {
    console.log('\n📝 تعديلات طبقة الخدمة:');
    
    // server.js - ALLOWED_LAYERS
    modifyFile('server.js', [{
        find: "const ALLOWED_LAYERS = [",
        replace: `const ALLOWED_LERS = [\n    '${name}',`
    }]);
    
    // layers.js - serviceTranslations
    modifyFile('js/layers.js', [{
        find: "const serviceTranslations = {",
        replace: `const serviceTranslations = {\n    '${name}': { name: '${arabic}', icon: '${icon || '📍'}' },`
    }]);
    
    // popup.js - serviceLayerNames
    modifyFile('js/popup.js', [{
        find: "const serviceLayerNames = [",
        replace: `const serviceLayerNames = [\n    '${arabic}',`
    }]);
    
    // edit-core.js - servicesMapping
    modifyFile('js/edit-core.js', [{
        find: "const servicesMapping = {",
        replace: `const servicesMapping = {\n    '${name}': '${arabic}',`
    }]);
    
    // quick-search.js - iconMap
    modifyFile('js/quick-search.js', [{
        find: "const iconMap = {",
        replace: `const iconMap = {\n    '${name}': 'fa-question-circle',`
    }]);
    
    // no-map-search.js - serviceNames
    modifyFile('js/no-map-search.js', [{
        find: "const serviceNames = {",
        replace: `const serviceNames = {\n    '${name}': '${arabic}',`
    }]);
    
    // global-search.js - layerAliases
    modifyFile('js/global-search.js', [{
        find: "const layerAliases = {",
        replace: `const layerAliases = {\n    '${name}': '${arabic}',`
    }]);
    
    // admin-users.html - serviceLayers
    modifyFile('admin-users.html', [{
        find: "const serviceLayers = [",
        replace: `const serviceLayers = [\n    '${name}',`
    }]);
}

// تعديلات لطبقة العقارات
if (type === 'realestate') {
    console.log('\n📝 تعديلات طبقة العقارات:');
    
    // server.js ALLOWED_LAYERS
    modifyFile('server.js', [{
        find: "const ALLOWED_LAYERS = [",
        replace: `const ALLOWED_LAYERS = [\n    '${name}',`
    }]);
    
    // server.js realEstateLayers
    modifyFile('server.js', [{
        find: "const realEstateLayers = [",
        replace: `const realEstateLayers = [\n    '${name}',`
    }]);
    
    // config.js - layers.realestate
    modifyFile('js/config.js', [{
        find: "realestate: [",
        replace: `realestate: [\n    { id: "${name}Layer", workspace: "realestate", name: "${name}", title: "${arabic}", style: "window.style${name}", maxRes: 0.5, labelThreshold: 0.5 },`
    }]);
    
    // layers.js - style function
    modifyFile('js/layers.js', [{
        find: "window.styleBuildings",
        replace: `window.style${name} = (f, r) => window.createStyle(f, r, {\n    fillColor: 'rgba(120, 120, 120, 1)',\n    strokeColor: '#555',\n    labelField: 'building_type',\n    zoomThresholdForLabel: 0.6\n});`
    }]);
    
    // popup.js - realEstateLayerNames
    modifyFile('js/popup.js', [{
        find: "const realEstateLayerNames = [",
        replace: `const realEstateLayerNames = [\n    '${arabic}',`
    }]);
}

console.log('\n✨ تم الانتهاء من التعديلات!');
console.log('\n⚠️  ملاحظات هامة:');
console.log('1. تأكد من مراجعة الملفات المعدلة يدوياً');
console.log('2. قد تحتاج لإضافة كلمات بحث إضافية في edit-core.js');
console.log('3. تأكد من نشر الطبقة في GeoServer أولاً');
console.log('4. أعد تشغيل الخادم بعد التعديلات');
