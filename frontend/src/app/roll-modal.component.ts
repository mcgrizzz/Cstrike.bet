import {Component, Input, trigger, state, style, transition, animate} from '@angular/core';

import {NgbModal, NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import { RouletteRoll } from './roulette-roll';


@Component({
  selector: 'roll-modal-content',
  templateUrl: `../assets/html/roll-modal.component.html`,
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
export class RollModalContent {
  @Input() roll: RouletteRoll;

  constructor(public activeModal: NgbActiveModal) {}

  getColor(roll: number): string {
    if(roll === 0){
      return "greenRoll";
    }else if(roll > 0 && roll <= 7){
      return "redRoll";
    }else{
      return "blackRoll";
    }
  }

   formatDate(): string {

    var monthNames = [
      "January", "February", "March",
      "April", "May", "June", "July",
      "August", "September", "October",
      "November", "December"
    ];

    //console.log(this.roll);
    var date = new Date(this.roll["date"]);
    //console.log(date);
    var day = date.getDate();
    var monthIndex = date.getMonth();
    var year = date.getFullYear();

    return  monthNames[monthIndex] + ' ' + day + ', ' + year;
  }

  parseDate(str) {
    var mdy = str.split('/');
    return new Date(mdy[2], mdy[0]-1, mdy[1]);
  }

  state: any;
}
