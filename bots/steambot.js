const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');
const bodyParser = require('body-parser');
const request = require('request');
const fs = require('fs');

var express = require('express');
var app = express();


app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        res.header("Access-Control-Allow-Headers", "Content-Type");
        res.header("Access-Control-Allow-Methods", "PUT, GET, POST, DELETE, OPTIONS");
        next();
    });
	
let https = require('https').createServer({
  key: fs.readFileSync('/home/cstrike.bet (site)/ssl/cstrike.bet.key'),
  cert: fs.readFileSync('/home/cstrike.bet (site)/ssl/cstrike.bet.pem')
  },app);



var managers = [];
var communities = [];

var botsLoaded = 0;
var fullyLoaded = false;

var offers = {}; // tradeHash: amount
var bots = [];
var botIds = [];
var botNames = ['Rain', 'Brick', 'Mouse', 'Blue', 'Dust', 'Ron', 'Tom', 'Sam'];

var itemsInTrade = [];

var inventories = {};
var referenceInventory = {}; //Store the current assetid etc, by name

var pendingItems = {};

function loadBots(){
  var config = JSON.parse(fs.readFileSync('./config/bots.json', 'utf8'));
  bots = config.bots;
  for(var i = 0; i < bots.length; i++){
    console.log("Loading Bot: " + i);
    var bot = bots[i];
    loadBot(bot, i+1);

  }
}


function loadBot(bot, index){

  var community = new SteamCommunity();
  var client = new SteamUser();

  var manager = new TradeOfferManager({
      "steam": client,
      "domain": index + ".cstrike.bet",
      community: community,
      "language": 'en',
  });

  var logOnOptions = {
    accountName: bot.accountName,
    password: bot.password,
    twoFactorCode: SteamTotp.generateAuthCode(bot.sharedSecret)
  };


  if (fs.existsSync('polldata' + index + '.json')) {
  	manager.pollData = JSON.parse(fs.readFileSync('polldata' + index + '.json'));
  }





  client.logOn(logOnOptions);

  client.on('loggedOn', () => {
    console.log('Logged into Steam: ' + index);

    client.setPersona(SteamUser.Steam.EPersonaState.Online, botNames[index]); //Online
  });

  client.on('webSession', (sessionid, cookies) => {
        manager.setCookies(cookies, function(err) {
        if (err) {
          console.log(err);
          process.exit(1); // Fatal error since we couldn't get our API key
          return;
        }

        console.log("Got API key for bot "  + index + ": " + manager.apiKey);
        botsLoaded++;
        botIds.push(client.steamID.getSteamID64());
        if(botsLoaded === managers.length){
          console.log("Bots fully loaded!");
          fullyLoaded = true;
          console.log(botIds);
        }
      });

      community.setCookies(cookies);

      /*setTimeout(function(){
        community.startConfirmationChecker(20000, bot.identitySecret); //identity secret
      }, 12567*index + 500);*/


  });

  manager.on('newOffer', function(offer) {
      console.log("New offer #" + offer.id + " from " + offer.partner.getSteam3RenderedID() + " To bot: " + index);
      //console.log(offer);
      if (offer.partner.getSteamID64() === '' || botIds.indexOf(offer.partner.getSteamID64()) !== -1) {
          offer.accept((err, status) => {
              if (err) {
                  console.log(err);
              } else {
                  //community.checkConfirmations();
                  confirmTrade(index, offer.id);
                  console.log(`Accepted offer. Status: ${status}.`);
              }
          });
      }else{
        offer.decline();
      }
  });

  manager.on('sentOfferChanged', function(offer, oldState) {
  	console.log(`Offer #${offer.id} changed: ${TradeOfferManager.ETradeOfferState[oldState]} -> ${TradeOfferManager.ETradeOfferState[offer.state]}`);

  	if (offer.state == TradeOfferManager.ETradeOfferState.Accepted || offer.state == TradeOfferManager.ETradeOfferState.Declined || offer.state == TradeOfferManager.ETradeOfferState.Canceled || offer.state == TradeOfferManager.ETradeOfferState.InvalidItems ) {
      var ind = index - 1;
      var message = offer.message;
      var hash = message.split(" | ")[1];
      if(hash === undefined || hash === null){
        return;
      }
      if(Object.keys(offers).length === 0)return;

      if(Object.keys(offers).indexOf(hash) !== -1){

        if(offers[hash] === -1){
          ///THIS IS A DEPOSIT
          delete offers[hash];

          if(offer.state == TradeOfferManager.ETradeOfferState.Accepted){
            sendTradeComplete(hash, true);

            //var addToInventory = pendingItems[hash][ind];
            offer.getReceivedItems(false, function(err, addToInventory){
              if(inventories[ind] === undefined)inventories[ind] = [];
              inventories[ind] = inventories[ind].concat(addToInventory);
            });

          }else{
            sendTradeComplete(hash, false);
          }
          delete pendingItems[hash];
        }else{
          if(offer.state == TradeOfferManager.ETradeOfferState.Accepted){
            sendTradeComplete(hash, true);
            var left = offers[hash];
            left--;
            if(left === 0){
              delete pendingItems[hash];
              delete offers[hash];
            }else{
              offers[hash] = left;
            }
          }else{

            var addBack = pendingItems[hash][ind];
            if(inventories[ind] === undefined)inventories[ind] = [];
            console.log("CANCELLING INDEX: " + ind);
            inventories[ind] = inventories[ind].concat(addBack);
            var left = offers[hash];

            left--;

            console.log("LEFT: " + left);
            if(left === 0){
              delete pendingItems[hash];
              sendTradeComplete(hash, false);
              delete offers[hash];
            }else{
              offers[hash] = left;
            }
          }
        }

      }



  	}
});

  manager.on('pollData', function(pollData) {
  	fs.writeFile('polldata' + index + '.json', JSON.stringify(pollData), function() {});
  });

  community.on('sessionExpired', function(){
    client.logOn(logOnOptions);
  });


  community.on('debug', function(msg){
    console.log("DEBUG (Bot " + index + "): " + msg);
  });

  managers[index-1] = manager;
  communities[index-1] = community;

}

