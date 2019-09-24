import {Component, Input, trigger, state, style, transition, animate} from '@angular/core';

import {NgbModal, NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';


@Component({
  selector: 'roll-modal-content',
  templateUrl: `../assets/html/trade-modal.component.html`,
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
export class TradeModalContent {
  @Input() hash: String;
  @Input() tradeUrl: String[];
  @Input() tradeType: String;
  @Input() expireIn: Number;
  @Input() tradeErrorWithdraw: Boolean = false;
  @Input() tradeErrorDeposit: Boolean = false;

  constructor(public activeModal: NgbActiveModal) {}

  state: any;


}
