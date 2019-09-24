import { NgModule }             from '@angular/core';
import { RouterModule, Routes, PreloadAllModules } from '@angular/router';
import { CanDeactivate } from '@angular/router';

import { RouletteComponent }   from './roulette.component';
import { DepositComponent } from './deposit.component';
import { WithdrawComponent } from './withdraw.component';
import { LoginComponent } from './login.component';
import { ProvablyFairComponent } from './provably-fair.component';

const routes: Routes = [
    { path: 'deposit', component: DepositComponent },
  { path: 'withdraw', component: WithdrawComponent},
  { path: 'login/:id', component: LoginComponent },
  { path: 'provably-fair', component: ProvablyFairComponent},
  { path: '**', component: RouletteComponent}
];

@NgModule({
  imports: [ RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules}) ],
  exports: [ RouterModule ]
})
export class AppRoutingModule {}
