'use strict';

const httpServer = require('./server/http_server');
const proxyServer = require('./server/proxy_server');
const errorProxy = require('./server/error_proxy');
const request = require('supertest');
const http = require('http');
const assert = require('assert');

describe('开始测试', function () {
  describe('error proxy', function () {
    let httpInstance = null;
    let proxyInstance = null;
    it('start error', function (done) {
      httpInstance = httpServer.start(function () {
        const httpPort = httpInstance.address().port;

        try {
          proxyInstance = errorProxy.start(httpPort);
        } catch (e) {
          assert(e === '[hc-proxy]: endpoint should not be empty, service: app_client');
          done();
        }
      });
    });

    after(() => {
      httpInstance.close();
    });
  });

  describe('normal test', function () {
    let httpInstance = null;
    let proxyInstance = null;
    before((done) => {
      httpInstance = httpServer.start(function () {
        const httpPort = httpInstance.address().port;
        proxyInstance = proxyServer.start(httpPort, done);
      });
    });

    it ('urllib' , function (done) {
      request(proxyInstance).get('/api/proxy/urllib_proxy/urllib').expect(200).end(function (err, res) {
        assert(res.text === '/urllib');
        done();
      });
    });

    it ('urllib defaultQuery GET 1' , function (done) {
      request(proxyInstance).get('/api/proxy/urllib_proxy/default_query?a=2').expect(200).end(function (err, res) {
        assert(res.text === '/default_query?b=2&c=3&a=2');
        done();
      });
    });

    it ('urllib defaultQuery GET 2' , function (done) {
      request(proxyInstance).get('/api/proxy/urllib_proxy/default_query?a=2').expect(200).end(function (err, res) {
        assert(res.text === '/default_query?b=2&c=3&a=2');
        done();
      });
    });

    it ('urllib defaultQuery GET 3 without defaultParam' , function (done) {
      request(proxyInstance).get('/api/proxy/urllib_proxy/query?a=2').expect(200).end(function (err, res) {
        assert(res.text === '/query?a=2');
        done();
      });
    });

    it ('urllib defaultQuery GET 4 queryStar without defaultParam' , function (done) {
      request(proxyInstance).get('/api/proxy/urllib_proxy/query_star/xxx?a=2').expect(200).end(function (err, res) {
        assert(res.text === '/query_star/xxx?a=2');
        done();
      });
    });

    it ('urllib upload file', function (done) {
      request(proxyInstance)
        .post('/api/proxy/urllib_proxy/upload')
        .field('tenantCode', 'dtboost')
        .attach('file', './test/main.test.js')
        .expect(200).end(function (err, res) {
          assert(res.text === 'main.test.js');
          done();
        });
    });

    it ('urllib upload file limited', function (done) {
      request(proxyInstance)
        .post('/api/proxy/urllib_proxy/upload_limited')
        .field('tenantCode', 'dtboost')
        .attach('file', './test/main.test.js')
        .expect(500).end(function (err, res) {
          done();
        });
    });

    it ('urllib defaultQuery POST 1' , function (done) {
      request(proxyInstance).post('/api/proxy/urllib_proxy/default_query?a=2').expect(200).end(function (err, res) {
        assert(res.text === '/default_query?a=2&b=2&c=3');
        done();
      });
    });

    it ('urllib defaultQuery POST 2' , function (done) {
      request(proxyInstance).post('/api/proxy/urllib_proxy/default_query?a=2').expect(200).end(function (err, res) {
        assert(res.text === '/default_query?a=2&b=2&c=3');
        done();
      });
    });

    it ('websocket', function (done) {
      const options = {
        port: proxyInstance.address().port,
        hostname: 'localhost',
        path: '/api/proxy/websocket/ws',
        headers: {
          'Connection': 'Upgrade',
          'Upgrade': 'websocket'
        }
      };

      const req = http.request(options);
      req.end();

      req.on('upgrade', (res, socket, upgradeHead) => {
        const testStr = 'test string!!!';
        socket.on('data', function (data) {
          assert(data.toString() === testStr);
          socket.end();
          done();
        });
        socket.write(testStr);
      });
    });

    it ('websocket with defaultQuery 1', function (done) {
      const options = {
        port: proxyInstance.address().port,
        hostname: 'localhost',
        path: '/api/proxy/websocket/ws1?a=2',
        headers: {
          'Connection': 'Upgrade',
          'Upgrade': 'websocket'
        }
      };

      const req = http.request(options);
      req.end();

      req.on('upgrade', (res, socket, upgradeHead) => {
        const testStr = 'test string!!!';
        socket.on('data', function (data) {
          assert(data.toString() === testStr);
          socket.end();
          done();
        });
        socket.write(testStr);
      });
    });

    it ('websocket with defaultQuery 2', function (done) {
      const options = {
        port: proxyInstance.address().port,
        hostname: 'localhost',
        path: '/api/proxy/websocket/ws1?a=2',
        headers: {
          'Connection': 'Upgrade',
          'Upgrade': 'websocket'
        }
      };

      const req = http.request(options);
      req.end();

      req.on('upgrade', (res, socket, upgradeHead) => {
        const testStr = 'test string!!!';
        socket.on('data', function (data) {
          assert(data.toString() === testStr);
          socket.end();
          done();
        });
        socket.write(testStr);
      });
    });

    it ('websocket wrong', function (done) {
      const options = {
        port: proxyInstance.address().port,
        hostname: 'localhost',
        path: '/api/proxy/websocket/ws_wrong',
        headers: {
          'Connection': 'Upgrade',
          'Upgrade': 'websocket'
        }
      };

      const req = http.request(options, function (res) {
        assert(res.statusCode === 404);
        done();
      });
      req.end();
    });

    it ('azk service should be ok', function (done) {
      request(proxyInstance).get('/api/proxy/app_client/alg/categories').query({
        scopeId: 'dtboost',
        isPrivate: true,
        referType: 'DEFINE',
        tenant: 'dtboost'
      }).expect(200).end(function (err, res) {
        const d = JSON.parse(res.text);
        assert(d.code === 'SUCCESS');
        assert(d.data.data.length > 0);
        done();
      });
    });

    it ('azk upload file api should be ok', function (done) {
      request(proxyInstance)
        .post('/api/proxy/app_client/common/resource/add')
        .field('platform', 'ODPS')
        .field('sourceType', 'JAR')
        .field('name', 'hello.jar')
        .field('description', 'hc-proxy test')
        .field('scopeId', 'dtboost')
        .attach('file', './test/main.test.js')
        .expect(200).end(function (err, res) {
          const d = JSON.parse(res.text);
          assert(d.code === 'SUCCESS');
          done();
        });
    });

    after(() => {
      proxyInstance.close();
      httpInstance.close();
    });
  });
});
