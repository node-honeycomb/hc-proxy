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
      app_client: {}
    }
  });

  const server = app.listen(null, callback);
  server.close();

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
    put: () => {},
    delete: () => {},
    all: (route, processor, isWrapper) => {
      if (isWrapper) {
        app.use(route, function (req, res) {
          processor(req, (err, response) => {
            response.pipe(res);
          });
        });
      } else {
        app.use(route, processor);
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
