# دليل النشر (Deployment Guide)

## نظرة عامة

يقدم هذا المستند إرشادات شاملة لنشر منصة خريطة خدمات فلسطين في بيئات الإنتاج. يغطي إعداد الخادم، تكوين قاعدة البيانات، تقوية الأمان، وإجراءات الصيانة المستمرة.

## المتطلبات الأساسية

### متطلبات النظام

#### الحد الأدنى من المتطلبات
- **وحدة المعالجة المركزية**: 2 نواة
- **ذاكرة الوصول العشوائي**: 4 جيجابايت
- **التخزين**: 20 جيجابايت SSD
- **نظام التشغيل**: Ubuntu 20.04+ أو ما يعادلها
- **Node.js**: 18.x أو أعلى
- **PostgreSQL**: 13.x أو أعلى مع PostGIS
- **GeoServer**: 2.20.x أو أعلى

#### المتطلبات الموصى بها
- **وحدة المعالجة المركزية**: 4+ نواة
- **ذاكرة الوصول العشوائي**: 8 جيجابايت+
- **التخزين**: 50 جيجابايت+ SSD
- **نظام التشغيل**: Ubuntu 22.04 LTS
- **Node.js**: 20.x LTS
- **PostgreSQL**: 15.x مع PostGIS 3.3+
- **GeoServer**: 2.25.x

### تبعيات البرمجيات

```bash
# Node.js و npm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL و PostGIS
sudo apt-get install -y postgresql postgresql-contrib postgis

# GeoServer (يتطلب تثبيت يدوي)
# راجع دليل تثبيت GeoServer

# Nginx (وكيل عكسي)
sudo apt-get install -y nginx

# PM2 (مدير العمليات)
sudo npm install -g pm2

# Git
sudo apt-get install -y git
```

## إعداد الخادم

### تكوين الخادم الأولي

#### تحديث النظام

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential git curl wget
```

#### إنشاء مستخدم التطبيق

```bash
sudo adduser psm
sudo usermod -aG sudo psm
su - psm
```

#### تكوين جدار الحماية

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### إعداد قاعدة البيانات

#### تثبيت PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib postgis
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### إنشاء قواعد البيانات

```bash
sudo -u postgres psql

-- إنشاء قواعد البيانات
CREATE DATABASE services_db;
CREATE DATABASE realestate;

-- إنشاء المستخدمين
CREATE USER psm_user WITH PASSWORD 'strong_password';
GRANT ALL PRIVILEGES ON DATABASE services_db TO psm_user;
GRANT ALL PRIVILEGES ON DATABASE realestate TO psm_user;

-- تمكين PostGIS
\c services_db
CREATE EXTENSION postgis;

\c realestate
CREATE EXTENSION postgis;

\q
```

#### استيراد المخطط

```bash
# استيراد مخطط قاعدة بيانات الخدمات
psql -U psm_user -d services_db -f database/schema.sql

# استيراد مخطط العقارات
psql -U psm_user -d realestate -f database/realestate_schema.sql
```

### إعداد GeoServer

#### التنزيل والتثبيت

```bash
cd /opt
sudo wget https://sourceforge.net/projects/geoserver/files/GeoServer/2.25.0/geoserver-2.25.0-bin.zip
sudo unzip geoserver-2.25.0-bin.zip
sudo mv geoserver-2.25.0 geoserver
sudo chown -R psm:psm geoserver
```

#### تكوين GeoServer

```bash
cd /opt/geoserver
# تعديل data_dir/security/usergroup/default/users.xml
# إضافة مستخدم مسؤول بكلمة مرور قوية
```

#### بدء GeoServer

```bash
cd /opt/geoserver/bin
./startup.sh
```

## نشر التطبيق

### نشر الكود

#### استنساخ المستودع

```bash
cd /home/psm
git clone <repository-url> psm
cd psm
```

#### تثبيت التبعيات

```bash
npm install --production
cd frontend-react
npm install --production
cd ..
```

#### تكوين البيئة

```bash
cp .env.example .env
nano .env
```

تكوين قيم الإنتاج:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
TRUST_PROXY=true

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=psm_user
POSTGRES_PASSWORD=strong_password
SERVICES_DB_NAME=services_db
REAL_ESTATE_DB_NAME=realestate

GEOSERVER_TARGET=http://localhost:8080/geoserver
GEOSERVER_USER=admin
GEOSERVER_PASSWORD=strong_geoserver_password

ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
ALLOW_ALL_ORIGINS=false

SESSION_SECRET=very_long_random_secret_key_minimum_32_chars
JWT_SECRET=very_long_random_jwt_secret_minimum_32_chars

API_RATE_LIMIT=100
API_RATE_WINDOW_MS=900000
AUTH_RATE_LIMIT=5
SOCKET_RATE_LIMIT=10

ENABLE_HELMET=true
ENABLE_CORS=true
ENABLE_RATE_LIMITING=true

MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=.jpg,.jpeg,.png,.gif,.pdf
```

