'use strict';
// Load modules

const Code = require('code');
const Hapi = require('hapi');
const Inert = require('inert');
const Lab = require('lab');
const Os = require('os');
const Tv = require('../');
const Vision = require('vision');
const Ws = require('ws');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const it = lab.it;
const expect = Code.expect;

internals.waitForSocketMessages = function (fn) {

    setTimeout(fn, 50);
};


it('reports a request event', async (done) => {

    const server = new Hapi.Server();

    server.route({
        method: 'GET',
        path: '/',
        handler: function (request, reply) {

            return reply('1');
        }
    });

    try{
        await server.register([Vision, Inert, { plugin: Tv, options: { port: 0 } }]);
    }catch( err ){
        expect(err).to.not.exist();
    }

    let res = await server.inject('/debug/console');

    expect(res.statusCode).to.equal(200);
    expect(res.result).to.contain('Debug Console');

    const host = res.result.match(/var host = '([^']+)'/)[1];
    const port = res.result.match(/var port = (\d+)/)[1];
    const ws = new Ws('ws://' + host + ':' + port);

    ws.once('open', () => {

        ws.send('subscribe:*');

        internals.waitForSocketMessages(() => {

            server.inject('/?debug=123', (response) => {

                expect(response.result).to.equal('1');
            });
        });
    });

    ws.once('message', async (data, flags) => {

        expect(JSON.parse(data).data.agent).to.equal('shot');
        await server.stop();
        done();
    });


});

it('handles subscribe and unsubscribe', async (done) => {

    const server = new Hapi.Server();

    server.route({
        method: 'GET',
        path: '/',
        handler: () =>  '1' 
    });

    try{
        await server.register([Vision, Inert, { plugin: Tv, options: { port: 0 } }]);
    }catch( err ){
        expect(err).to.not.exist();
    }

    let res = await server.inject('/debug/console');

    expect(res.statusCode).to.equal(200);
    expect(res.result).to.contain('Debug Console');

    const host = res.result.match(/var host = '([^']+)'/)[1];
    const port = res.result.match(/var port = (\d+)/)[1];
    const ws = new Ws('ws://' + host + ':' + port);
    let messageCount = 0;

    ws.once('open', () => {

        ws.send('subscribe:*');

        internals.waitForSocketMessages(async () => {

            await server.inject('/?debug=123');

            internals.waitForSocketMessages(() => {

                const singleRequestMessageCount = messageCount;
                ws.send('unsubscribe:*');

                internals.waitForSocketMessages(async () => {

                    await server.inject('/?debug=123');

                    internals.waitForSocketMessages(() => {

                        expect(messageCount).to.equal(singleRequestMessageCount);

                        done();
                    });
                });
            });
        });
    });

    ws.on('message', (data, flags) => {

        ++messageCount;
    });

    await server.stop();

});

it('does not resubscribe for the same socket', async (done) => {

    const server = new Hapi.Server();

    await server.route({
        method: 'GET',
        path: '/',
        handler: () =>  '1' 
    });

    try{
        await server.register([Vision, Inert, { plugin: Tv, options: { port: 0 } }]);
    }catch( err ){
        expect(err).to.not.exist();
    }

    let res = await server.inject('/debug/console');

    expect(res.statusCode).to.equal(200);
    expect(res.result).to.contain('Debug Console');

    const host = res.result.match(/var host = '([^']+)'/)[1];
    const port = res.result.match(/var port = (\d+)/)[1];
    const ws = new Ws('ws://' + host + ':' + port);
    let messageCount = 0;

    ws.once('open', () => {

        ws.send('subscribe:*');

        internals.waitForSocketMessages(async () => {

            await server.inject('/?debug=123');

            internals.waitForSocketMessages(() => {

                const singleRequestMessageCount = messageCount;
                ws.send('subscribe:*');

                internals.waitForSocketMessages(async () => {

                    await server.inject('/?debug=123');

                    internals.waitForSocketMessages(() => {

                        expect(messageCount).to.equal(singleRequestMessageCount * 2);

                        done();
                    });
                });
            });
        });
    });

    ws.on('message', (data, flags) => {

        ++messageCount;
    });

    await server.stop();

});

