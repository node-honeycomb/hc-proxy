'use strict';

const http = require('http');
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage()
}).any();
const debug = require('debug')('hc-proxy-debug');

exports.start = function startServer(callback) {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/upload')) {
      upload(req, res, function (err) {
        req.files.forEach((file) => {
          delete file.buffer;
        });
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(req.files, null, 2));
      });
    } else {
      console.log('req.headers[test-header]', req.headers['test-header']);
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

  server.listen(null, '127.0.0.1', callback);
  return server;
};

