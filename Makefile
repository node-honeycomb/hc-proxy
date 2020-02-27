TEST = $(shell ls -S `find test -type f -name "*.test.js"`)

test:
	@./node_modules/.bin/mocha $(TEST) -t 10000 --exit

install:
	@npm install --registry=https://registry.npm.taobao.org

.PHONY: all install test clean

