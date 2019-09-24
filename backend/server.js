
///FIND BY DATE: {"date" : {$regex : ".*2017-03-08.*"}}

var exports = module.exports = {};

var express = require('express')
  , passport = require('passport')
  , util = require('util')
  , session = require('express-session')
  , SteamStrategy = require('passport-steam').Strategy
  , crypto = require('crypto')
  , morgan = require('morgan')
  , tana = require('mongoose')
  , bodyParser = require('body-parser')
  , fs = require('fs')
  , request = require('request');

var roulette = require('./games/roulette.js');

var config = require('./config/main');
var User = require('./app/models/user');

var Affiliate = require('./app/models/affiliate');
var UserSession = require('./app/models/user-session');
var app = express();
var appReq = express();

var currentlyBetting = ['']; //rate limit that mother trucker.
var currentlyWithdrawing = [''];

const httpsOpts = {
  key: fs.readFileSync('/srv/cstrike.bet/ssl/cstrike.bet.key'),
  cert: fs.readFileSync('/srv/cstrike.bet/ssl/cstrike.bet.pem')
};

let https = require('https').createServer(httpsOpts, app);
let httpsApp = require('https').createServer(httpsOpts, appReq);
https.listen(2053);
httpsApp.listen(2083);

let io = require('socket.io')(https);

var steamUtils = require('./app/steamUtils');

const opts = {
    logDirectory:'./logs/transactions', // NOTE: folder must exist and be writable...
    fileNamePattern:'trans-<DATE>.log',
    dateFormat:'YYYY.MM.DD'
};

const log = require('simple-node-logger').createRollingFileLogger( opts );

const optsBets = {
    logDirectory:'./logs/bets', // NOTE: folder must exist and be writable...
    fileNamePattern:'bets-<DATE>.log',
    dateFormat:'YYYY.MM.DD'
};

const logBets = require('simple-node-logger').createRollingFileLogger( optsBets );

const optsChat = {
    logDirectory:'./logs/chat', // NOTE: folder must exist and be writable...
    fileNamePattern:'chat-<DATE>.log',
    dateFormat:'YYYY.MM.DD'
};

const logChat = require('simple-node-logger').createRollingFileLogger( optsChat );

var clients = {};
var idToSocket = {};
var socketIdsToUserIds = {};

//Hash variables
var currentDay = 0;
var startDate;
var timeUntilHashSwitch = 0;

var apiUrl = "cstrike.bet";
var baseUrl = "cstrike.bet";

var awaitingTrades = {};
var blacklistedItems = [];

var seedsData;
var firstDay;

var mutedPlayers = [];

var betsDisabled = false;

io.on('connection', (socket) => {

  socket.on('join', (hash) => {
    joinSocket(socket, hash);
  });

  socket.on('init', () => {
    initSocket(socket);
  });

  socket.on('redeem-promo', (code) => {
    redeemPromoCode(socket, code);
  });

  socket.on("redeem-credits", () => {
    redeemPromoCredits(socket);
  });

  socket.on("set-promo", (code) => {
    setPromo(socket, code);
  });

  socket.on('disconnect', () => {
    delete clients[socket.id];
  });

  socket.on('send-message', (message) => {
    sendMessage(socket, message);
  });

  socket.on('add-bet', (ob) => {
    addBetRoulette(socket, ob);
  });

});


/**
  FUNCTIONS FOR SOCKET INTERACTIONS
*/

function joinSocket(socket, hash){
  //console.log("CONNECTED");
  if(hash === undefined) return;
   clients[socket.id] = {'hash': hash, 'socket': socket};

   getUser(hash, true, function(user){
     if(user === null || user === undefined){

       return;
     }
     var userObj = user.toObject();
     idToSocket[userObj.id] = socket.id;
     delete userObj['_id'];
     delete userObj['__v'];
     socket.emit('user-update', JSON.stringify(userObj));
     socketIdsToUserIds[socket.id] = userObj.id;

     getAffiliateById(userObj.id, function(error, affiliate){
       if(affiliate == null)return;
       socket.emit('affiliate-update', JSON.stringify(affiliate));
     });

   });
}


function initSocket(socket){
  socket.emit('bet-update', {'type': 'init', 'color': 0, data: roulette.betsToParsable(0)});
  socket.emit('bet-update', {'type': 'init', 'color': 1, data: roulette.betsToParsable(1)});
  socket.emit('bet-update', {'type': 'init', 'color': 2, data: roulette.betsToParsable(2)});

  //load in current wheel position and previous rolls
  socket.emit('wheel-pos', roulette.currentRoll());
  socket.emit('roll-history-update', {'type': 'init', 'data': roulette.rollsToParsable()});
  socket.emit('timer-pos', roulette.currentTimerPos());
}

