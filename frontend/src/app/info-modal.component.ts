import {Component, Input, trigger, state, style, transition, animate} from '@angular/core';

import {NgbModal, NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';


@Component({
  selector: 'info-modal-content',
  templateUrl: `../assets/html/info-modal.component.html`,
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
export class InfoModalContent {
  @Input() title: String;
  @Input() headers: String[];
  @Input() contents: String[];

  constructor(public activeModal: NgbActiveModal) {}

  state: any;


}
