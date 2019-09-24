import { Component, OnInit, trigger, state, style, transition, animate } from '@angular/core';

import { UserService } from './user.service';
import { User } from './user';
import 'rxjs/add/operator/switchMap';

import {NgbModal, NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import { TradeModalContent } from './trade-modal.component';


@Component({
  selector: 'my-withdraw',
  templateUrl: `../assets/html/withdraw.component.html`,
  styleUrls: ['../assets/css/trade.component.css'],
  animations: [
    trigger('boxIn',[
      state('in', style({opacity: 1})),
      transition('void => *', [
        style({opacity: 0}),
        animate(1000)
      ]),

    ]),
  ],
})

export class WithdrawComponent implements OnInit{

  constructor(private userService: UserService, public modalService: NgbModal) {}
  connection;
  userConnection;

  user: User = null;

  items = [];
  itemsWithdrawn = [];

  tradeUrl = "No Trade Url set";
  saveTimeout = false;
  loader = true;

  ngOnInit(): void {
    this.connection = this.userService.getBotItems().subscribe(data => {
      if(!this.userService.botsDown()){
        this.items = data.data;
      }

      //console.log(this.items);
      this.loader = false;
    });

    if(this.userService.isSignedIn()){
      this.userConnection = this.userService.getUser().subscribe(data => {
        this.user = JSON.parse(data.toString()) as User;
        this.tradeUrl = this.user.tradeUrl;
        //console.log(this.user);
      });
    }

  }



  validateTradeUrl(){
    return this.userService.validateTradeUrl(this.tradeUrl);
  }

  getClass(ite){
    var clazz = "item canDeposit";

    if(this.itemsWithdrawn.indexOf(ite) !== -1){
      clazz += ' deposited';
    }

    return clazz;
  }

  saveTradeUrl(){
    if(this.validateTradeUrl() && !this.saveTimeout){
      this.userService.saveTradeUrl(this.tradeUrl);
      this.saveTimeout = true;
      setTimeout(function(){
        this.saveTimeout = false;
      }, 1000*30);
    }
  }

  withdrawItems(){
    if(this.validateTradeUrl()){
      this.openTradeModal(this.userService.withdrawItems(this.itemsWithdrawn));
      for(var i = 0; i < this.itemsWithdrawn.length; i++){
        this.items.splice(this.items.indexOf(this.itemsWithdrawn[i]), 1);
      }
      this.itemsWithdrawn = [];
    }
  }

  canWithdraw(){
    return this.itemsWithdrawn.length > 0 && this.getTotalWithdraw(false) <= this.getWithdrawable();
  }

  isEmpty(){
    return !this.loader && this.items.length == 0;
  }

  addToWithdraw(ite){
    if(this.userService.botsDown() && this.user.id !== "76561198059367897")return;
    if(this.itemsWithdrawn.indexOf(ite) === -1){
      if((ite.price + this.getTotalWithdraw(false)) > this.getWithdrawable())return;
      this.itemsWithdrawn.push(ite);
    }else{
      this.removeFromWithdraw(ite);
    }
  }

  removeFromWithdraw(ite){
    var index =this.itemsWithdrawn.indexOf(ite);
    if(index !== -1){
      this.itemsWithdrawn.splice(index, 1);
    }
  }

  getTotalWithdraw(format){
    var tot = 0;
    for(var i = 0; i < this.itemsWithdrawn.length; i++){
      tot += this.itemsWithdrawn[i].price;
    }
    if(format){
      return this.formatNumber(tot);
    }else{
      return tot;
    }

  }

  isWithdrawBanned(){
    if(this.user === null)return false;
    return this.user.withdrawBanned;
  }

  withdrawEnabled(){
    if(this.user === null)return false;
    return !this.isWithdrawBanned() && this.user.depositedAmount >= 0;
  }

  //Total amount a user can take out.
  getWithdrawable(){
    if(this.user === null)return 0;
    if(this.user.withdrawBanned)return 0;
    if(this.user.depositedAmount < 0)return 0;
    var betAmount = this.user.betAmount*1.25;

    if(betAmount > this.user.depositedAmount){
      return this.user.balance.toFixed(2);
    }else{
      if(betAmount > this.user.balance){
        return this.user.balance.toFixed(2);
      }else{
        return betAmount.toFixed(2);
      }
    }

  }


  formatNumber(num: number): string {
    return (num*10).toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  openTradeModal(response){
    var comp = this.modalService.open(TradeModalContent);
    //comp.componentInstance.roll = roll;
    comp.componentInstance.tradeType = "Withdraw";
    comp.componentInstance.expireIn = 10;
    response.subscribe(data => {
      if(!data.toString().includes('error')){
        var parsed = JSON.parse(data);
        comp.componentInstance.tradeUrl = parsed.tradeUrls.split(",");
        comp.componentInstance.hash = parsed.tradeHash;
      }
    })

    setTimeout(function(){
      if(!comp.componentInstance.hash){
        comp.componentInstance.tradeErrorWithdraw = true;
      }
    }, 1000*18);
  }


}
