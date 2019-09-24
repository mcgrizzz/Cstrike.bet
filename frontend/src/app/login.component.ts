import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Params, Router }   from '@angular/router';
import { LocalStorageService } from 'angular-2-local-storage';
import 'rxjs/add/operator/switchMap';


@Component({
  selector: 'my-login',
  template: '',
})

export class LoginComponent implements OnInit{

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
    private localStorage: LocalStorageService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params: Params) => {
      //  alert(JSON.stringify(params, null, 4));
        let userId = params['id'];
        //alert(userId);
        this.localStorage.set('userId', userId);

      });

      window.location.assign('./roulette');

  }


}
