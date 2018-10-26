'use strict';

const http = require('http');
const express = require('express');
const app = express();
const config = require('../config');
// const expressWs = require('express-ws')(app);

exports.start = (port, callback) => {
  const Proxy = require('../../');
  const proxyInstance = new Proxy({
    service: {
      app_client: {
        endpoint: config.azkEndpoint,
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
        workApp: config.workApp,
        headerExtension: [
          function (req, serviceCfg) {
            return {
              'X-ScopeId': config.scopeId,
              'X-Operator': config.userId,
              'X-Work-App': serviceCfg.workApp
            };
          }
        ],
        api: [
          '/alg/categories',
          {
            path: '/common/resource/add',
            method: 'POST',
            file: true
          }
        ]
      },
      urllib_proxy: {
        endpoint: 'http://localhost:' + port,
        client: 'http',
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
            path: '/query_patch',
            method: ['patch']
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
            path: '/query_star/*'
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
        api: [
          '/ws',
          {
            path: '/ws1',
            defaultQuery: 'a=1&b=2&c=3'
          },
          '/ws2/:id/test',
          '/ws3/*'
        ]
      }
    }
  });

  const server = app.listen(null, callback);

  proxyInstance.mount({
    get: function (route, processor, isWrapper) {
      if (isWrapper) {
        app.get(route, function (req, res) {
          processor(req, (err, response) => {
            response.pipe(res);
          });
        });
      } else {
        app.get(route, processor);
      }
    },
    post: (route, processor, isWrapper) => {
      if (isWrapper) {
        app.post(route, function (req, res) {
          processor(req, (err, response) => {
            response.pipe(res);
          });
        });
      } else {
        app.post(route, processor);
      }
    },
    put: (route, processor, isWrapper) => {
      if (isWrapper) {
        app.put(route, function (req, res) {
          processor(req, (err, response) => {
            response.pipe(res);
          });
        });
      } else {
        app.put(route, processor);
      }
    },
    patch: (route, processor, isWrapper) => {
      if (isWrapper) {
        app.patch(route, function (req, res) {
          processor(req, (err, response) => {
            response.pipe(res);
          });
        });
      } else {
        app.patch(route, processor);
      }
    },
    delete: (route, processor, isWrapper) => {
      if (isWrapper) {
        app.delete(route, function (req, res) {
          processor(req, (err, response) => {
            response.pipe(res);
          });
        });
      } else {
        app.delete(route, processor);
      }
    }
  }, {
    server,
    options: {
      prefix: '',
    },
    getLog: function () {
      return console;
    }
  });

  return server;
};