function redeemPromoCode(socket, code){
  //console.log("RECEIVED REDEEM-PROMO");
   if(clients[socket.id] === undefined){
     socket.emit("redeem-error", {message:"ERROR: You must be logged in to get your free credits."});
     return;
   }
   //has the user already redeemed
   var id = socketIdsToUserIds[socket.id];
  //console.log("ID IS : " + id);
  //console.log(id);
   getAffiliateById(id, function(err, affiliate){
     if(affiliate == null){
      //console.log("AFFILIATE NULL ERROR");
       //WEIRD ERROR HERE
     }else{
      //console.log("NO NULL ERROR ");
       if(!affiliate.referredBy){
        //console.log("NOT CURRENTLY REFERRED");
         //NO CURRENT REFFERAL
         getAffiliateByPromo(code, function(err, user){
           if(user != null){
             //There is a promocode
             if(user.promocode == affiliate.promocode){
               socket.emit('redeem-error', {message:"ERROR: You cannot redeem your own promo code"});
               return;
             }
             //ADD THE CURRENT USER TO THE PROMO CODE CREATOR'S REFERRED LIST
             user.reffered = user.referred.push(id);

             //SET CURRENT USERS refferedBy
             affiliate.referredBy = user.id;
             //add .50 to redeemer
             affiliate.currentBalance = affiliate.currentBalance + 0.5;

             //save both accounts
             affiliate.save(function(err){
               if(err){
                 throw err;
               }
             });

             user.save(function(err){
               if(err){
                 throw err;
               }
             });

             //send update to user
             socket.emit('affiliate-update', JSON.stringify(affiliate));
             socket.emit('redeem-error', {message:" You have successfully redeemed the promo code."});

             safeUserEmit(user, 'affiliate-update', JSON.stringify(user));

           }else{
             socket.emit('redeem-error', {message:"ERROR: There is no promocode '" + code + "'"});
           }
         });
       }else{
        //console.log("CURRENTLY REFERRED");
         socket.emit('redeem-error', {message:"ERROR: You have already redeemed your free credits."});
       }

     }
   });
}

function redeemPromoCredits(socket){
  if(clients[socket.id] === undefined){
    socket.emit("redeem-error", {message:"ERROR: You must be logged in to redeem credits."});
    return;
  }

  var id = socketIdsToUserIds[socket.id];

  getAffiliateById(id, function(err, affiliate){
    if(affiliate == null){
      socket.emit('redeem-error', {message:"ERROR: An unknown error has occured."});
    }else{
      if(affiliate.currentBalance > 0){
        //get account and add balance
        retrieveUser(id, function(error, user){
          if(user == null){
            socket.emit('redeem-error', {message:"ERROR: An unknown error has occured."});
            return;
          }else{
            user.balance = user.balance + affiliate.currentBalance;
            if(user.depositedAmount >= 0){
              user.depositedAmount = user.depositedAmount + affiliate.currentBalance;
            }
            logTransaction(user.id, '______________', "REDEEMING PROMO BALANCE: " + affiliate.currentBalance + " CURRENT BALANCE: " + user.balance);
          }

          user.save(function(err){
            if(err){
              throw err;
            }
          });

          affiliate.currentBalance = 0;

          affiliate.save(function(err){
            if(err){
              throw err;
            }
          });

          socket.emit('affiliate-update', JSON.stringify(affiliate));
          socket.emit('user-update', JSON.stringify(user));
          socket.emit('redeem-error', {message:"Your affiliate balance has been added."});
        });
      }else{
        socket.emit('redeem-error', {message:"ERROR: You do not have a balance to redeem."});
      }
    }
  });

}

function setPromo(socket, code){
  if(!code){
    socket.emit("redeem-error", {message:"ERROR: You cannot set an empty promo code."});
    return;
  }
  getAffiliateByPromo(code, function(error, aff){
    if(aff != null){
      socket.emit("redeem-error", {message:"ERROR: Promo code already exists."});
    }else{
      var id = socketIdsToUserIds[socket.id];
      getAffiliateById(id, function(err, affiliate){
        if(affiliate == null){
          socket.emit('redeem-error', {message:"ERROR: An unknown error has occured."});
          return;
        }else{
          affiliate.promocode = code;
          affiliate.save(function(err){
            if(err){
              throw err;
            }
          });
          socket.emit('affiliate-update', JSON.stringify(affiliate));
          socket.emit('redeem-error', {message:" You have set your promocode."});
        }
      });
    }
  })
}