it('handles reconnects gracefully', async (done) => {

    const server = new Hapi.Server();

    await server.route({
        method: 'GET',
        path: '/',
        handler: () =>  '1' 
    });

    try{
        await server.register([Vision, Inert, { plugin: Tv, options: { port: 0 } }]);
    }catch( err ){
        expect(err).to.not.exist();
    }

    let res = await server.inject('/debug/console');

    expect(res.statusCode).to.equal(200);
    expect(res.result).to.contain('Debug Console');

    const host = res.result.match(/var host = '([^']+)'/)[1];
    const port = res.result.match(/var port = (\d+)/)[1];
    const ws1 = new Ws('ws://' + host + ':' + port);

    ws1.once('open', () => {

        ws1.send('subscribe:*');
        ws1.close();
        const ws2 = new Ws('ws://' + host + ':' + port);

        ws2.once('open', () => {

            ws2.send('subscribe:*');
            internals.waitForSocketMessages(async () => {

                await server.inject('/?debug=123');

                expect(response.result).to.equal('1');
            });
        });

        // Shouldn't get called
        ws2.once('message', async (data, flags) => {

            expect(JSON.parse(data).data.agent).to.equal('shot');
            await server.stop();
            done();
        });
    });


});

it('uses specified hostname', async () => {

    const server = new Hapi.Server();

    await server.route({
        method: 'GET',
        path: '/',
        handler: () =>  '1' 
    });


    try{
        await server.register([Vision, Inert, { plugin: Tv, options: { host: '127.0.0.1', port: 0 } }]);
    }catch( err ){
        expect(err).to.not.exist();
    }

    let res = await server.inject('/debug/console');

    expect(res.statusCode).to.equal(200);
    expect(res.result).to.contain('Debug Console');

    const host = res.result.match(/var host = '([^']+)'/)[1];
    expect(host).to.equal('127.0.0.1');

    await server.stop();

});

it('uses specified public hostname', async () => {

    const server = new Hapi.Server();

    await server.route({
        method: 'GET',
        path: '/',
        handler: () =>  '1' 
    });

    try{
        await server.register([Vision, Inert, { plugin: Tv, options: { host: '127.0.0.1',  port: 0 } }]);
    }catch( err ){
        expect(err).to.not.exist();
    }

    let res = await server.inject('/debug/console');


    expect(res.statusCode).to.equal(200);
    expect(res.result).to.contain('Debug Console');

    const host = res.result.match(/var host = '([^']+)'/)[1];
    expect(host).to.equal('127.0.0.1');

    await server.stop();

});

it('binds to address and uses host as public hostname', async () => {

    const server = new Hapi.Server();

    await server.route({
        method: 'GET',
        path: '/',
        handler: () =>  '1' 
    });

    try{
        await server.register([Vision, Inert, { plugin: Tv, options: { port: 0, host: 'aaaaa', address: '127.0.0.1' } }]);
    }catch( err ){
        expect(err).to.not.exist();
    }

    let res = await server.inject('/debug/console');

    expect(res.statusCode).to.equal(200);
    expect(res.result).to.contain('Debug Console');

    const host = res.result.match(/var host = '([^']+)'/)[1];
    expect(host).to.equal('aaaaa');

    await server.stop();

});

it('defaults to os hostname if unspecified', async () => {

    const server = new Hapi.Server();

    await server.route({
        method: 'GET',
        path: '/',
        handler: () =>  '1' 
    });

    try{
        await server.register([Vision, Inert, { plugin: Tv, options: { port: 0, host: 'localhost', publicHost: '0.0.0.0' } }]);
    }catch( err ){
        expect(err).to.not.exist();
    }

    let res = await server.inject('/debug/console');



    expect(res.statusCode).to.equal(200);
    expect(res.result).to.contain('Debug Console');

    const host = res.result.match(/var host = '([^']+)'/)[1];
    expect(host).to.equal(Os.hostname());

    await server.stop();

});


it('uses specified route prefix for assets', async () => {

    const server = new Hapi.Server();

    await server.route({
        method: 'GET',
        path: '/',
        handler: () =>  '1' 
    });

    try{
        await server.register([Inert, Vision, { plugin: Tv, options: { port: 0, host: '127.0.0.1' } }], { routes: { prefix: '/test' } });
    }catch( err ){
        expect(err).to.not.exist();
    }

    let res = await server.inject('/test/debug/console');


    expect(res.statusCode).to.equal(200);

    const cssPath = 'href="' + res.request.path + '/css/style.css';
    const jsPath = 'src="' + res.request.path + '/js/main.js';
    expect(res.result).to.contain(cssPath);
    expect(res.result).to.contain(jsPath);

    await server.stop();

});
