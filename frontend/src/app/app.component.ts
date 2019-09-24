import { Component, OnInit, OnDestroy } from '@angular/core';
import { Http, Headers, Response } from '@angular/http';

import { User } from './user';
import { Affiliate } from './affiliate';

import { UserService } from './user.service';

import { LocalStorageService } from 'angular-2-local-storage';

import {NgbModal, NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import { InfoModalContent } from './info-modal.component';
import { AffiliateModalContent } from './affiliate-modal.component';

import {Counto} from './directives/counto.directive';

@Component({
  selector: 'my-app',
  templateUrl: `../assets/html/app.component.html`,
  styleUrls: [
    '../assets/css/app.component.css'],
})

export class AppComponent implements OnInit, OnDestroy {
  name = 'CStrike.bet';

  currentUser: User;
  balanceOld = 0;
  numberTime = 1.5;

  redeemedPromoCode = '';
  affiliateBalance = 0;
  currentPromoCode = '';
  referredAmount = 0;
  errorMessage = "";


  connection;
  connectionAffiliate;
  connectionAfMessages;

  affiliateUser;

  comp;

  constructor(private userService: UserService, public modalService: NgbModal){
  }


  ngOnInit(): void {
    this.toggleSidebar();
    this.connection = this.userService.getUser().subscribe(user => {
      if(this.currentUser !== undefined){
        this.balanceOld = this.currentUser.balance;
      }

      this.currentUser = JSON.parse(user.toString());

      if(this.balanceOld > this.currentUser.balance){
        this.numberTime = .1;
      }else{
        this.numberTime = 1.2;
      }
    });

    this.connectionAfMessages = this.userService.getAffiliateErrors().subscribe(msg => {
      //console.log(msg);
      this.errorMessage = JSON.parse(JSON.stringify(msg)).message;
      this.updateAffiliateComp();
    });

    this.connectionAffiliate = this.userService.getUserAffiliate().subscribe(aff => {

    //  console.log(aff.toString());
      this.affiliateUser = JSON.parse(aff.toString());
      this.affiliateBalance = this.affiliateUser.currentBalance;
      this.currentPromoCode = this.affiliateUser.promocode;
      this.referredAmount = this.affiliateUser.referred.length;

      var a = this;
      setTimeout(function(){
        a.updateAffiliateComp();
      }, 1000);

    });



    this.userService.getErrors().subscribe(data => {});

  }

  logout(): void {
    this.userService.logoutUser();
  }

  ngOnDestroy() {
    this.comp = null;
    this.connection.unsubscribe();
    this.connectionAffiliate.unsubscribe();
    this.connectionAfMessages.unsubscribe();
  }

  formatNumber(num: number): string {
    return (num*10).toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  openInfoModal(sizee, title, headers, content){
    var comp = this.modalService.open(InfoModalContent, {size:sizee});
    //comp.componentInstance.roll = roll;
    comp.componentInstance.title = title;
    comp.componentInstance.headers = headers;
    comp.componentInstance.contents = content;
  }

  openAffiliateModal(){
    this.comp = this.modalService.open(AffiliateModalContent);
    //comp.componentInstance.roll = roll;
    this.comp.componentInstance.promo = this.getCurrentPromo();
    this.comp.componentInstance.referred = this.getCurrentReferred();
    this.comp.componentInstance.balance = this.getCurrentAfBalance();
    this.comp.componentInstance.errorMessage = this.getAfErrorMessage();

  }

  updateAffiliateComp(){
    if(this.comp === null || this.comp === undefined)return;
    if(this.comp.componentInstance === null || this.comp.componentInstance === undefined)return;
    this.comp.componentInstance.promo = this.getCurrentPromo();
    this.comp.componentInstance.referred = this.getCurrentReferred();
    this.comp.componentInstance.balance = this.getCurrentAfBalance();
    this.comp.componentInstance.errorMessage = this.getAfErrorMessage();
  }

  getCurrentPromo(){
    return this.currentPromoCode;
  }

  getCurrentReferred(){
    return this.referredAmount;
  }

  getCurrentAfBalance(){
    return this.affiliateBalance;
  }

  getAfErrorMessage(){
    return this.errorMessage;
  }





  /*
  MOVE TO OWN COMPONENT
  */

  toggled:  boolean = true;

  toggleSidebar(){

    var elem = document.getElementById("sidebar");
    var arrElem = document.getElementById("arrow");
    var width = elem.clientWidth;
    if(this.toggled){
      elem.setAttribute('style', ' transition: margin .5s; margin-left: ' + '-' + width*.95 + 'px');
      arrElem.setAttribute('style', 'transition: transform .5s; transform: rotate(-180deg);');
    }else{
      elem.setAttribute('style', ' transition: margin .5s; margin-left: 0px');
      arrElem.setAttribute('style', 'transition: transform .5s; transform: rotate(0deg);')
    }

    this.toggled = !this.toggled;
  }
}