function sendMessage(socket, message){
  // //console.log("RECIEVED CHAT");
    if(clients[socket.id] === undefined){
      //console.log("SOCKET NO ADD");
      return;
    }

    var msg = message;
  // //console.log("MESSAGE: " + msg);

    var userObj = clients[socket.id]['hash'];

    getUser(userObj, false, function(user){
      if(user == null)return;
      //console.log("USER NOT NULL");
      if(msg.charAt(0) == '/'){
        var args = msg.split(" ");
        var command = args[0].substring(1);
        if(command === "send"){
          socket.emit('message-add', {message: 'Send is currently disabled.', rank: 'Server', user: 'Server', pictureUrl: user.pictureUrl, id: 'cstrike.bet'})
          return;
          /*if(args.length == 3){
            sendBalance(user, args[1], args[2], function(succ, msg){
              socket.emit('message-add', {message: msg, rank: 'Server', user: 'Server', pictureUrl: user.pictureUrl, id: 'cstrike.bet'})
            });
          }else{
            socket.emit('message-add', {message: 'Proper Syntax: /send <STEAM ID> <AMOUNT>', rank: 'Server', user: 'Server', pictureUrl: user.pictureUrl, id: 'cstrike.bet'})
          }*/

        }else if(command === "tempmute"){
          if(user.userType === 'Admin' || user.userType === 'Moderator'){
            mutedPlayers.push(args[1].replace('\n', ''));
            socket.emit('message-add', {message: args[1] + ' has been temp-muted.', rank: 'Server', user: 'Server', pictureUrl: user.pictureUrl, id: 'cstrike.bet'});
          }
        }else if(command === "chatban"){

        }else if(command === "disablebets"){
          if(user.userType === 'Admin'){
            betsDisabled = !betsDisabled;
            if(betsDisabled){
              io.emit('message-add', {message: 'New bets have been disabled in preparation for site maintenance.', rank: 'Server', user: 'Server', pictureUrl: user.pictureUrl, id: 'cstrike.bet'});
            }else{
              socket.emit('message-add', {message: 'Bets are re-enabled.', rank: 'Server', user: 'Server', pictureUrl: user.pictureUrl, id: 'cstrike.bet'});
            }
          }
        }
      }else{
        if(mutedPlayers.includes(user.id)){

        }else{
          logChat.info("[" + user.id + " | " + user.name + "] - " + msg);
          io.emit('message-add', {message: msg, rank: user.userType, user: user.name, pictureUrl: user.pictureUrl, id: user.id})
        }

      }

    });

}

function addBetRoulette(socket, ob){
    if(betsDisabled)return;
    var maxBet = 600;
    var minBet = .01;
    var color = ob.color;
    var amount = ob.bet/10;

    if(clients[socket.id] === undefined || currentlyBetting.indexOf(socket.id) !== -1){
      //console.log("SOCKET NO ADD");
      return;
    }

    currentlyBetting.push(socket.id);

    setTimeout(function(){
      currentlyBetting.splice(currentlyBetting.indexOf(socket.id), 1);
    }, 200);

    if(roulette.rolling()){
      socket.emit('error-msg',  {message: 'The betting for this round has ended.'});
      return;
    }
    var userObj = clients[socket.id]['hash'];

    getUser(userObj, false, function(user){
      if(user == null){
        return;
      }
      //console.log('user is valid');
      if(user.balance < amount){
        socket.emit('error-msg',  {message: 'You do not have enough balance to make this bet.'});
        return;
      }
      if(amount < minBet){
        socket.emit('error-msg', {message: 'You must wager more than ' + minBet*10 + ' .'});
        return;
      }
      if(amount > maxBet){
        socket.emit('error-msg', {message: 'You must wager less than ' + maxBet*10 + '.'});

        return;
      }
      var currentBet = 0;
      if(roulette.currentRouletteBets()[color].hasOwnProperty(user.id)){
       currentBet = roulette.currentRouletteBets()[color][user.id].bet;
        if(currentBet !== undefined){
          if(amount + currentBet > maxBet){
            socket.emit('error-msg', {message: 'You must bet less than ' + maxBet*10 + '.'});
            return;
          }
        }
      }

      var total = amount + currentBet;
      roulette.currentRouletteBets()[color][user.id] = {'betName': user.name, 'id': user.id, 'betPicture': user.pictureUrl, 'bet': total, 'color': color};

      user.balance = user.balance - amount;
      if(user.depositedAmount > 0){
          user.betAmount = user.betAmount + amount;
      }

      var totalBets = user.totalBets || 0;
      var totalBetBalance = user.totalBetBalance || 0;

      user.totalBets = totalBets + 1;
      user.totalBetBalance = totalBetBalance + amount;

      logTransaction(user.id, "BET", "BET ON " + roulette.intToColor(color) + ": " + total + ", CURRENT BALANCE: " + user.balance);
      user.save(function(err){
        if(err){
          throw err;
        }
      });

      if(Math.random() <= .25){
        awardReferral(user.id, amount);
      }

      var userObj = user.toObject();
      delete userObj['_id'];
      delete userObj['__v'];
      socket.emit('user-update', JSON.stringify(userObj));
      //console.log('sending user update');
      io.emit('bet-update', {'type': 'update', 'data': roulette.currentRouletteBets()[color][user.id]});
      //console.log('sending update');
    });
}

