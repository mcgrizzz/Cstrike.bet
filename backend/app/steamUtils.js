var http = require('http');
var https = require('https');
var zlib = require("zlib");
var request = require('request');
var fs = require('fs');

var prices = {};

function canTrade(){

}

function getBotItems(blacklistedItems, callback){
  var returnedItems = [];
  var botIds = ['76561198364620154', '76561198363173544', '76561198363851121', '76561198364481512'];
  var done = false;

  for(var i = 0; i < botIds.length; i++){
    botItemIntermediate(i, botIds, blacklistedItems, function(items, done){
      if(items != null){
        returnedItems = returnedItems.concat(items);
      }
      if(done){
        returnedItems = returnedItems.filter( function( el ) {
          return blacklistedItems.indexOf( el ) < 0;
        });
        callback(returnedItems);
        //console.log(returnedItems);
      }


    });
  }
}

function botItemIntermediate(i, botIds, blacklistedItems, addToItems){
  //console.log(botIds[i]);

  setTimeout(function(){
    //console.log(i);
    getParsedUserItems(botIds[i], false, function(items){
      if(items !== null){
        addToItems(items, false);
      }
      if(i === botIds.length-1){
        addToItems(null, true);
      }
    });
  }, .33*1000*i);

}

function getParsedUserItems(id, selling, callback){
  getCSGOItems(id, function(response){
    if(response === "null" || response === undefined){
      console.log("RESPONSE NULL");
      callback(null);
      return;
    }
    var returnedItems = [];
    var obj = "";
    try{
      obj = JSON.parse(response);
    }catch(err){
      callback(null);
      return;
    }

    var assets = obj.assets;
    var items = obj.descriptions;
    if(items === undefined){
      callback(null);
      return;
    }
    var assetInc = 0;
    for(var b = 0; b < items.length; b++){
      if(items[b].tradable === 0 || items[b].marketable === 0 || items[b].market_name.includes('Sticker') || items[b].market_name.includes('Capsule') || items[b].market_name.includes('Case'))continue;

        var name = items[b].market_name;

        var extras = [];
        for(var i = 0; i < assets.length; i++){
          if(assets[i].classid === items[b].classid && assets[i].instanceid === items[b].instanceid){

            var itemNew = {
              name: name,
              price: getPrice(name, selling),
              picture: 'https://steamcommunity-a.akamaihd.net/economy/image/class/730/' + items[b].classid + '/90fx90f',
              classid: items[b].classid,
              instanceid: items[b].instanceid,
              assetid: assets[i].assetid,
              contextid: assets[i].contextid
            };
            extras.push(itemNew);
          }
        }

      returnedItems = returnedItems.concat(extras);

    }
    callback(returnedItems);
  });
}

function dupeItemsFind(assets, itemInstance, selling){
  var items = [];
  for(var i = 0; i < assets.length; i++){
    if(assets[i].classid === itemInstance.classid && assets[i].instanceid === itemInstance.instanceid){


      console.log(item);
      items.push(item);
    }
  }

  return items;
}

function getCSGOItems(id, callback){
  console.log('http://steamcommunity.com/inventory/' + id + '/730/2');

  var options = { method: 'GET',
  url: 'http://steamcommunity.com/inventory/' + id + '/730/2',
  qs: { l: 'english', count: '5000' },
  headers:
   {'cache-control': 'no-cache' }
   };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);
    //console.log("body: " + body);
    callback(body);
  });

}


function getPrice(marketName, selling){
  if(prices[marketName] === undefined || !(prices.hasOwnProperty(marketName))){
    if(!selling){
      return 100000;
    }else{
      return 0;
    }
  }

  if(!selling){
    return Math.round((prices[marketName]*1.03) * 100) / 100;
  }
  if(prices[marketName] < .5 && selling)return 0;
  return Math.round((prices[marketName]) * 100) / 100;
}

function getPrices(){

  getPricesCSGOFast();

  var id = setInterval(function(){
    getPricesCSGOFast();
  }, 1000*60*20);

}

function getPricesCSGOFast(){

  var req = https.get('https://api.csgofast.com/price/all', (res) => {
    var body = '';

    res.on('data', function(data){
        body += data;
    });

    res.on('end', function() {
		console.log("PRICES LOADED");
      prices = JSON.parse(body);
      savePricesToFile();
    });

  }).on('error', (e) => {
    console.log("ERROR: Loading prices from file");
    loadPricesFromFile();
  });
}

function loadPricesFromFile(){
  fs.readFile("prices.txt", function(err, data){
    if(err) throw err;
    prices = JSON.parse(data);
  });
}

function savePricesToFile(){
  fs.writeFile("prices.txt", JSON.stringify(prices), function(err) {
    if(err) throw err;
  });
}


getPrices();



exports.getParsedUserItems = getParsedUserItems;
exports.getPrice = getPrice;
exports.getBotItems = getBotItems;