#### بناء الواجهة الأمامية

```bash
cd frontend-react
npm run build
cd ..
```

### إدارة العمليات مع PM2

#### تثبيت PM2

```bash
sudo npm install -g pm2
```

#### إنشاء ملف نظام PM2

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'psm-backend',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/psm/error.log',
    out_file: '/var/log/psm/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

#### بدء التطبيق

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## تكوين Nginx

### تثبيت شهادة SSL

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### تكوين Nginx

```nginx
# /etc/nginx/sites-available/psm
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # رؤوس الأمان
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # الملفات الثابتة للواجهة الأمامية
    location / {
        root /home/psm/psm/frontend-react/dist;
        try_files $uri $uri/ /index.html;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    # وكيل API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # وكيل Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # وكيل GeoServer
    location /geoserver-proxy/ {
        proxy_pass http://localhost:8080/geoserver/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # الملفات الثابتة القديمة
    location /css/ {
        alias /home/psm/psm/css/;
        expires 1d;
    }

    location /js/ {
        alias /home/psm/psm/js/;
        expires 1d;
    }

    location /ol/ {
        alias /home/psm/psm/ol/;
        expires 1d;
    }

    location /icons/ {
        alias /home/psm/psm/icons/;
        expires 1d;
    }
}
```

#### تفعيل الموقع

```bash
sudo ln -s /etc/nginx/sites-available/psm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## تقوية الأمان

### أمان النظام

#### تحديث النظام بانتظام

```bash
# إضافة تحديثات أمنية تلقائية
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

#### تكوين SSH

```bash
# تعديل /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes

sudo systemctl restart ssh
```

#### تكوين Fail2Ban

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### أمان التطبيق

#### تمكين جميع ميزات الأمان

```env
ENABLE_HELMET=true
ENABLE_CORS=true
ENABLE_RATE_LIMITING=true
```

#### تعيين أسرار قوية

```bash
# إنشاء أسرار قوية
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### تكوين قواعد جدار الحماية

```bash
sudo ufw allow from YOUR_IP to any port 22
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3000/tcp  # حظر الوصول المباشر إلى Node.js
```

## صيانة قاعدة البيانات

### استراتيجية النسخ الاحتياطي

#### النسخ الاحتياطي الآلي

```bash
# إنشاء سكريبت النسخ الاحتياطي
nano /home/psm/backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/psm/backups"

# نسخ احتياطي لقاعدة بيانات الخدمات
pg_dump -U psm_user services_db > $BACKUP_DIR/services_db_$DATE.sql

# نسخ احتياطي لقاعدة بيانات العقارات
pg_dump -U psm_user realestate > $BACKUP_DIR/realestate_$DATE.sql

