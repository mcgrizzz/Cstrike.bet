import { Injectable, OnInit } from '@angular/core';
import { User } from './user';
import { RouletteBet } from './roulette-bet';
import { Headers, Http, Response, RequestOptions } from '@angular/http';

import { Subject } from 'rxjs/Subject';
import { Observable } from 'rxjs/Observable';
import * as io from 'socket.io-client';

import 'rxjs/add/operator/toPromise';
import 'rxjs/add/operator/map';


import {CookieService} from 'angular2-cookie/core';

@Injectable()
export class UserService implements OnInit{

  user: User;
  temp: any;

  private apiBase = 'https://cstrike.bet:2083/api/';
  private socketUrl = 'https://cstrike.bet:2053/';
  public socket;

  constructor
  (
    public cookieService: CookieService,
    private http: Http,

  ) {}

  ang: any = this;

  botMaintence: boolean = false;


  ngOnInit(){

  }
  /**
  Will change code to use session token to fetch user details OR MOST LIKELY JWT
  */

  init(){
    this.socket.emit('init');
  }

  botsDown(){
    return this.botMaintence;
  }

  isSignedIn(){
    if(this.cookieService.get('auth')){
      if(this.cookieService.get('auth') == 'NOGAME'){
          this.cookieService.remove('auth');
          alert('You cannot login without having the game CSGO.');
          return false;
      }
      return true;
    }else{
      return false;
    }
  }

  sendMessage(message: String){
    if(this.isSignedIn()){
      //console.log("SENDING: " + message);
      this.socket.emit('send-message', message);
    }
  }

  redeemPromoCode(message: String){
  //  console.log("ABOUT TO EMIT REDEEM PROMO");
    if(this.isSignedIn()){
    //  console.log("EMITTING REDEEM PROMO");
      this.socket.emit('redeem-promo', message);
    }
  }

  savePromoCode(message: String){
    if(this.isSignedIn()){
      this.socket.emit('set-promo', message);
    }
  }

  redeemAffiliateBalance(){
    if(this.isSignedIn()){
      this.socket.emit('redeem-credits');
    }
  }

  getAffiliateErrors(){
    let observable = new Observable(observer => {
      this.socket.on('redeem-error', (data) => {
        //console.log(data);
        observer.next(data);
      });
      return () => {
        this.socket.disconnect();
      };
    })
    return observable;
  }

  getMessages() {
    let observable = new Observable(observer => {
      this.socket.on('message-add', (data) => {
        observer.next(data);
      });
      return () => {
        this.socket.disconnect();
      };
    })
    return observable;
  }

  getUser() {
    if(this.socket === undefined){
      this.socket = io(this.socketUrl, {secure: true});
    }

    if(this.isSignedIn()){
      this.socket.emit('join', this.cookieService.get('auth'));
    }

    let observable = new Observable(observer => {

      this.socket.on('user-update', (data) => {
      //  console.log("RECEIVED CLIENT UPDATE");
        observer.next(data);
      });
      return () => {
        this.socket.disconnect();
      };
    })
    return observable;
  }

  getUserAffiliate(){
    if(this.socket === undefined){
      this.socket = io(this.socketUrl);
    }

    if(this.isSignedIn()){
      this.socket.emit('join', this.cookieService.get('auth'));
    }

    let observable = new Observable(observer => {

      this.socket.on('affiliate-update', (data) => {
      //  console.log(data);
      //  console.log("RECEIVED AFFILIATE UPDATE");
        observer.next(data);
      });
      return () => {
        this.socket.disconnect();
      };
    })
    return observable;
  }

  getErrors(){
    let observable = new Observable(observer => {

      this.socket.on('error-msg', (data) => {
        alert(data.message);
        observer.next(data);
      });
      return () => {
        this.socket.disconnect();
      };
    })
    return observable;
  }

  addBet(colorr: Number, bett: number) {
  //  console.log("ADDING BET: " + colorr + " " + bett);
    if(!this.isSignedIn())return;
    this.socket.emit('add-bet', {color: colorr, bet: (bett)});
  }

  getBets() {
    let observable = new Observable(observer => {
      this.socket.on('bet-update', (data) => {
        observer.next(data);
        //console.log(data);
      });
      return () => {
        this.socket.disconnect();
      };
    })
    return observable;
  }

  checkRollInfo(roll){
    if(!this.isSignedIn())return;

    return this.http.post(this.apiBase + "server/validation/roll",
    {'roll': roll})
    .map((res:Response) => res.json());
  }


  //DEPOSIT STUFF

  getUserItems() {
    if(!this.isSignedIn())return;

    return this.http.post(this.apiBase + "user/items",
    {'hash': this.cookieService.get('auth')})
        .map((res:Response) => res.json());
  }

  validateTradeUrl(url){
    return /\/\/steamcommunity.com\/tradeoffer\/new\/\?partner=[0-9]+&token=[a-zA-Z0-9_-]*/.test(url);
  }

  saveTradeUrl(url){
    if(!this.isSignedIn())return;

    this.http.post(this.apiBase + "user/tradeurl/save",
    {'hash': this.cookieService.get('auth'), 'url': url})
    .toPromise();
  }

  depositItems(items){
    if(!this.isSignedIn())return;
  //  console.log("CALLED IN USER SERVICE");
    return this.http.post(this.apiBase + "server/deposit",
    {'hash': this.cookieService.get('auth'), 'items': items})
    .map((res:Response) => res.json());
  }

  getBotItems(){
  //  if(!this.localStorageService.get('userId'))return;

    return this.http.post(this.apiBase + "server/withdrawitems", {})
        .map((res:Response) => res.json());
  }

  withdrawItems(items){
    if(!this.isSignedIn())return;
    return this.http.post(this.apiBase + "server/withdraw",
    {'hash': this.cookieService.get('auth'), 'items': items})
    .map((res:Response) => res.json());
  }


  logoutUser(): void {
    if(!this.isSignedIn())return;
    this.http.post(this.apiBase + "logout", {
      'id': this.cookieService.get('auth') });
      this.cookieService.remove('auth');
      window.location.assign('http://cstrike.bet/roulette');
  }

  private handleError(error: any): Promise<any> {
  //  console.error('An error occurred BLAHHHHH', error); // for demo purposes only
    return Promise.reject(error.message || error);
  }

}
