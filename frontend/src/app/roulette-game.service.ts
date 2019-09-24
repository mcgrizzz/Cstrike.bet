import { Injectable} from '@angular/core';
import { User } from './user';
import { RouletteBet } from './roulette-bet';
import { Headers, Http } from '@angular/http';

import { UserService } from './user.service';

import { Subject } from 'rxjs/Subject';
import { Observable } from 'rxjs/Observable';
import * as io from 'socket.io-client';

import 'rxjs/add/operator/toPromise';


@Injectable()
export class RouletteGameService{

  user: User;
  temp: any;

  private socketUrl = 'https://cstrike.bet:2053/';

  constructor
  (
    private http: Http,
    private userService: UserService,

  ) {}

  ang: any = this;

  getInitWheelPosition() {
    let observable = new Observable(observer => {

      this.userService.socket.on('wheel-pos', (data) => {
        observer.next(data);
      });
      return () => {
        this.userService.socket.disconnect();
      };
    })
    return observable;
  }

  getInitTimerPosition(){
    let observable = new Observable(observer => {

      this.userService.socket.on('timer-pos', (data) => {
        observer.next(data);
      });
      return () => {
        this.userService.socket.disconnect();
      };
    })
    return observable;
  }

  getPreviousRolls() {
      let observable = new Observable(observer => {

        this.userService.socket.on('roll-history-update', (data) => {
          observer.next(data);
        });
        return () => {
          this.userService.socket.disconnect();
        };
      })
      return observable;

  }

  getTimerInit() {
    let observable = new Observable(observer => {

      this.userService.socket.on('timer-start', (data) => {
        observer.next(data);
      });
      return () => {
        this.userService.socket.disconnect();
      };
    })
    return observable;
  }

  getRollInit() {
    let observable = new Observable(observer => {

      this.userService.socket.on('roll-result', (data) => {
        observer.next(data);
      });
      return () => {
        this.userService.socket.disconnect();
      };
    })
    return observable;
  }

  getBetReset() {
    let observable = new Observable(observer => {

      this.userService.socket.on('roll-result-end', (data) => {
        observer.next(data);
      });
      return () => {
        this.userService.socket.disconnect();
      };
    })
    return observable;
  }


}
