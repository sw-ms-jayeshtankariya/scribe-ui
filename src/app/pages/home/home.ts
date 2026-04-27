import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocAssistantState } from '../../services/doc-assistant-state';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  constructor(private assistantState: DocAssistantState) {}

  openAssistant() {
    this.assistantState.open();
  }
}
