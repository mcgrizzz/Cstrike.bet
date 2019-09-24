import { Component, OnInit, trigger, state, style, transition, animate } from '@angular/core';

import { UserService } from './user.service';
import { User } from './user';
import 'rxjs/add/operator/switchMap';

import {NgbModal, NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import { TradeModalContent } from './trade-modal.component';


@Component({
  selector: 'my-deposit',
  templateUrl: `../assets/html/deposit.component.html`,
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

export class DepositComponent implements OnInit{

  constructor(private userService: UserService, public modalService: NgbModal) {}
  connection;
  userConnection;

  user: User = null;

  items = [];
  itemsDeposited = [];

  tradeUrl = "No Trade Url set";
  saveTimeout = false;
  loader = true;

  tradeError = false;

  ngOnInit(): void {

    if(this.userService.isSignedIn()){
      this.connection = this.userService.getUserItems().subscribe(data => {
        if(!this.userService.botsDown() || this.user.id == "76561198059367897"){
          this.items = data.data;
        }

      //  console.log(this.items);
        this.loader = false;
      });

      this.userConnection = this.userService.getUser().subscribe(data => {
        this.user = JSON.parse(data.toString()) as User;
        this.tradeUrl = this.user.tradeUrl;
      //  console.log(this.user);
      });
    }else{
      this.loader = false;
    }

  }

  isEmpty(){
    return !this.loader && this.items.length == 0;
  }

  isSignedIn(){
    return this.userService.isSignedIn();
  }

  validateTradeUrl(){
    return this.userService.validateTradeUrl(this.tradeUrl);
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

  depositItems(){
    if(this.validateTradeUrl()){
      //console.log("CALLED FROM BUTTON PRESS");
      this.openTradeModal(this.userService.depositItems(this.itemsDeposited));
      for(var i = 0; i < this.itemsDeposited.length; i++){
        this.items.splice(this.items.indexOf(this.itemsDeposited[i]), 1);
      }
      this.itemsDeposited = [];
    }else{
      this.tradeUrl = "NO TRADE URL SET!";
    }
  }

  hasDeposited(){
    return this.itemsDeposited.length > 0;
  }

  addToDeposit(ite){
    if(this.userService.botsDown())return;
    if(ite.price < .5)return;
    if(this.itemsDeposited.indexOf(ite) === -1){
      this.itemsDeposited.push(ite);
    }else{
      this.removeFromDeposit(ite);
    }
  }

  removeFromDeposit(ite){
    var index =this.itemsDeposited.indexOf(ite);
    if(index !== -1){
      this.itemsDeposited.splice(index, 1);
    }
  }

  getTotalDeposit(){
    var tot = 0;
    for(var i = 0; i < this.itemsDeposited.length; i++){
      tot += this.itemsDeposited[i].price;
    }
    return this.formatNumber(tot);
  }

  getClass(ite){
    var clazz = "item";
    if(ite.price > .5){
      clazz += ' canDeposit';
    }
    if(this.itemsDeposited.indexOf(ite) !== -1){
      clazz += ' deposited';
    }

    return clazz;
  }

  getPrice(ite){
    if(ite.price > .5){
      return this.formatNumber(ite.price);
    }else{
      return 'Garbage';
    }
  }

  getPriceClass(ite){
    if(ite.price > .5){
      return 'itemPrice';
    }else{
      return 'itemPrice garbage';
    }
  }

  formatNumber(num: number): string {
    return (num*10).toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  openTradeModal(response){
    var comp = this.modalService.open(TradeModalContent);
    //comp.componentInstance.roll = roll;
    comp.componentInstance.tradeType = "Deposit";
    comp.componentInstance.expireIn = 10;
    response.subscribe(data => {
      if(!data.toString().includes('error')){
        var parsed = JSON.parse(data);
        comp.componentInstance.tradeUrl = parsed.tradeUrl.split(",");
        comp.componentInstance.hash = parsed.tradeHash;
      }
    })

    setTimeout(function(){
      if(!comp.componentInstance.hash){
        comp.componentInstance.tradeErrorDeposit = true;
      }
    }, 1000*18);
  }


}