function awardReferral(id, amountBet){
  getAffiliateById(id, function(err, aff){
    if(aff == null){
     //console.log("IS NULL 1");
      return;
    }else{
      if(!aff.referredBy){
       //console.log("IS EMPTY");
        return;
      }else{
        getAffiliateById(aff.referredBy, function(error, affi){
          if(affi == null){
           //console.log("IS NULLL 2");
            return;
          }else{
           //console.log("SETTING BALANCE + " + (amountBet*.02));
            affi.currentBalance = affi.currentBalance + amountBet*.02;
            affi.save(function(err){
              if(err){
                throw err;
              }
            });

              safeUserEmit(affi, 'affiliate-update', JSON.stringify(affi));

          }
        })
      }
    }
  });
}



///AUTHENTICATION CODE BELOW

// Use body-parser to get POST requests for API use
appReq.use(bodyParser.urlencoded({ extended: false }));
appReq.use(bodyParser.json());
// Log requests to//console
appReq.use(morgan('dev'));

// Connect to database
tana.connect(config.database);

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

// Create API group routes
var apiRoutes = express.Router();
//Next, we can create our registration route:
passport.use(new SteamStrategy({
    returnURL: 'https://' + apiUrl + ':2083/api/auth/steam/return',
    realm: 'https://' + apiUrl + ':2083',
    apiKey: config.steamApiKey
  },
  function(identifier, profile, done) {
    process.nextTick(function () {
      profile.identifier = identifier;
      return done(null, profile);
    });
  }
));

appReq.use(passport.initialize());
appReq.use(passport.session());
appReq.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "https://cstrike.bet");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});


function getUser(hash, canExpire, fn){
  var userObj;
  retrieveUserSessionId(hash, canExpire, function(err, id){
      if(!session || err){
        userObj = null;
      }else{
        retrieveUser(id, function(err, user){
            if(!user || err){
              userObj = null;
            }else{
              userObj = user;

              fn(user);
            }
        });
      }
  });

  fn(userObj);
}

  function getAffiliateByPromo(promo, callback){
    Affiliate.findOne({
      promocode: promo
    },
    function(err, affiliate){
      if(err || affiliate === null){
        callback(err, null);
      }else{
        callback(err, affiliate);
      }
    });

  }

  function getAffiliateById(id, callback){
    Affiliate.findOne({
      id: id
    },
    function(err, affiliate){
      if(err || affiliate === null){
        callback(err, null);
      }else{
        callback(err, affiliate);
      }
    });

  }

  function retrieveUser(iden, callback){
    User.findOne({
      id: iden
    }, function(err, user){
      if(err || user === null){
        callback(err, null);
      }else{
        callback(err, user);
      }
    });
  }

  function retrieveUserSessionHash(iden, callback){
    UserSession.findOne({
      id: iden,
    }, function(err, session){
        if(err || session === null){
          callback(err, null);
        }else{
          var d = new Date();
          var minutes = (d.getTime() / 1000)/60;
          callback(err, session.hash);

        }
    });
  }

  function deleteUserSession(hashh){
    UserSession.findOneAndRemove({hash: hashh}, function(err){});
  }

  function retrieveUserSessionId(hashh, canExpire, callback){
    UserSession.findOne({
      hash: hashh,
    }, function(err, session){
        if(err || session === null){
          callback(err, null);
        }else{
          var d = new Date();
          var minutes = (d.getTime() / 1000)/60;
          if(session.expiresAt <= minutes && canExpire){
            deleteUserSession(hashh);
            //console.log("REMOVING USER SESSION, NEED NEW ONE");
            callback(err, null);
          }else{
            callback(err, session.id);
          }

        }
    });
  }

  function userCreate(req){
    var newUser = new User({
      id: req.user.id,
      name: req.user.displayName,
      pictureUrl: req.user._json.avatarmedium
    });

    newUser.save(function(err){
      if(err) throw err;
    });

    var newAffiliate = new Affiliate({
      id: req.user.id,
      promocode: req.user.id,
    });
    newAffiliate.save(function(err){
      if(err)throw err;
    });
  }

  function sessionCreate(req){
      var hash = crypto.createHmac('sha512', "hush");
      hash.update(req.user.id + Math.random());
      var value = hash.digest('hex');
      //console.log(value);

      var expireIn = 86400/60;

      var d = new Date();
      var minutes = (d.getTime() / 1000)/60;

      var minuteAtExpire = minutes + expireIn;

      var userSession = new UserSession({
        hash: value,
        id: req.user.id,
        expiresAt: minuteAtExpire,
        initTime: minutes
      })

      userSession.save(function(err){

      });

      return value;
    }



//ROUTES HERE

apiRoutes.post('/logout', function(req, res){
  var id = req.body.id;

  UserSession.findOne({id: iden }, function(err, session){}).remove().execute();

  req.logout();
  res.redirect('/');

});

apiRoutes.get('/auth/steam',
  passport.authenticate('steam', { failureRedirect: '/' }),
  function(req, res) {
   //console.log("GETTING REQUEST");
   //console.log(req.body);
    res.redirect('/');
  });

