import { Component, Input, trigger, state, style, transition, animate, OnInit } from '@angular/core';
import { AppComponent } from './app.component';
import { User } from './user';


import { RouletteRoll} from './roulette-roll';
import { RouletteGameService } from './roulette-game.service';
import { RouletteBet } from './roulette-bet';
import { UserService } from './user.service';

import {NgbModal, NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import { RollModalContent } from './roll-modal.component';


@Component({
  selector: 'my-roulette',
  templateUrl: `../assets/html/roulette.component.html`,
  styleUrls: ['../assets/css/roulette.component.css'],
  animations: [
    trigger('historyIn',[
      state('in', style({transform: 'translateX(0)'})),
      transition('void => *', [
        style({transform: 'translateX(-100%)'}),
        animate(200)
      ]),

    ]),
    trigger('betIn',[
      state('in', style({opacity: 1})),
      transition('void => *', [
        style({opacity: 0}),
        animate(1000)
      ]),

    ]),
  ],
})

export class RouletteComponent implements OnInit {

    rollIn = 20;
    currentPosition = 0;
    currentBet = 0;
    maxBetAmount = 6000;
    minBetAmount = .1;
    rolling = false;
    muted = false;

    connectionUser;
    connectionBets;

    connectionRollPos;
    connectionTimerPos;
    connectionRollHistory;
    connectionTimerStart;
    connectionRouletteRoll;
    connectionRewardInit;

    disabledColors: number[] = [4, 5, 6];

    nums: number[] = [1, 14, 2, 13, 3, 12, 4, 0, 11, 5, 10, 6, 9, 7, 8]
    wheels: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    user:User={id:'-1',name:'-', tradeUrl: '', pictureUrl:'filler',balance:1000,rouletteHistory:null,depositedAmount:0,betAmount:0,userType:'User','withdrawBanned': false, 'totalDeposited': 0, 'totalWithdrawn': 0, 'totalBets': 0, "totalBetBalance": 0};

    blankUser:User={id:'-1',name:'-', tradeUrl: '', pictureUrl:'',balance:1000,rouletteHistory:null,depositedAmount:0,betAmount:0,userType:'User','withdrawBanned': false, 'totalDeposited': 0, 'totalWithdrawn': 0, 'totalBets': 0, "totalBetBalance": 0}

    redBets: RouletteBet[] = [];

    greenBets: RouletteBet[] = [];

    blackBets: RouletteBet[] = [];

    previousRolls: RouletteRoll[] = [];

    inited = false;

    wheelsHolder;
    rollsElem;
    barElem;
    timeElem;


    constructor(private gameService: RouletteGameService, public modalService: NgbModal, private userService: UserService) {};


    ngOnInit(): void {
      if(!this.inited){
        this.previousRolls = [];

        this.initSockets();
        this.inited = true;
        this.wheelsHolder = document.getElementById("wheelsHolder");
        this.rollsElem = document.getElementById("rolls");
        this.barElem = document.getElementById("bar");
        this.timeElem = document.getElementById("time");
      }

    }



    ngOnDestroy() {
      ////console.log("DESTROYING");
      this.connectionUser.unsubscribe();
      this.connectionBets.unsubscribe();
      this.connectionRollPos.unsubscribe();
      this.connectionTimerPos.unsubscribe();
      this.connectionRollHistory.unsubscribe();
      this.connectionTimerStart.unsubscribe();
      this.connectionRouletteRoll.unsubscribe();
      this.connectionRewardInit.unsubscribe();
      this.inited = false;
    }

    initSockets() {
      this.connectionUser = this.userService.getUser().subscribe(data => {
        this.user = JSON.parse(data.toString());
      });

      this.connectionBets = this.userService.getBets().subscribe(data => {
        if(data['type'] === 'init'){
          var color = data['color'];

          var bets: RouletteBet[];
          if(color == 0){
            this.redBets = data['data'] as RouletteBet[];
          }else if(color == 1){
            this.greenBets = data['data'] as RouletteBet[];
          }else{
            this.blackBets = data['data'] as RouletteBet[];
          }

        }else{
          var bet = data['data'] as RouletteBet;
          this.betUpdate(bet);
        }

      });
      this.userService.init();

      this.connectionRollPos = this.gameService.getInitWheelPosition().subscribe(data => {
        //this.currentPosition = parseInt(data.toString());
        this.spinToNumber(parseInt(data.toString()), true);
        //console.log("INITIAL WHEEL POSITION: " + data.toString());
      });

      this.connectionTimerPos = this.gameService.getInitTimerPosition().subscribe(data => {
        //console.log("INITIAL TIMER POSITION " + data.toString());
        this.countdown(this.rollIn, parseFloat(data.toString()));
      });

      this.connectionRollHistory = this.gameService.getPreviousRolls().subscribe(data => {
        if(data['type'] === 'init'){
          var rolls = data['data'];
          for(var i = 0; i < rolls.length; i++){
            var roll = JSON.parse(rolls[i]);
            roll = roll as RouletteRoll;
            this.previousRolls.push(roll);
          }
          //console.log(data + "");
          //this.previousRolls = rolls;
          //console.log("Previous Rolls" + this.previousRolls);
         }else{
           this.appendToHistory((data['data'] as RouletteRoll));
        }
      });

      this.connectionTimerStart = this.gameService.getTimerInit().subscribe(data => {
        this.countdown(parseInt(data.toString()), 1);
      });

      this.connectionRouletteRoll = this.gameService.getRollInit().subscribe(data => {
        //console.log("SPINNING TO CALLED" + data.toString());
        var da = parseInt(data.toString());
        var t = this;
        if(document.getElementById("greenBet") === null){//tab is not active
          var timer = setInterval(function(){
            if(document.getElementById("greenBet") !== null){
              //console.log("REALIGNING! " + da);
              setTimeout(function(){
                t.spinToNumber(da, true);
              }, 100);

              clearInterval(timer);
            }
          }, 100);//Wait until it's active again
        }else{
          t.spinToNumber(da, false);
        }
        //this.spinToNumber(parseInt(data.toString()), false);

      });
	  
      this.connectionRewardInit = this.gameService.getBetReset().subscribe(data => {
        //REWARD ANIMATION
        var color = data;

        this.rolling = true;
        if(document.getElementById("greenBet") !== null){
          this.animateBets(color);
        }


      });;
    }

    animateBets(colorWinner){
      var winnerElem, loserElem, loser2Elem;
      if(colorWinner == 0){
        loserElem = document.getElementById("greenBet");
        winnerElem = document.getElementById("redBet");
        loser2Elem = document.getElementById("blackBet");
      }else if(colorWinner == 1){
        winnerElem = document.getElementById("greenBet");
        loserElem = document.getElementById("redBet");
        loser2Elem = document.getElementById("blackBet");
      }else{
        loserElem = document.getElementById("greenBet");
        loser2Elem = document.getElementById("redBet");
        winnerElem = document.getElementById("blackBet");
      }

      loserElem.classList.add("lose");
      loser2Elem.classList.add("lose");
      winnerElem.classList.add("win");

      var ang = this;

      setTimeout(function(){
        loserElem.classList.remove("lose");
        loser2Elem.classList.remove("lose");
        winnerElem.classList.remove("win");

        ang.redBets = [];

        ang.greenBets = [];

        ang.blackBets = [];

        this.rolling = false;

      }, 1500);


    }

    betUpdate(bet: RouletteBet){
      var color = bet.color;
      var id = bet.id;
      var amount = bet.bet;

      var bets: RouletteBet[];
      if(color == 0){
        bets = this.redBets;
      }else if(color == 1){
        bets = this.greenBets;
      }else{
        bets = this.blackBets;
      }

      var shift = false;
      var index = 0;
      for(var i = 0; i < bets.length; i++){
        if(bets[i].id === id){
          bets[i].bet = amount;
          if(amount > bets[0].bet){
            shift = true;
            index = i;
          }else{
            return;
          }

        }
      }

      if(shift){
        promote(id, bets);
        return;
      }

      function promote(id, arr) {
          for (var i=0; i < arr.length; i++) {
              if (arr[i].id === id) {
                  var a = arr.splice(i,1);
                  arr.unshift(a[0]);
                  break;
              }
          }
      }

      if(bets.length === 0 || bet.bet > bets[0].bet){
        bets.unshift(bet);
      }else{
        bets.push(bet);
      }
    }



    getDisplayRollHistory(): RouletteRoll[] {
      return this.previousRolls;
    }

    displayRollHistory = this.getDisplayRollHistory();

    getColor(roll: number): string {
      if(roll === 0){
        return "greenRoll";
      }else if(roll > 0 && roll <= 7){
        return "redRoll";
      }else{
        return "blackRoll";
      }
    }

    appendToHistory(roll: RouletteRoll): void {
      var elem = this.rollsElem;
      elem.setAttribute('style', `
      transform: matrix(1, 0, 0, 1, 41.4, 0); transition-duration: 1s;
      `);

      var ang = this;

      setTimeout(function(){
        ang.previousRolls.push(roll);
        if(ang.previousRolls.length > 11){
          ang.previousRolls.splice(0,1);
        }

        elem.setAttribute('style', '');
      }, 1000);


    }

    countdown(time: number, percentComplete: number): void {
      this.rolling = false;
      var elem = this.barElem;
      var text = this.timeElem;

      var width = 100;
      var interval = 40;

      var inc = 1;

      var ang = this;

      var intervalSec = interval/1000;
      elem.setAttribute('style', '');

      var rounded = parseFloat((time*percentComplete).toString()).toFixed(2);
      text.innerHTML = rounded + "s";

      elem.style.width = percentComplete*100 + '%';
      //console.log("WIDTH IS NOW " + elem.style.width);
      //console.log("INITIAL WIDTH SET AT: " + percentComplete*100);
      //console.log("TIME TO GO: " + time*percentComplete);

      setTimeout(function(){
        init();
      }, 0);

      var dateStart;

      function init(){
        time = time*percentComplete;
        dateStart = new Date();
        //elem.setAttribute('style', 'transition: width ' + time + 's; transition-timing-function: linear;');

        elem.style.width = '100%';
      }



      var timerId = setInterval(frame, interval);
      var timeLeft = 10000;
      function frame() {
          if (width <= 0 || timeLeft <= 0) {
              //DONE, NOW SPIN
              text.innerHTML = "0.00s";
              elem.style.width = '0%';
              //ang.spinToNumber(0, false);
              clearInterval(timerId);
          } else {
            timeLeft = timeLeftCalc(time);//(((time*1000)-interval*inc)/1000);
            if(timeLeft < 0){
              timeLeft = 0;
            }
            width = (timeLeft/(time/percentComplete))*100;
            var rounded = parseFloat((Math.round(timeLeft * 100) / 100).toString()).toFixed(2);
            text.innerHTML = rounded + "s";
            elem.style.width = width + '%';
          }
          inc++;
      }

      function timeLeftCalc(totalTime){
        var now = new Date();
        var diff = now.getTime() - dateStart.getTime();
        diff = diff/1000;
        return totalTime - diff;
      }
    }

    spinToNumber(win: number, init: boolean): void {

        var ang = this;

        var itemWidth = 70;

        //win = Math.floor(Math.random()*15);
        //console.log("SPINNING TO: " + win);
        var elem = this.wheelsHolder;
        //if(elem === null)return; //if not in tab

        var currentBox = this.nums.indexOf(this.currentPosition);
        currentBox = currentBox < 7 ? currentBox + 8 : currentBox - 7;


        var nextBox = this.nums.indexOf(win);
        nextBox = nextBox < 7 ? nextBox + 8 : nextBox - 7;


        var boxShift = currentBox > nextBox ? this.nums.length - currentBox + nextBox : nextBox - currentBox;


        var currentOffset = parseInt(elem.style.transform.replace('matrix(1, 0, 0, 1, ', '').split(",")[0]);

        if(isNaN(currentOffset)){
          currentOffset = 0;
        }

        var boxPixelShift = currentOffset%itemWidth;


        var max = -1*boxPixelShift;
        max += itemWidth/2;

        var min = -1*((itemWidth/2) + boxPixelShift);
        min += itemWidth/2;

        var boxVariation = Math.random()*(max - min + 1) + min;
        boxVariation -= itemWidth/2;

        var wheelVariation = -(15*itemWidth)*(Math.floor(Math.random()*(3) + 3));

        var duration = 5;

        if(wheelVariation <= -(15*itemWidth*4)){
          duration = 6;
        }

        var offset = currentOffset + boxShift*-itemWidth  + wheelVariation + boxVariation;

        if(init){
          duration = 0;
          elem.setAttribute("style", 'transform: matrix(1, 0, 0, 1, ' + offset + ', 0);');
        }else{
          elem.setAttribute("style", 'transform: matrix(1, 0, 0, 1, ' + offset + ', 0); transition-duration: ' + duration + 's;');
        }

        if(!init){
          this.playStartSpinSound();
        }
        var childs = elem.children;

        var count = 1;
        var width = childs[0].getBoundingClientRect().width;

        var nextOffset = offset%width;

        this.currentPosition = win;
        this.rolling = true;
        var id = setTimeout(function(){

          elem.setAttribute("style", 'transform: matrix(1, 0, 0, 1, ' + nextOffset + ', 0);');

          setTimeout(function(){
            var offsetFix = nextOffset%itemWidth;
            offsetFix = offsetFix < -(itemWidth/2) ? -1*(itemWidth + offsetFix) : -1*(offsetFix);
            elem.setAttribute("style", 'transform: matrix(1, 0, 0, 1, ' + (nextOffset + (offsetFix) - 1.5) + ', 0); transition-duration: 1s;');
            if(!init){
              ang.playLandSound();
            }

            //ang.appendToHistory(win);
          }, 400);

        }, duration*1000);

    }

    toggleMute(): void {
      this.muted = !this.muted;
     }

     mutedIcon(): string {
       if(!this.muted){
         return "fa fa-volume-up";
       }
       return "fa fa-volume-off";
     }


    playLandSound(): void {
      if(!this.muted){
        var audio = new Audio("../assets/sounds/finish.wav");
        audio.volume = .4;
        audio.load();
        audio.play();
      }

    }

    playStartSpinSound(): void {
      if(!this.muted){
        var audio = new Audio("../assets/sounds/start.mp3");
        audio.volume = .4;
        audio.load();
        audio.play();
      }
    }

    incrementBet(inc: number): void {
      this.currentBet += inc;
      this.verifyBetAmount();
    }

    multiplyBet(mult: number): void {
      this.currentBet = this.currentBet*mult;
      this.verifyBetAmount();
    }

    clearBet(): void {
      this.currentBet = 0;
    }

    maxBet(): void {
        this.currentBet = this.user.balance*10;
        this.verifyBetAmount();
    }

    verifyBetAmount(): void {
      if(this.currentBet < this.minBetAmount){
        this.currentBet = this.minBetAmount;
      }
      if(this.currentBet > this.user.balance*10){
        this.currentBet = this.user.balance*10;
      }
      if(this.currentBet > this.maxBetAmount){
        this.currentBet = this.maxBetAmount;
      }

      this.currentBet = Math.floor(this.currentBet*100)/100;

    }

    getTopBet(color: number){
      var bets: RouletteBet[];
      if(color == 0){
        bets = this.redBets;
      }else if(color == 1){
        bets = this.greenBets;
      }else{
        bets = this.blackBets;
      }

      if(bets.length == 0){
        var bet: RouletteBet = {
          betName: this.blankUser.name,
          id: this.blankUser.id,
          betPicture: this.blankUser.pictureUrl,
          bet: 0,
          color: color,
        };
        return bet;
      }

      return bets[0];
    }

    betDisabled = false;


    lockInBet(color: number): void {
      //console.log("LOCKING IN BET");
      if(this.betDisabled)return;
      if(this.currentBet <= 0 || this.currentBet > this.maxBetAmount){
        return;
      }
      //console.log("meet the minimum");
      if(this.user.id === '-1'){
        return;
      }

      this.betDisabled = true;

      var a = this;

      setTimeout(function(){
        a.betDisabled = false;
      }, 500);
      //console.log("Not default user");

      if(!this.rolling){
        this.userService.addBet(color, this.currentBet);
      }

    }



    /**
    THESE ARE DISPLAY FUNCTIONS
    */

    formatNumber(num: number, comma: boolean): string {
      return (num*10).toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    getSumBets(color: number): number {
      var bets: RouletteBet[];
      if(color == 0){
        bets = this.redBets;
      }else if(color == 1){
        bets = this.greenBets;
      }else{
        bets = this.blackBets;
      }

      var sum = 0;
      for(var i = 0; i < bets.length; i++){
        sum += bets[i].bet*1;
      }

      return sum;
    }

    getTotalBet(color: number): number {
      var bets: RouletteBet[];
      if(color == 0){
        bets = this.redBets;
      }else if(color == 1){
        bets = this.greenBets;
      }else{
        bets = this.blackBets;
      }

      var sum = 0;
      for(var i = 0; i < bets.length; i++){
        if(bets[i].id === this.user.id){
          return bets[i].bet;
        }
      }

      return 0;
    }

    onSelect(roll: RouletteRoll, content: any): void {
      //SHOW POPUP OF THE ROLL INFORMATION
      //TEMP DO alert
      var comp = this.modalService.open(RollModalContent, {size:'sm'});
      comp.componentInstance.roll = roll;
      //confirm("Round Number: " + roll.round);
    }

    hasTopBet(color: number): Boolean {
      return this.getTopBet(color).betName !== '-';
    }
}
