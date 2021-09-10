const stream = require('stream');
const express = require('express');
const app = express();
const config = require('../config');


exports.start = (port, callback) => {
  const Proxy = require('../../');
  const proxyInstance = new Proxy({
    service: {
      app_client: {
        endpoint: 'http://localhost:' + port,
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
        workApp: config.workApp,
        enablePathWithMatch: true,
        headerExtension: [
          function (req, serviceCfg) {
            return {
              'X-Custom-Header': 'custom-header'
            };
          }
        ],
        api: [
          '/alg/categories',
          {
            path: '/common/resource/add',
            method: 'POST',
            file: true,
          },
          {
            path: '/upload/pipe',
            pipe: true
          },
          {
            path: '/common/resource/add/without',
            method: 'POST',
            file: true,
            beforeResponse: (req) => {
              const response = new stream.PassThrough();
              return response.end(Buffer.from(JSON.stringify(req.headers)));
            }
          }          
        ]
      },
      urllib_proxy: {
        endpoint: 'http://localhost:' + port,
        client: 'http',
        enablePathWithMatch: true,
        headerExtension: [
          function (req, serviceCfg) {
            return {
              'test-header': 123
            };
          }
        ],
        api: [
          '/urllib',
          {
            path: '/default_query',
            defaultQuery: 'a=1&b=2&c=3'
          },
          {
            path: '/query'
          },
          {
            path: '/query_delete_param_in_body',
            useQuerystringInDelete: false
          },
          {
            path: '/query_urllib_option',
            method: 'delete',
            useQuerystringInDelete: false,
            urllibOption: {
              dataAsQueryString: true
            }
          },
          {
            path: '/query_star/:star'
          },
          {
            path: '/upload/pipe',
            pipe: true
          },
          {
            path: '/upload',
            file: true
          },
          {
            path: '/upload_limited',
            file: {
              maxFileSize: 1000  // 1kB
            }
          }
        ]
      },
      websocket: {
        endpoint: 'http://localhost:' + port,
        client: 'websocket',
        enablePathWithMatch: true,
        api: [
          '/ws',
          '/ws3/:a',
          {
            path: '/ws1',
            defaultQuery: 'a=1&b=2&c=3'
          },
          '/ws2/:id/test'
        ]
      },
      serviceWebsocket: {
        endpoint: 'http://localhost:' + port,
        client: 'serviceWebsocket',
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
        enablePathWithMatch: true,
        api: [
          '/service-ws'
        ]
      }      
    }
  });

  const server = app.listen(null, '127.0.0.1', callback);

  const router = express.Router();
  const mockRouter = {
    get: function (route, processor, isWrapper) {
      if (isWrapper) {
        router.get(route, function (req, res) {
          processor(req, (err, response) => {
            res.writeHead(response.statusCode, response.headers);
            response.pipe(res);
          });
        });
      } else {
        router.get(route, processor);
      }
    },
    post: (route, processor, isWrapper) => {
      if (isWrapper) {
        router.post(route, function (req, res) {
          processor(req, (err, response) => {
            if(response.pipe) {
              res.writeHead(response.statusCode || 200, response.headers);
              return response.pipe(res);
            }
          });
        });
      } else {
        router.post(route, processor);
      }
    },
    put: (route, processor, isWrapper) => {
      if (isWrapper) {
        router.put(route, function (req, res) {
          processor(req, (err, response) => {
            res.writeHead(response.statusCode || 200, response.headers);
            response.pipe(res);
          });
        });
      } else {
        router.put(route, processor);
      }
    },
    delete: (route, processor, isWrapper) => {
      if (isWrapper) {
        router.delete(route, function (req, res) {
          processor(req, (err, response) => {
            res.writeHead(response.statusCode || 200, response.headers);
            response.pipe(res);
          });
        });
      } else {
        router.delete(route, processor);
      }
    },
    all: (route, processor, isWrapper) => {
      if (isWrapper) {
        router.all(route, function (req, res) {
          processor(req, (err, response) => {
            res.writeHead(response.statusCode || 200, response.headers);
            response.pipe(res);
          });
        });
      } else {
        router.all(route, processor);
      }
    }
  };

  proxyInstance.mount(mockRouter, {
    server,
    options: {
      prefix: '',
    },
    getLog: function () {
      return console;
    }
  });

  app.use('/', router);

  return server;
};
