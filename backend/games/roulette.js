
var Roll = require('../app/models/roll');

var exports = module.exports = {};

var server = require('../server.js');
var crypto = require('crypto');
var request = require('request');
var fs = require('fs');

//Game variables
var currentRouletteBets = {0: {}, 1: {}, 2: {}};
var rolling = false;
var currentRound = 0;
var currentRoll = 0;
var previousRolls = {};
var currentTimerPos = 0;
var timeUntilHashSwitch = 0;

var seedsData;


function betsToParsable(color){
  var dic = currentRouletteBets[color];
  var retur = [];
  for(var key in dic){
    retur.push(dic[key]);
  }
  return retur;
}

function rollsToParsable(){
  var dic = previousRolls;
  var retur = [];
  for(var key in dic){
    if(parseInt(key) >= currentRound-1-11){
      retur.push(JSON.stringify(dic[key]));
    }
  }
  //console.log(retur);
  if(retur.length > 11){
    retur.splice(0, 1);
  }
  //console.log(retur);
  //console.log("ROLLS: " + retur);
  return retur;
}

function getPreviousRolls(callback){
  var rounds = [];
  for(var i = 1; i < 12; i++){
    if(i < 0)return;
    rounds.push(currentRound - i + 1);
  }

  //console.log(currentRound);

   Roll.find()
   .where('round')
   .in(rounds)
   .exec(function (err, docs) {
     if(err || docs === undefined){
       callback(err, null);
     }else{
       callback(err, docs);
     }
 });
}

/**
TODO: Import getDayOfRound()
*/

function getRoundData(roundd, callback){

  Roll.findOne({round: roundd}).exec(function(err, roll){
    if(!err && roll !== null){
      if(roll !== undefined){
        var day = server.getDayOfRound(roll);
        var hash = "";
        var date = new Date(roll.date).toUTCString();
        if(day === currentDay){
          hash = "Today's Hash isn't released until tomorrow.";
          callback({"round": roundd, "result": roll.winningNumber, "date": date, "hash": hash});
          return;
        }else{
          hash = seedsData[day];
          callback({"success": true, "round": roundd, "result": roll.winningNumber, "date": date, "hash": hash});
          return;
        }
      }else{
        callback({"success": false, "error": "Roll not found"});
        return;
      }
    }
     callback("error");
  });
}

/**
 TODO: import io, logTransaction, retrieveUser, sendUserStateUpdate
*/

function rewardPlayers(){
  var color;
  var multiplier = 0;
  if(currentRoll === 0){
    color = 1;
    multiplier = 14;
  }else if(currentRoll <= 7){
    color = 0;
    multiplier = 2
  }else{
    color = 2;
    multiplier = 2;
  }
  server.logTransaction("SERVER", "BET", "ROUND END. WINNER: " + intToColor(color) + "\n");
  var toReward = currentRouletteBets[color];
  currentRouletteBets = {0: {}, 1: {}, 2: {}};
  for (var id in toReward) {
    if(id.startsWith('fufl'))continue;
      if (toReward.hasOwnProperty(id)) {
        server.retrieveUser(id, function(err, user){
          if(!err && user !== null){
            var bet = toReward[user.id].bet;
            user.balance += bet*multiplier;
            server.logTransaction(user.id, "BET", intToColor(color) + " WON. REWARD: " + multiplier + " x " + bet +  " = " + bet*multiplier + ", CURRENT BALANCE: " + user.balance);
            server.sendUserStateUpdate(user);
            user.save(function(err){
              if(err) throw err;
            });
          }

        });
      }
  }



  //SEND REWARD ANIMATION TO ALL CLIENTS: ON OTHER END ANIMATE + CLEAR BET TABLES
  server.io().emit('roll-result-end', color);
  //console.log("resetting animations");
}

function initGame(){

  var timer = 20;
  var rollTime = 6;
  //console.log("init game");
  loadGameState(timer, rollTime);



}

function callRoll(rollTime){
  //UPDATE VARIABLES
  var result = getResult(currentRound);
  currentRound++;
  currentRoll = result;

  //SEND RESULT TO CLIENT SO IT CAN SPIN
  server.io().emit('roll-result', result);
 //console.log("rolled to: " + result);
  //reward winners
  setTimeout(function(){
    rewardPlayers();
    //console.log("rewarding players");
    var date = new Date();
    server.io().emit('roll-history-update', {'type': 'update', data: {'round': currentRound, 'winningNumber': currentRoll, 'date': date}});

    appendPreviousRolls();
    rolling = false;
  }, (rollTime+1)*1000);
}

