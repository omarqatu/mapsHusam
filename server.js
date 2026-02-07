// server.js

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = 3000;

// إعداد البروكسي لـ GeoServer
app.use('/proxy/geoserver', createProxyMiddleware({
    target: 'http://localhost:8080/geoserver',
    changeOrigin: true,
    pathRewrite: {
        '^/proxy/geoserver': ''
    }
}));

// تقديم الملفات الثابتة من المجلد الحالي
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log('GeoServer proxy enabled.');
});