apiRoutes.get('/auth/steam/return', passport.authenticate('steam', { failureRedirect: '/' }),
  function(req, res) {
    hasGame(req.user.id, function(hasIt){
      if(!hasIt){
        res.cookie('auth', 'NOGAME');
        res.redirect("https://"  + baseUrl)
      }else{
        retrieveUser(req.user.id, function(err, user){
          if(err || user === null){
            userCreate(req);
          }
        });

        retrieveUserSessionHash(req.user.id, function(err, hash){
          if(!err && !(hash === null)){
            res.set({
              'Authorization': hash
            })
            res.cookie('auth', hash, {maxAge: 1000*60*60*24});
            res.redirect("https://"  + baseUrl)
          }else{
            var hashNew = sessionCreate(req);
            res.set({
              'Authorization': hashNew
            })
            res.cookie('auth', hashNew, {maxAge: 1000*60*60*24});
            res.redirect("https://"  + baseUrl)
          }
        });
      }
    });
    //console.log(req.user);

  });

  apiRoutes.post('/user/items', function(req, res){
    var hash = req.body.hash;
    var selling = req.body.selling;

    retrieveUserSessionId(hash, false, function(err, user){
      if(err || user === undefined){
        res.send("{error: 'not logged in'}");
      }else{
        steamUtils.getParsedUserItems(user, true, function(data){
          res.send({data: data});
        });
      }
    });
  });

  apiRoutes.post('/user/items', function(req, res){
    var hash = req.body.hash;
    var selling = req.body.selling;

    retrieveUserSessionId(hash, false, function(err, user){
      if(err || user === undefined){
        res.send("{error: 'not logged in'}");
      }else{
        steamUtils.getParsedUserItems(user, true, function(data){
          res.send({data: data});
        });
      }
    });
  });

  var currentWithdrawItemRequests = 0;


  apiRoutes.post('/server/withdrawitems', function(req, res){
    currentWithdrawItemRequests = currentWithdrawItemRequests + 1;
    setTimeout(function(){
      getBotItems(function(data){
        res.send({data});
        currentWithdrawItemRequests = currentWithdrawItemRequests - 1;
      });
    }, 100*currentWithdrawItemRequests + 1);

  });

  function hasGame(steamid, callback){
    var options = { method: 'GET',
       url: 'http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=022353F270F1C5B92C4E724AF6F61861&steamid=' + steamid + '&format=json',
       headers:
        {
          'cache-control': 'no-cache' },
        };

       request(options, function (error, response, body) {
         if (error) throw new Error(error);
           var data;
           try{
             data = JSON.parse(body)['response']['games'];
             //console.log(data);
           }catch(err){
             callback(false);
             return;
           }
           if(data == undefined){
             callback(false);
             return;
           }

           var hasGame = false;
           for(var i = 0; i < data.length; i++){
             if(data[i].appid == '730'){
               hasGame = true;
               break;
             }
           }

           //console.log(steamid + " USER HAS THE GAME: " + hasGame);
           callback(hasGame);
       });
  }


  function getBotItems(callback){
     var options = { method: 'GET',
        url: 'https://cstrike.bet:2096/getBotItems',
        headers:
         {
           'cache-control': 'no-cache' },
         };

        request(options, function (error, response, body) {
          if (error) throw new Error(error);
            var data;
            try{
              data = JSON.parse(body).data;
            }catch(err){
              callback(null);
              return;
            }

            data = parseItemData(data);
            //console.log(data);
            data = data.filter( function( el ) {
              return blacklistedItems.indexOf( el ) < 0;
            });
            //console.log(data);
            callback(data);
        });
  }

  //FOR WITHDRAW
  function parseItemData(data){
    var items = [];
    data = JSON.parse(data);
    for(var i = 0; i < data.length; i++){
      var name = data[i].market_name;
      var itemNew = {
        name: name,
        price: steamUtils.getPrice(name, false),
        picture: 'https://steamcommunity-a.akamaihd.net/economy/image/class/730/' + data[i].classid + '/90fx90f',
        classid: data[i].classid,
        instanceid: data[i].instanceid,
        assetid: data[i].assetid,
        contextid: data[i].contextid
      };
      items.push(itemNew);
    }

    return items;
  }




  apiRoutes.post('/user/tradeurl/save', function(req, res){
   //console.log("RECEIVED TRADEURL SAVE");
    var url = req.body.url;
    var hash = req.body.hash;

    retrieveUserSessionId(hash, false, function(err, id){
      if(err || id === undefined){
        res.send("{error: 'not logged in'}");
      }else{
        retrieveUser(id, function(err, user){
          if(err || user === undefined || user === null){
            res.send("{error: 'can't find user}");
          }else{
            user.tradeUrl = url;
            user.save(function(err){});
          }
        });
      }
    });
  });

