TEST = $(shell ls -S `find test -type f -name "*.test.js"`)

test:
	@./node_modules/.bin/mocha $(TEST) -t 100000 --exit

cover:
	@npx nyc mocha $(TEST) -t 10000 --exit

github_install:
	@npm install

install:
	@npm install --registry=https://registry.npm.taobao.org

.PHONY: all install test clean

