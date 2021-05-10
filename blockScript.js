require("dotenv").config();
const twit = require('./twit');
const request = require('request');
const Cheerio = require('cheerio');
const _ = require('underscore');
const fs = require('fs');

var interval;
var inFile = JSON.parse(fs.readFileSync('./blockList.json'));
var iter = 0;
var rateLimit = 50;

const lineWait = delay => {
    return new Promise(resolve => setTimeout(resolve, delay)).then(v => 1);
}

async function blockFxn() {
    try {
        console.log('blocking more users...');
        for (var i = iter; i < iter + rateLimit; i++) {
            try {
                let result = await twit.post('blocks/create', { screen_name: inFile[i].screen_name, user_id: inFile[i].user_id })
                console.log('blocked user '+inFile[i].screen_name);
            } catch(e) {
                console.log(e); // for handling 'user not found' errors
            }
        }
        iter += 50;
        console.log('blocked '+rateLimit+ ' users!');
    } catch(e) {
        console.log(e);
    }
}

// was gonna use this to experiment with clearing the interval
function ping() {
    console.log('hello! hello! hello!');
}

async function main() {
    while (true) {
        await blockFxn();
        console.log('waiting...');
        await lineWait(900001);
    }
}

main();