apiRoutes.post('/server/deposit', function(req, res){
 //console.log("GETTING DEPOSIT");
  var hash = req.body.hash;
  var selling = true;
  var items = req.body.items;
  var totalPrice = 0;

  for(var i = 0; i < items.length; i++){
    totalPrice += steamUtils.getPrice(items[i].name, true);
  }

  retrieveUserSessionId(hash, false, function(err, id){
    if(err || id === undefined){
     //console.log("NOT LOGGED IN ");
      res.send("{error: 'not logged in'}");
    }else{
      retrieveUser(id, function(err, user){
        if(err || user === null){
         //console.log("USER IS NULL");
          res.send("{error: 'get user error'}");
        }else{
          if(user.tradeUrl === ""){
           //console.log("NO TRADE URL");
            res.send('{error: "no trade url"}');
            return;
          }

         //console.log("ITEMS: "  + JSON.stringify(items));
          var hash = crypto.createHash('sha256').update(hash + items + totalPrice + (new Date()).toString()).digest('base64');
          logTransaction(user.id, hash, "STARTED DEPOSIT, TOTAL WORTH: " + totalPrice + " CURRENT BALANCE: " + user.balance);
          var options = {
            method: 'POST',
            url: 'https://cstrike.bet:2096/initdeposit',
            headers: {
               'cache-control': 'no-cache',
               'content-type': 'application/x-www-form-urlencoded' },
            form:
             { tradeHash: hash,
               items: JSON.stringify(items),
               steam64: user.id,
               tradeUrl: user.tradeUrl
             } };

          request(options, function (error, response, body) {
            if(!err){
              awaitingTrades[hash] = {"depositAmount": totalPrice, "userId": user.id, "tradeType": "deposit"};

             //console.log("REQUEST RECIEVED");
              res.send(JSON.stringify(body));
            }
          });
        }
      });
    }
  });
});

function getWithdrawableCredits(user){
  if(user === null || user === undefined)return 0;
  if(user.withdrawBanned)return 0;
  if(user.depositedAmount.depositedAmount < 0)return 0;
    var betAmount = user.betAmount*1.25;
    if(betAmount > user.depositedAmount){
      return user.balance;
    }else{
      if(betAmount > user.balance){
        return user.balance;
      }else{
        return betAmount;
      }
    }
}

var withdrawLimiting = 0;


apiRoutes.post('/server/withdraw', function(req, res){
 //console.log("GETTING WITHDRAWL");
 withdrawLimiting = withdrawLimiting + 1;
  setTimeout(function(){
    initWithdraw(req, res);
    withdrawLimiting = withdrawLimiting - 1;
  }, 300);
});

function initWithdraw(req, res){
  var hash = req.body.hash;
  var selling = false;
  var items = req.body.items;
  var totalPrice = 0;

  if(currentlyWithdrawing.indexOf(hash) !== -1){
    res.send({'tradeHash': 'Already open in a trade!', 'tradeUrls': ['']});
    return;
  }

  currentlyWithdrawing.push(hash);

  setTimeout(function(){
    currentlyWithdrawing.splice(currentlyWithdrawing.indexOf(hash), 1);
  }, 10000);

  var itemNames = [];

  for(var i = 0; i < items.length; i++){
    totalPrice += steamUtils.getPrice(items[i].name, false);
    itemNames.push(items[i].name);
  }

  retrieveUserSessionId(hash, false, function(err, id){
    if(err || id === undefined){
     //console.log("NOT LOGGED IN ");
      res.send("{error: 'not logged in'}");
    }else{
      retrieveUser(id, function(err, user){
        if(err || user === null){
         //console.log("USER IS NULL");
          res.send("{error: 'get user error'}");
        }else{
          if(user.tradeUrl === ""){
           //console.log("NO TRADE URL");
            res.send('{error: "no trade url"}');
            return;
          }
          if(getWithdrawableCredits(user) < totalPrice){
           //console.log("NOT ENOUGH MONEY");
            res.send('{error: "not enough money"}');
            return;
          }
            user.balance -= totalPrice;
            var totalWithdrawn = user.totalWithdrawn || 0;
            user.totalWithdrawn = totalWithdrawn + totalPrice;
            user.save(function(err){
            });
            sendUserStateUpdate(user);

           //console.log("ITEMS: "  + JSON.stringify(items));
            var hash = crypto.createHash('sha256').update(hash + items + totalPrice + (new Date()).toString()).digest('base64');
            logTransaction(user.id, hash, "STARTED WITHDRAWAL, AMOUNT TAKEN: " + totalPrice + " CURRENT BALANCE: " + user.balance);
            logTransaction(user.id, hash, "WITHDRAW ITEMS: " + itemNames);
            var options = {
              method: 'POST',
              url: 'https://cstrike.bet:2096/initwithdraw',
              headers: {
                 'cache-control': 'no-cache',
                 'content-type': 'application/x-www-form-urlencoded' },
              form:
               { tradeHash: hash,
                 items: JSON.stringify(items),
                 steam64: user.id,
                 tradeUrl: user.tradeUrl
               } };

            blacklistedItems.concat(items);
            request(options, function (error, response, body) {
              if(!err){
                awaitingTrades[hash] = {"depositAmount": totalPrice, "userId": user.id, "tradeType": "withdraw"};
               //console.log("REQUEST RECIEVED");
                blacklistedItems = blacklistedItems.filter( function( el ) {
                  return items.indexOf( el ) < 0;
                });
                res.send(JSON.stringify(body));
              }
            });
        }
      });
    }
  });
}

