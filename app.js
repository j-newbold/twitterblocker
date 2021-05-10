require("dotenv").config();
const prompt = require('prompt-sync')();
const twit = require('./twit');
const request = require('request');
const Cheerio = require('cheerio');
const _ = require('underscore');
const fs = require('fs');

const user = prompt('Enter a twitter username: ');

const query = fs.readFileSync('query.txt', 'utf8').split('\n').map(e => e.trim());

let infoReqsRemaining = 900;
let followIdReqsRemaining = 15;
// friend iq requests should be 15, but aren't?
let friendIdReqsRemaining = 5;

var startingCursor = -1;
var res_array = [];

var blockDict = {};
var userArray = [];
var blockList = [];
var usersSearched = [];

const numSearches = 10;
var searchesDone = 0;

// create a setInterval for doing the blocking
var intervalId;

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

function getUserInfo(id_list) {
    return twit.get('users/lookup', {
            "user_id": id_list
        }).then(function(data) {
            res_array.push(data);
        })
        .catch(function(error) {
            throw error;
        })
}

async function displayAllFollowers(cur, userName) {
    // may need to return a promise
    if (followIdReqsRemaining == 0) {
        console.log('out of follow id requests');
        return new Promise((resolve, reject) => {
            resolve();
        });
    } else {
        followIdReqsRemaining = followIdReqsRemaining-1;
    }

    const result = await twit.get('followers/ids', { screen_name: userName, stringify_ids: true, count: 5000, cursor: cur });
    if (result.err) {
        console.log(result.err);
        return;
    }
    var requestNum = Math.floor(result.data.ids.length / 100);
    var remainder = result.data.ids.length % 100;
    var promises_arr = [];
    for (var i = 0; i < requestNum; i++) {
        promises_arr.push(getUserInfo(result.data.ids.slice(i * 100, i * 100 + 100).join(",")));
    }
    if (remainder != 0) {
        var x_1 = result.data.ids.slice(requestNum * 100, requestNum * 100 + 100).toString();
        promises_arr.push(getUserInfo(x_1));
    }
    await Promise.all(promises_arr);
    for (var i_1 in res_array) {
        for (var j in res_array[i_1].data) {
            var newUser = {
                id_str: res_array[i_1].data[j].id_str,
                name: res_array[i_1].data[j].name,
                screen_name: res_array[i_1].data[j].screen_name,
                description: res_array[i_1].data[j].description,
                numFollowers: res_array[i_1].data[j].followers_count,
                numFollowing: res_array[i_1].data[j].friends_count
            };
            userArray.push(newUser);
        }
    }
    res_array = [];
    if (result.data.next_cursor != 0) {
        console.log('new cursor: ' + result.data.next_cursor_str);
        // set timeout
        return displayAllFollowers(result.data.next_cursor_str, userName);
    } else {
        return result;
        // analyzeFollowers();
    }
}

async function displayAllFollowing(cur, userName) {
    try {
        if (friendIdReqsRemaining == 0) {
            console.log('out of friend id requests');
            return new Promise((resolve, reject) => {
                resolve();
            });
        } else {
            friendIdReqsRemaining = friendIdReqsRemaining-1;
        }
        const result = await twit.get('friends/ids', { screen_name: userName, stringify_ids: true, count: 5000, cursor: cur });
        console.log('made a friends id request');
        if (result.err) {
            console.log('alert alert alert');
            console.log(result.err);
            return;
        }
        var requestNum = Math.floor(result.data.ids.length / 100);
        var remainder = result.data.ids.length % 100;
        var promises_arr = [];
        for (var i = 0; i < requestNum; i++) {
            promises_arr.push(getUserInfo(result.data.ids.slice(i * 100, i * 100 + 100).join(",")));
        }
        if (remainder != 0) {
            var x_1 = result.data.ids.slice(requestNum * 100, requestNum * 100 + 100).toString();
            promises_arr.push(getUserInfo(x_1));
        }
        await Promise.all(promises_arr);
        for (var i_1 in res_array) {
            for (var j in res_array[i_1].data) {
                var newUser = {
                    id_str: res_array[i_1].data[j].id_str,
                    name: res_array[i_1].data[j].name,
                    screen_name: res_array[i_1].data[j].screen_name,
                    description: res_array[i_1].data[j].description,
                    numFollowers: res_array[i_1].data[j].followers_count,
                    numFollowing: res_array[i_1].data[j].friends_count
                };
                userArray.push(newUser);
            }
        }
        res_array = [];
        if (result.data.next_cursor != 0) {
            console.log('new cursor: ' + result.data.next_cursor_str);
            // set timeout
            return displayAllFollowing(result.data.next_cursor_str, userName);
        } else {
            return result;
        }
    } catch (err) {
        console.log(err);
    }
}

function analyzeFollowers() {
    for (var i in userArray) {
        if (query.some(word => userArray[i].name.includes(word)) || query.some(word => userArray[i].description.includes(word))) {
            // check for duplicates
            if (!blockDict[userArray[i].id_str]) {
                blockList.push(userArray[i]);
                blockDict[userArray[i].id_str] = userArray[i]; 
            }
        }
    }
    blockList.sort((a, b) => b.numFollowers - a.numFollowers);  // b - a sorts list by descending
    //charTest(5);
}

function charTest(num) {
    console.log('generating random users:');
    for (var i = 0;i<num;i++) {
        console.log(blockList[getRandomInt(blockList.length)]);
    }
}

function findNextUser() {
    let i = 0;
    while (i < blockList.length) {
        if (!usersSearched.includes(blockList[i].screen_name)) {
            return blockList[i].screen_name;
        } else {
            i++;
        }
    }
    return false;
}

async function mainRecursion(userName) {
    searchesDone += 1;
    console.log('adding followers for search '+searchesDone+'. Username: '+userName);
    let result = await displayAllFollowers(startingCursor, userName);
    analyzeFollowers();
    console.log('block list length: '+blockList.length);
    result = await displayAllFollowing(startingCursor, userName);
    analyzeFollowers();
    console.log('block list length2: '+blockList.length);
    usersSearched.push(userName);
    let nextUser = findNextUser();
    if (searchesDone >= numSearches) {
        console.log(blockList.slice(0,20));
        return;
    } else {
        console.log('next user: '+nextUser);
        if (nextUser) {
            mainRecursion(nextUser);
        } else {
            console.log("couldn't find a next user, writing data to json");
            let outFile = JSON.stringify(blockList,null,2);
            fs.writeFile("./blockList.json", outFile, 'utf8', function(err) {
                if (err) {
                    return console.log(err);
                }
                console.log('file saved');
            });
        }
    }
}

/* better way to do this (now that I understand promises better) that I will probably not implement
    -remove 'display all following' and only use followers
    -main block of code is for one chunk of 5k followers
    -condition to increment cursor OR analyzeFollowers and choose a new user to recurse on
    -create a setInterval that executes our main block of code until the api limit is reached
    */

/* to-do:
        0. not sure why the block script is messing up write permissions
        1. (probably not going to do) re-implement the main script with the stuff above
        */

mainRecursion(user);