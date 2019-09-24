import { NgModule }      from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule }   from '@angular/forms';
import { HttpModule } from '@angular/http';

import { AppRoutingModule } from './app-routing.module';

import { AppComponent }  from './app.component';
import { RouletteComponent } from './roulette.component';
import { RollModalContent } from './roll-modal.component';
import { TradeModalContent } from './trade-modal.component';
import { InfoModalContent } from './info-modal.component';
import { AffiliateModalContent } from './affiliate-modal.component';
import { LoginComponent } from './login.component';
import { ChatComponent } from './chat.component';
import { DepositComponent } from './deposit.component';
import { WithdrawComponent } from './withdraw.component';
import { ProvablyFairComponent } from './provably-fair.component';

import { RouletteGameService } from './roulette-game.service';
import { UserService } from './user.service';
import { OrderByPipe } from './pipes/orderBy';

import {CustomReuseStrategy } from './reuse-strategy.ts';

import {RouteReuseStrategy } from '@angular/router';

import {NgbModule, NgbModal} from '@ng-bootstrap/ng-bootstrap';

import {Counto} from './directives/counto.directive';

import { CookieService } from 'angular2-cookie/services/cookies.service';





@NgModule({
  imports:      [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    NgbModule.forRoot(),
    HttpModule,
   ],
  entryComponents: [RollModalContent, TradeModalContent, InfoModalContent, AffiliateModalContent],
  providers: [
    NgbModal,
    UserService,
    RouletteGameService,
    Counto,
    CookieService,
    {provide: RouteReuseStrategy, useClass: CustomReuseStrategy},
  ],
  declarations: [
    AppComponent,
    RouletteComponent,
    ChatComponent,
    LoginComponent,
    RollModalContent,
    TradeModalContent,
    InfoModalContent,
    AffiliateModalContent,
    DepositComponent,
    WithdrawComponent,
    ProvablyFairComponent,
    OrderByPipe,
    Counto,
   ],
  bootstrap:    [ AppComponent ]
})

export class AppModule { }