apiRoutes.post('/server/tradecompleted', function(req, res){
   //console.log(JSON.stringify(req.body));
   //console.log(JSON.stringify(awaitingTrades));
    var tradeHash = req.body.tradeHash;
    if(tradeHash === undefined)return;
   //console.log("tradeHash is not undefined");
    if(awaitingTrades[tradeHash] === undefined){
     //console.log("AWAITING TRADES IS UNDEFINED ");
      return;
    }
    var rewardAmount = awaitingTrades[tradeHash].depositAmount;
    var id = awaitingTrades[tradeHash].userId;
    var success = req.body.success;
    var tradeType = awaitingTrades[tradeHash].tradeType;

   console.log(success + " " + tradeType);

    if((success === 'true') && tradeType === "deposit"){
     //console.log("SUCCESSFUL DEPOSIT");
      retrieveUser(id, function(err, user){
        if(!err){

          if(user.depositedAmount < 0){
            //console.log("DEPOSITED AMOUNT LESS THAN 0");
            if((user.depositedAmount + rewardAmount) >= 0){
              //console.log("DEPOSITED AMOUNT + REWARD AMOUNT IS GREATER THAN OR EQUAL TO 0");
              user.depositedAmount = user.depositedAmount + rewardAmount + 5;
            //  console.log("NEW DEPOSITED AMOUNT IS : " + user.depositedAmount);
              var balTemp = rewardAmount*2; //Can only have 2x the initial deposit amount, no more. Prevent people frmo getting lots of cash before depositing.
            //  console.log("BAL TEMP: " + balTemp);
              if(balTemp > user.balance){
              //  console.log("TEMP BALANCE GREATER THAN BALANCE");
                if((rewardAmount + user.balance) < balTemp){
                //  console.log("REWARD + BALANCE IS LESS THAN TEMP BALANCE");
                  balTemp = rewardAmount + user.balance;
                }

              }
              //console.log("TEMP BALANCE: " + balTemp);
              user.balance = balTemp;
              user.balance -= rewardAmount;
            //  console.log("FINAL BALANCE: " + user.balance);
            }else{
              user.depositedAmount = user.depositedAmount + rewardAmount;
            }
          }else{
            user.depositedAmount = user.depositedAmount + rewardAmount;
          }

          user.balance += rewardAmount;
          var totalDeposited = user.totalDeposited || 0;
          user.totalDeposited = totalDeposited + rewardAmount;

          logTransaction(user.id, tradeHash, "SUCCESSFUL DEPOSIT, AWARDED: " + rewardAmount + " CURRENT BALANCE: " + user.balance);
          user.save(function(err){});
          sendUserStateUpdate(user);
        }
      });
    }else if((success === 'false') && tradeType === "withdraw"){
     //console.log("CANCELLED WITHDRAWAL");
      retrieveUser(id, function(err, user){
        if(!err){
          user.balance += rewardAmount;
          logTransaction(user.id, tradeHash, "CANCELLED WITHDRAWAL, REFUNDED: " + rewardAmount + " CURRENT BALANCE: " + user.balance);
          user.save(function(err){});
          sendUserStateUpdate(user);
        }
      });
    }else if((success === 'true') && tradeType === 'withdraw'){
     //console.log("WITHDRAW COMPLETED ");
      retrieveUser(id, function(err, user){
        if(!err){
          user.betAmount = user.betAmount - (rewardAmount/1.25);
          if(user.betAmount < 0){
            user.betAmount = 0;
          }
          user.depositedAmount = user.depositedAmount - (rewardAmount/1.25);
          if(user.depositedAmount < 0 || user.betAmount == 0){
            user.depositedAmount = 0;
          }
          logTransaction(user.id, tradeHash, "COMPLETED WITHDRAWAL. CURRENT BALANCE: " + user.balance);
          user.save(function(err){});
          sendUserStateUpdate(user);
        }
      });


    }

    delete awaitingTrades[tradeHash];


});



apiRoutes.post('/server/validation/roll', function(req, res){
  var rollNum = req.body.roll;
  roulette.getRoundData(rollNum, function(data){
    res.send(JSON.stringify(data));
  });
});