# ضغط النسخ الاحتياطية
gzip $BACKUP_DIR/*.sql

# الاحتفاظ بآخر 7 أيام فقط
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

```bash
chmod +x /home/psm/backup.sh

# إضافة إلى crontab
crontab -e

# تشغيل يومياً الساعة 2 صباحاً
0 2 * * * /home/psm/backup.sh
```

### تحسين قاعدة البيانات

#### الصيانة المنتظمة

```bash
# إنشاء سكريبت الصيانة
nano /home/psm/maintenance.sh
```

```bash
#!/bin/bash
# Vacuum وتحليل قواعد البيانات
psql -U psm_user -d services_db -c "VACUUM ANALYZE;"
psql -U psm_user -d realestate -c "VACUUM ANALYZE;"

# إعادة الفهرسة إذا لزم الأمر
psql -U psm_user -d services_db -c "REINDEX DATABASE services_db;"
psql -U psm_user -d realestate -c "REINDEX DATABASE realestate;"
```

```bash
chmod +x /home/psm/maintenance.sh

# إضافة إلى crontab (أسبوعياً)
0 3 * * 0 /home/psm/maintenance.sh
```

## المراقبة والتسجيل

### مراقبة التطبيق

#### مراقبة PM2

```bash
pm2 monit
pm2 logs
```

#### مراقبة النظام

```bash
# تثبيت أدوات المراقبة
sudo apt install -y htop iotop nethogs
```

### إدارة السجلات

#### تكوين تدوير السجلات

```bash
sudo nano /etc/logrotate.d/psm
```

```
/var/log/psm/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 psm psm
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

## اعتبارات التوسع

### التوسع الأفقي

#### إعداد موازن التحميل

```nginx
# /etc/nginx/nginx.conf
upstream psm_backend {
    least_conn;
    server 10.0.0.1:3000;
    server 10.0.0.2:3000;
    server 10.0.0.3:3000;
}

server {
    location /api/ {
        proxy_pass http://psm_backend;
    }
}
```

#### نسخ قاعدة البيانات

```sql
-- تكوين نسخ PostgreSQL
-- راجع وثائق PostgreSQL للتفاصيل
```

### التوسع الرأسي

#### تخصيص الموارد

```bash
# تعديل حالات نظام PM2 بناءً على أنوية وحدة المعالجة المركزية
# ecosystem.config.js
instances: 'max'  // أو رقم محدد
```

## استعادة الكوارث

### إجراءات الاستعادة

#### استعادة قاعدة البيانات

```bash
# الاستعادة من النسخ الاحتياطي
gunzip < backup_file.sql.gz | psql -U psm_user services_db
```

#### استعادة التطبيق

```bash
# استعادة التطبيق من git
git pull origin main
npm install --production
pm2 restart ecosystem.config.js
```

#### التحقق من النسخ الاحتياطي

```bash
# التحقق المنتظم من النسخ الاحتياطي
# اختبار عملية الاستعادة في بيئة التجهيز
```

## استكشاف الأخطاء وإصلاحها

### المشاكل الشائعة

#### التطبيق لا يبدأ

1. تحقق من سجلات PM2: `pm2 logs`
2. تحقق من متغيرات البيئة
3. تحقق من اتصال قاعدة البيانات
4. تحقق من توفر المنفذ

#### فشل اتصال قاعدة البيانات

1. تحقق من تشغيل PostgreSQL: `sudo systemctl status postgresql`
2. تحقق من بيانات اعتماد الاتصال
3. اختبر الاتصال: `psql -U psm_user -d services_db`
4. تحقق من قواعد جدار الحماية

#### Nginx 502 Bad Gateway

1. تحقق من تشغيل التطبيق: `pm2 status`
2. تحقق من سجلات أخطاء Nginx: `sudo tail -f /var/log/nginx/error.log`
3. تحقق من تكوين الوكيل
4. تحقق من قواعد جدار الحماية

#### مشاكل شهادة SSL

1. تحقق من انتهاء صلاحية الشهادة: `sudo certbot certificates`
2. تجديد الشهادة: `sudo certbot renew`
3. اختبار التجديد: `sudo certbot renew --dry-run`

## جدول الصيانة

### المهام اليومية

- مراقبة سجلات التطبيق
- التحقق من موارد النظام
- التحقق من اكتمال النسخ الاحتياطي

### المهام الأسبوعية

- مراجعة سجلات الأمان
- التحقق من مساحة القرص
- تحديث حزم النظام
- مراجعة مقاييس الأداء

### المهام الشهرية

- تدقيق الأمان
- مراجعة الأداء
- التحقق من النسخ الاحتياطي
- تحديثات التبعيات

### المهام الفصلية

- اختبار استعادة الكوارث
- تخطيط السعة
- تقييم الأمان
- مراجعة البنية

## إجراءات التراجع

### تراجع التطبيق

```bash
# التراجع إلى الإصدار السابق
git checkout <previous-commit>
npm install --production
pm2 restart ecosystem.config.js
```

### تراجع قاعدة البيانات

```bash
# الاستعادة من النسخ الاحتياطي السابق
gunzip < previous_backup.sql.gz | psql -U psm_user services_db
```

## تحسين الأداء

### تحسينات الإنتاج

1. **تمكين الضغط**: تكوين gzip في Nginx
2. **تنفيذ التخزين المؤقت**: استخدم Redis للتخزين المؤقت للجلسة والبيانات
3. **تحسين قاعدة البيانات**: تكوين تجمعات الاتصال والفهارس
4. **تمكين CDN**: خدمة الأصول الثابتة من CDN
5. **مراقبة الأداء**: إعداد أدوات APM

---

**آخر تحديث**: 29 يوليو 2026  
**الإصدار**: 1.0.0  
**الصيانة بواسطة**: فريق التطوير
