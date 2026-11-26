// tiny static server used by the browser tests (no dependencies)
const http = require('http'), fs = require('fs'), path = require('path');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
module.exports = function serve(root, port) {
  return new Promise((res) => {
    const s = http.createServer((req, rsp) => {
      if (req.url === '/__emoji.woff2' && process.env.EMOJI_FONT) { rsp.writeHead(200, { 'Content-Type': 'font/woff2' }); return fs.createReadStream(process.env.EMOJI_FONT).pipe(rsp); }
      let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(root, p);
      if (!f.startsWith(root) || !fs.existsSync(f)) { rsp.writeHead(404); return rsp.end('nf'); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rsp);
    }).listen(port || 0, () => res(s));
  });
};