function confirmTrade(botNum, offerId){
  var idenSecret = bots[botNum].identitySecret;

  communities[botNum].acceptConfirmationForObject(idenSecret, offerId, function(){});
}


/**

  Each item in items has a classid and instanceid
*/
function requestTheirItems(tradeUrl, items, steam64, tradeHash, callback) {
    //switch out later to get a random bot
    console.log("REQUEST FOR ITEMS HAS BEEN CALLED");
    var botIndex = getRandomBot();
    var manager = managers[botIndex];
    const offer = manager.createOffer(tradeUrl);
    offer.getUserDetails(function(err, me, them) {
        if (err) {
            sendStatus('deposit', 'error', 'tradeurl', tradeHash);
            console.log('Failed to get user details for ' + them + '\n' + err);
            console.log(err);
            return;
        }
        if (them.escrowDays != 0) {
            // user is affected by steam escrow
            sendStatus('deposit', 'error', 'escrow', tradeHash);
            return;
        }
        manager.getUserInventoryContents(steam64, 730, 2, true, (err, inv) => {
            console.log("inventory has been loaded");
            if (err) {
                console.log(err);
            } else {
                console.log("no errors loading");
                var mapped = mapItemsToDescription(inv);
                var itemsToAdd = [];
                for (var i = 0; i < items.length; i++) {
                    var key = items[i].classid + " " + items[i].instanceid + " " + items[i].assetid;
                    //console.log("KEY " + key)
                    var itemObj = mapped[key];
                    //console.log(itemObj);
                    if (itemObj === undefined) {
                        //THROW AN ERROR HERE BACK TO THE CLIENT
                        sendStatus('deposit', 'error', 'no items', tradeHash);
                        console.log("ERROR MATE ");
                        callback("");
                        return;
                    }
                    itemsToAdd.push(itemObj);
                    offer.addTheirItem(itemObj);
                }

                pendingItems[tradeHash] = pendingItems[tradeHash] || {};
                pendingItems[tradeHash][botIndex] = itemsToAdd;

                offer.setMessage(`Hash | ` + tradeHash + " | \n Deposit expires in 10 MINS.");

                offer.send((err, status) => {
                    if (err) {
                        console.log(err);
                    } else {
                        offers[tradeHash] = -1;
                        console.log(`Sent offer. Status: ${status}.`);

                        console.log("ID " + offer.id);
                        callback("https://steamcommunity.com/tradeoffer/" + offer.id);
                        setTimeout(function() {
                            sendStatus('deposit', 'error', 'not accepted', tradeHash);
                            if (tradeHash in offers) {
                                offer.cancel(function() {

                                });
                            }
                        }, 1000 * 60 * 10 + 12000); //12 seconds for poll interval

                    }
                });


            }
        });
    });


}