function callTimer(timerLength, rollTime){
  //call the timer, then call the roll after interval
  server.logTransaction("SERVER", "BET", "BETS OPENING FOR ROUND: " + (currentRound+1) + "\n");
  //useFakeUsers();
  //SEND START TIMER UPDATE
  server.io().emit('timer-start', timerLength);
  ////console.log("starting timer");
  var timeInc = timerLength;
  currentTimerPos = 1;
  var t = setInterval(function(){
    timeInc-= .05;
    currentTimerPos = timeInc/timerLength;
    if(timeInc <= 0){
      clearInterval(t);
    }
  }, 50);

  setTimeout(function(){
    server.logTransaction("SERVER", "BET", "BETS CLOSING FOR ROUND: " + (currentRound+1) + "\n");
    rolling = true;
    callRoll(rollTime);
    //console.log("rolling wheel");
  }, (timerLength)*1000);
}

function intToColor(int){
  if(int === 1){
    return "GREEN";
  }else if(int === 0){
    return "RED";
  }else{
    return "BLACK";
  }
}


function appendPreviousRolls(){
  var curIndex = currentRound-1;
  var datee = new Date().toISOString();
  previousRolls[curIndex] = {'round': currentRound, 'winningNumber': currentRoll, 'date': datee};

  var roll = new Roll({
    round: currentRound,
    winningNumber: currentRoll,
    date: datee,
  });

  roll.save(function(err){});


}

/**
TODO: Import daydiff, parseDate
*/

function loadGameState(timer, rollTime){

  seedsData = server.seedsData();

  var roundData = fs.readFileSync('./rounds.json');
  //var betsData = fs.readFileSync('./bets.json');
  roundData = JSON.parse(roundData);

  currentRound = 0;
  firstDay = server.parseDate(roundData.startDate);
  currentDay = server.daydiff(firstDay, new Date());
 //console.log("CURRENT DAY: " + currentDay);
  startDate = roundData.startDate;
  //currentRouletteBets = betsData;

  var daySchedule = setInterval(function(){
    currentDay = server.daydiff(server.parseDate(roundData.startDate), new Date());
  }, 1000*60*10);

  previousRolls = {};

  Roll.find().sort({'_id': -1}).limit(1).exec(function(err, roll){
    if(!err && roll !== null){
      if(roll[0] !== undefined){
        currentRound = roll[0].round;
      }


      //only start game timer once current round is established
      callTimer(timer, rollTime);
      var interval = setInterval(function(){
        callTimer(timer, rollTime);
      }, (timer+rollTime + 2.5)*1000);

      getPreviousRolls(function(err, docs){
        if(docs !== null){
          for(var i = 0; i < docs.length; i++){
            previousRolls[docs[i].round] = {'round': docs[i].round, 'winningNumber': docs[i].winningNumber, 'date': docs[i].date};
          }
        }
      });

    }
  })



  if(previousRolls[currentRound-1] !== undefined){
    currentRoll = previousRolls[currentRound - 1]['winningNumber'];
  }

}


/**
TODO: Import numValue, getCurrentSeed from server.js
*/

function getResult(round){
  var digest = crypto.createHash('sha512').update(server.getCurrentSeed() + '-' + round).digest('base64').substring(7, 16);
  //var hex = hexdec(digest);
  var num = server.numValue(digest);
  return Math.abs(num) % 15;
}

























/**
Create fake users to test other functions of side while not actually providing public access
*/

var fakeUsers = [];

function createFakeUsers(){
  var ids = ['76561198156467933', '76561198327189815', '76561198056069524',
  '76561198066397136', '76561197962205508', '76561198002842767', '76561198009976128',
  '76561198039034565', '76561197961138369', '76561197968580172', '76561197972610431',
  '76561197973993275', '76561197982191000', '76561197987512835', '76561197994688490',
  '76561198020971922','76561198044199652','76561198058267264','76561198004368334',
  '76561198020780789','76561198026023266','76561198038395481','76561198066252106',
  '76561198068875695','76561198073520074','76561198074653341','76561198080448027',
  '76561198092509897','76561198113355872','76561198117601176','76561198133199173',
  '76561198104033323', '76561198019511423', '76561198041240354', '76561198116832382',
  '76561198133681762', '76561198039295338', '76561198089555722', '76561198092052278',
  '76561198092052278', '76561198104033323', '76561198108373119', '76561198125830076',
  '76561198022421368', '76561198031802064', '76561198039527523', '76561198041200042',
  '76561198063154588', '76561198159696623', '76561197968052997', '76561197972541220',
  '76561197991125112', '76561197997666269', '76561198014573933', '76561198195757787',
  '76561198039303835', '76561198102316056', '76561198139205779', '76561198161631512',
  '76561198283203128', '76561198106543893'] //need atleast 62

  var requestUrl =  `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=022353F270F1C5B92C4E724AF6F61861&steamids=76561198156467933,76561198327189815,76561198056069524,76541198063397136,76561197962205508,
  76561198002842767,76561198009976128,76561198039034565,76561197961138369,76561197968580172,76561197972610431,76561197973993275,76561197982191000,76561197987512835,76561197994688490,76561198020971922,76561198044199652,76561198058267264,
  76561198004368334,76561198020780789,76561198026023266,76561198038395481,76561198066252106,76561198068875695,76561198073520074,76561198074653341,76561198080448027,76561198092509897,76561198113355872,76561198117601176,76561198133199173,
  76561198104033323,76561198019511423,76561198041240354,76561198116832382,76561198133681762,76561198039295338,76561198089555722,76561198092052278,76561198092052278,76561198104033323,76561198108373119,76561198125830076,76561198022421368,
  76561198031802064,76561198039527523,76561198041200042,76561198063154588,76561198159696623,76561197968052997,76561197972541220,76561197991125112,76561197997666269,76561198014573933,76561198195757787,76561198039303835,76561198102316056,
  76561198139205779,76561198161631512,76561198283203128,76561198106543893`;

  var options = {
    method: 'GET',
    url: requestUrl,
    headers: {
       'cache-control': 'no-cache',
       'content-type': 'application/x-www-form-urlencoded' },
    };

     request(options, function (error, response, body) {
       if (error) throw new Error(error);
         var data;
         try{
           data = JSON.parse(body);
           //console.log(data);
         }catch(err){
           return;
         }
         loadFakeUsers(data);
     });


}

