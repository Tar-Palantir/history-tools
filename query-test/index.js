var express = require('express');
const HistoryTools = require('./HistoryTools.js');
const fs = require('fs');
const { TextDecoder, TextEncoder } = require('util');
const fetch = require('node-fetch');
var bodyParser = require('body-parser');//用于req.body获取值的

var app = express();

app.use(bodyParser.json());
// 创建 application/x-www-form-urlencoded 编码解析
app.use(bodyParser.urlencoded({ extended: false }));

const encoder = new TextEncoder('utf8');
const decoder = new TextDecoder('utf8');
let chainClientWasm;
let tokenClientWasm;

function prettyPrint(title, json) {
    console.log('\n' + title + '\n====================');
    console.log(JSON.stringify(JSON.parse(json), null, 4));
}

async function query(request){

    // Query wasm-ql server
    const queryReply = await fetch('http://47.244.56.139:20080/wasmql/v1/query', {
        method: 'POST',
        body: HistoryTools.combineRequests([
            request
        ]),
    });
    if (queryReply.status !== 200)
        throw new Error(queryReply.status + ': ' + queryReply.statusText + ': ' + await queryReply.text());

    // Split up responses
    const responses = HistoryTools.splitResponses(new Uint8Array(await queryReply.arrayBuffer()));
    let respData = tokenClientWasm.decodeQueryResponse(responses[0]);
    return JSON.parse(respData);
}

app.post('/token/mult_token_balance', async (req, res, next) => {
    const request = tokenClientWasm.createQueryRequest(JSON.stringify(
        ['bal.mult.tok', {
            snapshot_block: ['head', 0],
            account: req.body.account,
            first_key: { sym: '', code: '' },
            last_key: { sym: 'ZZZZZZZ', code: 'zzzzzzzzzzzzj' },
            max_results: 10,
        }]
    ));
    res.send(await query(request));
 });

 app.post('/token/transfer_records', async (req, res, next) => {
    const request = tokenClientWasm.createQueryRequest(JSON.stringify(
        ['transfer', {
            snapshot_block: ['head', 0],
            first_key: {
                receiver: req.body.account,
                account: '',
                block: ['absolute', 0],
                transaction_id: '0000000000000000000000000000000000000000000000000000000000000000',
                action_ordinal: 0,
            },
            last_key: {
                receiver: req.body.account,
                account: 'zzzzzzzzzzzzj',
                block: ['absolute', 999999999],
                transaction_id: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
                action_ordinal: 0xffffffff,
            },
            include_notify_incoming: true,
            include_notify_outgoing: true,
            max_results: 100
        }]
    ));
    res.send(await query(request));
 });

 var server = app.listen(8081, function () {
    var host = server.address().address
    var port = server.address().port
    console.log("应用实例，访问地址为 http://%s:%s", host, port)
 });

(async () => {
    try {
        chainClientWasm = await HistoryTools.createClientWasm({
            mod: new WebAssembly.Module(fs.readFileSync('./libs/chain-client.wasm')),
            encoder, decoder
        });
   
        tokenClientWasm = await HistoryTools.createClientWasm({
            mod: new WebAssembly.Module(fs.readFileSync('./libs/token-client.wasm')),
            encoder, decoder
        });
    } catch (e) {
        console.log(e);
    }
})()