function sendOurItems(tradeUrl, items, tradeHash, callback){
  //switch out later to get the bot with the items --> build a hashmap with bot as key and items it has --> Then send for each key
  var urls = [];
  var sent = 0;

  mapItemsToBots(items, function(bots){
    console.log("FINISHED MAPPING");
    if(bots === null || bots === undefined){
      console.log("DOES NOT HAVE SAME ITEMS ANYMORE");
      sendTradeComplete(tradeHash, false);
      return;
    }
    //console.log("BOT IS NOT NULL");

    var currentOffers = [];

    var stop = false;
    offers[tradeHash] = Object.keys(bots).length;

    for(var key in bots){
      //console.log(key + " " + bots[key]);
      if(bots.hasOwnProperty(key) && !stop){
        //console.log(key + " " + bots[key]);
        var offer = managers[key].createOffer(tradeUrl);
        var ite = bots[key];

        var itemsToAdd = [];
        //console.log(ite);
        if(ite.length === 0)continue;
        var itemsToRemove = [];
        for(var i = 0; i<ite.length; i++){
          offer.addMyItem(ite[i]);
          itemsToAdd.push(ite[i]);
          itemsToRemove.push(ite[i].classid + " " + ite[i].instanceid + " " +  ite[i].assetid)
        }

        pendingItems[tradeHash] = pendingItems[tradeHash] || {};
        pendingItems[tradeHash][key] = itemsToAdd; //add these items back if declined.
        //console.log(JSON.stringify(pendingItems));
        inventories[key] = inventories[key].filter( function( el ) { //remove the items from the inventory.
          //console.log(itemsToRemove.indexOf(el.classid + " " + el.instanceid + " " +  el.assetid));
          return itemsToRemove.indexOf(el.classid + " " + el.instanceid + " " +  el.assetid) < 0;
        } );


        offer.setMessage(`Hash | ` + tradeHash + ` | \n Withdraw expires in 10 mins.`);
        console.log("ABOUT TO SEND: " + key);
        var incFn = function(){
          sent++;
          if(sent === Object.keys(bots).length){
            callback(urls);
          }
        }

        var sendFunction = wrapFunction(function(key, offer, currentOffers, offers, urls, incFn){
          console.log("SEND FUNCTION FOR: " + key)
          offer.send((err, status) => {
              if (err) {
                  console.log(err);
                  for(var b = 0; b < currentOffers.length; b++){
                    currentOffers[b].cancel(function(){});
                    stop = true;
                    delete offers[tradeHash];
                    callback(null);
                  }
              } else {
                  console.log(`Sent offer. Status: ${status}.`);
                  console.log('LATEST VERSION');
                  setTimeout(function(){
                    //communities[key].checkConfirmations();
                    confirmTrade(key, offer.id);
                  }, 500);
                  urls.push("https://steamcommunity.com/tradeoffer/" + offer.id);
                  incFn();
              }
          });
        }, this, [key, offer, currentOffers, offers, urls, incFn]);

        queueAction(sendFunction);


        setTimeout(function(){
          if(tradeHash in offers){
            offer.cancel(function(){

            });
          }
        }, 1000*60*10 + 12000); //12 seconds for poll interval
      }
    }
  });


}

