
gameLimit = 20;
minimumBal = 1;
maxBal = 50;

currentGames = [];

/**
*/

/**
{ gameId: 0,
  red:{
    user: 13041240213401,
    betAmount: 12
  },
  black: {
    user: 32199240213401,
    betAmount: 14}
}
*/


/**
Start a new match, check to see it isn't over game limit. Check minimum balance and max balance.
Check user balance as well.
If all checks out, take from user balance, then add game into queue.
Params: user, amount, team
*/
function startMatch(){

}

/**
Check if match exists.
Can only join a match with enough money to bet
Take away balance and join other team
Params: gameId, user, amount
When match added, send start game.. Then countdown 5 then send calculated result.
*/

function joinMatch(){

}

/**
Calculate the winning side from gameId and hash.
Wait x SECONDS BEFORE sending reward to winner
*/

function calculateMatchResult(gameId){

}
