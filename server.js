/* SERVIDOR DE DESENVOLVIMENTO LOCAL (SEM DEPENDÊNCIAS) */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5173; // Porta padrão do Vite

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // Obter o caminho relativo limpo da URL
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  
  // Se a requisição for para a raiz, serve o index.html
  if (reqPath === '/') {
    reqPath = '/index.html';
  }

  const filePath = path.join(__dirname, reqPath);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404 Arquivo Não Encontrado</h1>', 'utf-8');
        console.log(`404: ${req.method} ${req.url}`);
      } else {
        res.writeHead(500);
        res.end(`Erro no Servidor: ${err.code}`);
        console.log(`500: ${req.method} ${req.url} - ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
      console.log(`200: ${req.method} ${req.url}`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Servidor local Controlator rodando com sucesso!`);
  console.log(`Acesse: http://localhost:${PORT}/`);
  console.log(`==================================================`);
});
