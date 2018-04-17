'use strict';

const http = require('http');
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage()
}).any();

exports.start = function startServer(callback) {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/upload')) {
      upload(req, res, function (err) {
        res.end(req.files.map(f => (f.originalname)).join(','));
      });
    } else {
      res.end(req.url);
    }
  });

  server.on('upgrade', (req, socket, head) => {
    socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
      'Upgrade: WebSocket\r\n' +
      'Connection: Upgrade\r\n' +
      '\r\n');

    console.log('req.url', req.url);

    socket.pipe(socket);
  });

  server.listen(null, 'localhost', callback);
  return server;
};

