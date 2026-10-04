/**
 * js/platform-contact-admin.js
 * صفحة إدارة النصوص: حفظ اسم المنصة ورقمي الواتساب والهاتف (platform_name / platform_whatsapp / platform_phone).
 */
(function(){
  'use strict';
  var user=window.__contentAdminUser, form=document.getElementById('platform-contact-form'), status=document.getElementById('pc-status');
  var fields={platform_name:['pc-name','اسم المنصة'],platform_whatsapp:['pc-whatsapp','رقم واتساب المنصة'],platform_phone:['pc-phone','رقم هاتف المنصة']};
  function msg(t,err){status.textContent=t;status.className=err?'status error':'status';}
  fetch('/api/platform-contact').then(function(r){return r.json();}).then(function(d){Object.keys(fields).forEach(function(k){document.getElementById(fields[k][0]).value=d[k]||'';});}).catch(function(){msg('تعذر تحميل القيم الحالية.',true);});
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var wa=document.getElementById('pc-whatsapp').value.trim(), tel=document.getElementById('pc-phone').value.trim();
    if((wa&&!/^[+\d][\d\s-]{6,}$/.test(wa))||(tel&&!/^[+\d][\d\s-]{6,}$/.test(tel))){msg('صيغة الرقم غير صحيحة.',true);return;}
    Promise.all(Object.keys(fields).map(function(k){
      var value=document.getElementById(fields[k][0]).value.trim();
      var opts={headers:{Authorization:'Bearer '+(user.admin_token||user.token||''),'Content-Type':'application/json'}};
      if(!value){opts.method='DELETE';return fetch('/api/admin/platform-content/'+k,opts);}
      opts.method='PUT';opts.body=JSON.stringify({label:fields[k][1],value:value});
      return fetch('/api/admin/platform-content/'+k,opts).then(function(r){if(!r.ok)throw new Error('فشل الحفظ');});
    })).then(function(){msg('تم الحفظ ✅ ستظهر القيم الجديدة خلال دقيقة على كل الصفحات.');}).catch(function(err){msg(err.message,true);});
  });
})();
