const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 5500);
const ROOT = __dirname;
const BACKEND = 'gumi-2team-bankend-2.onrender.com';
const STATIC_FILES = new Map([
    ['/', 'index.html'],
    ['/index.html', 'index.html'],
    ['/app.js', 'app.js'],
    ['/api.js', 'api.js']
]);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

function proxyApi(req, res) {
    const upstream = https.request({
        hostname: BACKEND,
        port: 443,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: BACKEND }
    }, upstreamRes => {
        res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
        upstreamRes.pipe(res);
    });
    upstream.on('error', error => {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ message: `백엔드 연결 실패: ${error.message}` }));
    });
    req.pipe(upstream);
}

http.createServer((req, res) => {
    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
    if (pathname.startsWith('/api/')) return proxyApi(req, res);

    const filename = STATIC_FILES.get(pathname);
    if (!filename) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Not Found');
    }

    const filePath = path.join(ROOT, filename);
    fs.readFile(filePath, (error, data) => {
        if (error) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('파일을 읽을 수 없습니다.');
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
    });
}).listen(PORT, () => {
    console.log(`LocalHub: http://localhost:${PORT}`);
});
