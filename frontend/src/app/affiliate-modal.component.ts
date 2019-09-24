import {Component, Input, trigger, state, style, transition, animate} from '@angular/core';

import {NgbModal, NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import { UserService } from './user.service';


@Component({
  selector: 'affiliate-modal-content',
  templateUrl: `../assets/html/affiliate-modal.component.html`,
  styleUrls: ['../assets/css/roulette.component.css'],
  animations: [
    trigger('modalIn',[
      state('in', style({opacity: 1})),
      transition('void => *', [
        style({opacity: 0}),
        animate(500)
      ]),

    ]),
  ],
})
export class AffiliateModalContent {
  @Input() redeemPromo: String;
  @Input() promo: String;
  @Input() referred: number;
  @Input() balance: number;
  @Input() errorMessage: String;
  title: String = "Affiliates";



  constructor(public activeModal: NgbActiveModal, private userService: UserService) {}

  state: any;



  redeemPromoCode(){
    //console.log("REDEEMING PROMO");
    this.userService.redeemPromoCode(this.redeemPromo);
  }

  savePromoCode(){
    this.userService.savePromoCode(this.promo);
  }

  redeemBalance(){
    this.userService.redeemAffiliateBalance();
  }

  getMessageColor(){
    if(this.errorMessage.includes("ERROR")){
      return 'red';
    }else{
      return 'green';
    }
  }

  formatNumber(num: number): string {
    return (num*10).toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }


}
