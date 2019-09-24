import { Component, Input } from '@angular/core';

import { UserService } from './user.service';


@Component({
  selector: 'my-provably-fair',
  templateUrl: `../assets/html/provably-fair.component.html`,
  styleUrls: ['../assets/css/trade.component.css'],
})

export class ProvablyFairComponent {

  @Input() rollNum:number;
  @Input() result:number;
  @Input() date:string;
  @Input() hash:string;
  @Input() roll:number;

  constructor(private userService: UserService){}

  checkRoll(){
    this.userService.checkRollInfo(this.roll).subscribe(data => {
      if(!data.toString().includes('error')){
        var parsed = JSON.parse(JSON.stringify(data));
        this.rollNum = this.roll;
        this.result = parsed.result;
        this.date = parsed.date;
        this.hash = parsed.hash;
      }else{
        this.rollNum = -1;
        this.result = -1;
        this.date = "N/A";
        this.hash = "N/A";
      }
    });
  }

  getColor(){
    if(this.result == -1)return 'white';
    if(this.result == 0){
      return 'green';
    }else if(this.result <= 7){
      return 'red';
    }else{
      return 'black';
    }
  }

}