function mapItemsToBots(items, callback){
  var itemsLeft = items;
  //console.log(itemsLeft);
  var bots = {};
  var done = managers.length;
  for(var i = 0; i < managers.length; i++){

      loadAndCheckBot(i, itemsLeft, function(itemsFoundInBot, itemsLeftToFind, index){
        if(itemsFoundInBot !== null){
          bots[index] = itemsFoundInBot;
          itemsLeft = itemsLeftToFind;
        }

        done--;
        console.log("CHECKED BOT: " + index);
        if(done === 0){
          //console.log(JSON.stringify(bots));
          if(itemsLeft.length === 0){
            callback(bots);
          }else{
            callback(null);
          }

        }

      });

  }
}

var inventoryLoad = 0;


//LOADING AN INVETNROY THAT HASN"T BEEN INITIATED WILL CAUSE AN ERROR
function loadAndCheckBot(ind, itemsLeft, addFn){
    //console.log("PASSED INDEX: " + ind);
    getBotInventory(ind, (inventory, index) => {
          //get which items we have
          //console.log("DIRECTLY AFTER INDEX: " + index);
          var thisBotsItems = [];
          var mapped = mapItemsToDescription(inventory);
          var keysAdded = [];
          console.log("INVENTORY KEYS: " + JSON.stringify(Object.keys(mapped)));
          for(var b = 0; b < itemsLeft.length; b++){
            var key = itemsLeft[b].classid + " " + itemsLeft[b].instanceid + " " +  itemsLeft[b].assetid;
            console.log("LOOKING FOR: " + key);
            var itemObj = mapped[key];
            if(itemObj === undefined){
              continue;
            }
            console.log("ADDING TO: " + index);
            thisBotsItems.push(itemObj);
            keysAdded.push(key);
          }

          //Remove from items to get

          itemsLeft = itemsLeft.filter( function( el ) { //remove the items from the inventory.
            console.log(keysAdded.indexOf(el.classid + " " + el.instanceid + " " +  el.assetid));
            return keysAdded.indexOf(el.classid + " " + el.instanceid + " " +  el.assetid) < 0;
          });

          /*for(var b = 0; b < thisBotsItems.length; b++){
            var indexSplice = itemsLeft.indexOf(thisBotsItems[b]);
            itemsLeft.splice(indexSplice, 1);
          }*/

          if(thisBotsItems.length > 0){
              console.log("KEYS FOUND AND ADDED IN THIS BOT: " + JSON.stringify(keysAdded));
              addFn(thisBotsItems, itemsLeft, index);
            }else{
              addFn(null, null, index);
            }

    });

}



function getRandomBot(){
  return Math.floor(Math.random()*managers.length);
}

function mapItemsToDescription(items){
  var map = {};
  var itemsObj = JSON.parse(JSON.stringify(items));
  //console.log(itemsObj);
  //console.log(itemsObj.length);
  for(var i = 0; i < itemsObj.length; i++){
    map[itemsObj[i].classid + " " + itemsObj[i].instanceid + " " + itemsObj[i].assetid] = itemsObj[i];
  }

  //console.log(map);

  return map;
}

/**
Gets all of the bot inventories together.
*/

function getBotInventories(callback){
  var items = [];
  var checked = 0;
  for(var i = 0; i < managers.length; i++){
    getBotInventory(i, function(bots, index){
      if(bots !== null){
        items = items.concat(bots);
      }
      checked++;
      if(checked == managers.length){
        callback(items);
      }
    });
  }

}

/**
If the bot is loaded, return that. If not load the inventory and store it.
*/