function loadFakeUsers(data){
  if(data.response.players){
    var players = data.response.players;

    for(var key in players){
      var player = players[key];

      var bal = (Math.random() * 75 + 1).toFixed(1);

      var storedPlayer = {
        name: player.personaname,
        steamid: player.steamid,
        avatar: player.avatarmedium,
        balance: bal
      }

      fakeUsers.push(storedPlayer);
    }
  }
}

/**
TODO: import betsDisabled
*/

function useFakeUsers(){
  if(server.betsDisabled())return;
  if(fakeUsers){
    if(Math.random() <= .98){
      //Determine how many 1-5;
      var playerAmount = Math.floor(Math.random() * (10)) + 1;
      var startIndexPlayer = getFakeUserIndex();
      //for each do a bet
      for(var i = startIndexPlayer; i < (startIndexPlayer+playerAmount); i++){
        doFakeBet(i);
      }
    }
  }

}

function getFakeUserIndex(){
  //getTime in Seconds
  var dt = new Date();
  var secs = dt.getSeconds() + (60 * (dt.getMinutes() + (60 * dt.getHours())));

  var group = Math.floor(secs/17280);

  return group*10;
}


function doFakeBet(index){

  setTimeout(function(){
    var fakeUser = fakeUsers[index];


    var betAmount = (.057*fakeUser.balance*1).toFixed(2);
    if(betAmount < .1){
      fakeUsers[index].balance = (fakeUsers[index].balance*1 + 10*1);
      return;
    }

    if(betAmount > 40){
      betAmount = 15 + 15*Math.random();
    }
	
    var color = 0;

    if(Math.random() <= .85){
      if(Math.random() <= .57){
        color = 0;
      }else{
        color = 2;
      }
      if(Math.random() <= .15){
        fakeUsers[index].balance = (fakeUsers[index].balance*1 + betAmount*1);
      }else{
        fakeUsers[index].balance = (fakeUsers[index].balance*1 - betAmount*1);
      }
    }else{
      color = 1;
      betAmount = (betAmount*.35*Math.random()).toFixed(2);
      if(Math.random() > 0.015){
        fakeUsers[index].balance = (fakeUsers[index].balance*1 + betAmount*13*1);
      }else{
        fakeUsers[index].balance = (fakeUsers[index].balance*1 - betAmount*1);
      }
    }
	
    if(!isNaN(betAmount)){
      var fakeBetData = {'betName': fakeUsers[index].name, 'id': fakeUsers[index].steamid, 'betPicture': fakeUsers[index].avatar, 'bet': betAmount, 'color': color};
      currentRouletteBets[color]['fufl' + fakeUsers[index].steamid] = fakeBetData;
      server.io().emit('bet-update', {'type': 'update', 'data': fakeBetData});
    

  }, 1000*Math.random()*18);

}



exports.betsToParsable = betsToParsable;
exports.rollsToParsable = rollsToParsable;
exports.currentRoll = function(){
  return currentRoll;
};
exports.currentTimerPos = function(){
  return currentTimerPos;
};
exports.getRoundData = getRoundData;
exports.initGame = initGame;
exports.createFakeUsers = createFakeUsers;
exports.rolling = function(){
  return rolling;
};
exports.intToColor = intToColor;
exports.currentRouletteBets = function(){
  return currentRouletteBets;
}
