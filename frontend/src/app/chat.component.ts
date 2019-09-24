import { Component, OnInit, OnDestroy, AfterViewChecked, ElementRef, ViewChild, Renderer, trigger, state, style, transition, animate } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Params, Router }   from '@angular/router';

import 'rxjs/add/operator/switchMap';

import { UserService } from './user.service';


@Component({
  selector: 'my-chat',
  templateUrl: `../assets/html/chat.component.html`,
  styleUrls: ['../assets/css/chat.component.css'],
  animations: [
    trigger('chatIn',[
      state('in', style({opacity: 1})),
      transition('void => *', [
        style({opacity: 0}),
        animate(400)
      ]),

    ]),
  ],
})

export class ChatComponent implements OnInit, AfterViewChecked{
  @ViewChild('scrollMe') private myScrollContainer: ElementRef;

  messages = [];
  connection;
  message;
  hasScrolled = false;
  manualScroll = false;
  scrolling = false;

  lastMessageSent = new Date();

  constructor(private userService: UserService, private renderer: Renderer) {}

  ngOnInit() {
    this.renderer.listen(this.myScrollContainer.nativeElement, "scroll", (event: Event) => {

    });

    this.connection = this.userService.getMessages().subscribe(message => {
      this.hasScrolled = false;
      this.messages.push(message);

    })
    this.scrollToBottom();
  }

 ngAfterViewChecked(){
    if(!this.hasScrolled){
      this.scrollToBottom();
    }
  }

  scrollToBottom(){
    this.scrolling = true;
    try {
        this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
        this.hasScrolled = true;
    } catch(err) {
    //  console.log(err);
    }
    this.scrolling = false;
  }

  ngOnDestroy() {
    this.connection.unsubscribe();
  }

  isBlank(str) {
    return (!str || /^\s*$/.test(str));
  }

  getUserLink(m){
    return "https://steamcommunity.com/profiles/" + m.id;
  }

  sendMessage(){
    if (/\S/.test(this.message)) {
    // string is not empty and not just whitespace
    var date = new Date();
    if(date.getTime() - this.lastMessageSent.getTime() >= 1500){
      this.userService.sendMessage(this.message)
      this.message = '';
      this.lastMessageSent = date;
    }else{

    }
  }else{
    this.message = '';
  }


  }


  getUserColor(m){
    if(m.rank === "Admin"){
      return "rgb(181, 51, 51)";
    }else if(m.rank === "Moderator"){
      return "rgb(49, 80, 159)";
    }else if(m.rank === "Server"){
      return "rgb(41, 130, 55)";
    }else{
      return "white";
    }
  }

  getTitle(m){
    if(m.rank === "Admin"){
      return "Admin";
    }else if(m.rank === "Moderator"){
      return "Moderator";
    }else{
      return "User";
    }
  }

}