function getBotInventory(index, callback){
  //console.log(JSON.stringify(inventories));
//  console.log("LOADING BOT INVENTORY: " + index);
  if(inventories[index] === undefined){
    //console.log("IT IS NOT LOADED ALREADY");
    loadBotInventory(index, function(bots){
      if(bots !== null){
        inventories[index] = bots;
        referenceInventory[index] = bots;
        callback(bots, index);
      }
    });
  }else{
    //console.log("IT IS LOADED");
    callback(inventories[index], index);
  }
}

/**
Should be only API call to steam for bot inventory.
*/

function loadBotInventory(i, callback){
  managers[i].getInventoryContents(730, 2, true, (err, inventory) => {
      if (err) {
          callback(null);
      } else {
          callback(inventory);
      }
  });
}

loadBots();
startQueue();


/*

All of the express stuff mate


*/

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

function sendTradeComplete(hash, success){
  var options = { method: 'POST',
    url: 'https://cstrike.bet:2083/api/server/tradecompleted',
    headers: {
       'cache-control': 'no-cache',
       'content-type': 'application/x-www-form-urlencoded' },
	rejectUnauthorized: false,
    form: { tradeHash: hash, success: success}  };

  request(options, function (error, response, body) {
  });
}

function sendStatus(tradeType, statusType, status, tradeHash){
  var options = { method: 'POST',
    url: 'https://cstrike.bet:2083/api/server/tradestatus',
    headers: {
       'cache-control': 'no-cache',
       'content-type': 'application/x-www-form-urlencoded' },
	rejectUnauthorized: false,
    form: { tradeType: tradeType, statusType: statusType, tradeHash: tradeHash, status: status }  };

  request(options, function (error, response, body) {
  });
}

var botItemReq = 0;


app.get('/getBotItems', function(req, res){
  botItemReq = botItemReq + 1;

  setTimeout(function(){
    getBotInventories(function(bots){
      var data = JSON.stringify(bots);
      res.send({data});
      botItemReq = botItemReq - 1;
    });
  }, 450*botItemReq);


});

app.post('/initDeposit', function(req, res){

  console.log("INIT DEPOSIT GOT!");
  var hash = req.body.tradeHash;
  var items = req.body.items;
  var steam64 = req.body.steam64;
  var tradeUrl = req.body.tradeUrl;

  items = JSON.parse(items);

  console.log("ITEMS: " + items.toString());
  requestTheirItems(tradeUrl, items, steam64, hash, function(tradeUrl){
    if(tradeUrl === ""){
      res.send('error: could not complete');
    }else{
      res.send('{"tradeUrl": "' + tradeUrl + '", "tradeHash": "' + hash + '"}');
    }
  });
});

app.post('/initwithdraw', function(req, res){

  console.log("INIT WITHDRAW GOT!");
  var hash = req.body.tradeHash;
  var items = req.body.items;
  var steam64 = req.body.steam64;
  var tradeUrl = req.body.tradeUrl;

  items = JSON.parse(items);
//  console.log(items);

  console.log("ITEMS: " + items.toString());
  const offer = managers[0].createOffer(tradeUrl);
  offer.getUserDetails(function(err, me, them) {
      if (err) {
          console.log('Failed to get user details for ' + them + '\n' + err);
          return;
      }
      if (them.escrowDays != 0) {
          // user is affected by steam escrow
          sendTradeComplete(hash, false);
          sendStatus('withdraw', 'error', 'escrow', tradeHash);
          return;
      }

      sendOurItems(tradeUrl, items, hash, function(tradeUrls){
        if(tradeUrls === null){
          res.send('error: could not complete');
        }else{
          res.send('{"tradeUrls": "' + tradeUrls + '", "tradeHash": "' + hash + '"}');
        }
      });
  });



});

funQueue = [];

var wrapFunction = function(fn, context, params) {
    return function() {
        fn.apply(context, params);
    };
}

function queueAction(func){
  funQueue.push(func);
}

function startQueue(){
  setInterval(function(){
    if(funQueue.length > 0){
      (funQueue.shift())();
    }
  }, 500);
}



https.listen(2096);
