'use strict';
const crypto = require('crypto');
const http = require('http');
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage()
}).any();

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';


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
    const key = req.headers['sec-websocket-key'];

    if(req.url.startsWith('/service-ws')) {
      console.log(req.headers);
      if(!req.headers.signature) {
        return socket.write('HTTP/1.1 404');
      }
    }

    const digest = crypto.createHash('sha1')
      .update(key + GUID)
      .digest('base64');

    socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
      'Upgrade: WebSocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${digest}\r\n` + 
      '\r\n');

    socket.pipe(socket);
  });

  server.listen(null, '127.0.0.1', callback);
  return server;
};