apiRoutes.post('/server/tradestatus', function(req, res){
  var tradeHash = req.body.tradeHash;
 //console.log("STATUS RECEIVED");
  if(tradeHash === undefined)return;
 //console.log("IS TRADEHASH");
  if(awaitingTrades[tradeHash] === undefined)return;
 //console.log("IS AWAITING TRADE");
  var id = awaitingTrades[tradeHash].userId;
  var status = req.body.status;
  var statusType = req.body.statusType;
  var tradeType = req.body.tradeType;

  if(tradeType === "deposit"){
    if(statusType === "error"){
      if(status === "escrow"){
        safeUserEmit(user, 'trade-error', 'Your account has a trade hold.');
        logTransaction(id, tradeHash, "CANCELLED, ACCOUNT HAS TRADEHOLD");
        delete awaitingTrades[tradeHash];
      }else if(status  === "no items"){
        safeUserEmit(user, 'trade-error', 'You no longer have the items you chose to deposit.');
        logTransaction(id, tradeHash, "CANCELLED, ACCOUNT DOES NOT HAVE ITEMS TO DEPOSIT");
        delete awaitingTrades[tradeHash];
      }else if(status  === "not accepted"){
        safeUserEmit(user, 'trade-error', "You didn't accept the offer");
        logTransaction(id, tradeHash, "CANCELLED, DEPOSIT EXPIRED");
        delete awaitingTrades[tradeHash];
      }
    }
  }else{
    if(statusType === "error"){
      if(status === "escrow"){
        safeUserEmit(user, 'trade-error', 'Your account has a trade hold.');
        delete awaitingTrades[tradeHash];
      }else{

      }
    }else{
      if(status === "withdraw init"){
        //unblacklist items, they've been put into a trade offer
        blacklistedItems = blaclistedItems.filter( function( el ) {
          return blacklistedItems.indexOf( el ) < 0;
        });
      }else if(status === "cancelled"){
        //need to give back monies

      }
    }
  }

});

function safeUserEmit(user, title, message){
  if(idToSocket[user.id] !== undefined){
    var i = idToSocket[user.id];

    if(clients[i] === undefined){
      return;
    }

    clients[idToSocket[user.id]]['socket'].emit(title, message);
  }
}

function sendUserStateUpdate(user){
  safeUserEmit(user, 'user-update', JSON.stringify(user));
}


appReq.get('/', function(req, res) {
  res.send('Go away, please.');
});


appReq.use('/api', apiRoutes);


//utils

function logTransaction(user, hash, message){
  var msg = "[HASH: " + hash + "|USER: " + user + "]" + message;

  if(hash === "BET"){
    logBets.info(msg);
  }else{
    log.info(msg);
  }
}

function hexdec(hexString){
  hexString = (hexString + '').replace(/[^a-f0-9]/gi, '')
  return parseInt(hexString, 16);
}

function numValue(str){
    var hash = 0;
    if (str.length == 0) return hash;
    for (i = 0; i < str.length; i++) {
        char = str.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}


function generateHashes(amount){
  var hashes = {};
  var initHash = crypto.createHash('sha512').update(config.hashSecret).digest('base64');
  hashes[amount - 1] = initHash;
  for(var i = 0; i < (amount-1); i++){
    var newHash = hashes[amount - i - 1];
    //console.log(newHash);
    newHash = crypto.createHash('sha512').update(newHash).digest('base64') + config.hashSalt;
    newHash = crypto.createHash('sha512').update(newHash).digest('base64');
    hashes[amount - i - 2] = newHash;
  }
  ////console.log(Object.keys(hashes).length);

  ////console.log(hashes);
  fs.writeFile("seeds.json", JSON.stringify(hashes), function(err) {
    if(err) {
        return //console.log(err);
    }
    ////console.log("The file was saved!");
  });
}

function getDayOfRound(firstDay, roll){
  //console.log(JSON.stringify(roll));
//  console.log(firstDay);
  var roundDate = -1;
  roundDate = daydiff(firstDay, new Date(roll.date));
  return roundDate;
}

function getCurrentSeed(){
  return seedsData[currentDay];
}

//return to display
function getSeeds(){
  var arr = [];
  var seedsData = fs.readFileSync('./seeds.json');
  for(var i = 0; i < currentDay; i++){
    arr[i] = seedsData[i];
  }
}

function parseDate(str) {
    var mdy = str.split('/');
    return new Date(mdy[2], mdy[0]-1, mdy[1]);
}

function daydiff(first, second) {
    return Math.round((second-first)/(1000*60*60*24));
}

function loadSeedData(){
  seedsData = JSON.parse(fs.readFileSync('./seeds.json'));
}

loadSeedData();

function startGames(){
   roulette.createFakeUsers();
   roulette.initGame();
}

exports.getDayOfRound = getDayOfRound;
exports.logTransaction = logTransaction;
exports.retrieveUser = retrieveUser;
exports.sendUserStateUpdate = sendUserStateUpdate;
exports.daydiff = daydiff;
exports.parseDate = parseDate;
exports.numValue = numValue;
exports.getCurrentSeed = getCurrentSeed;
exports.betsDisabled = function(){
  return betsDisabled;
};
exports.io = function(){
  return io;
};
exports.seedsData = function(){
  return seedsData;
};

startGames();
