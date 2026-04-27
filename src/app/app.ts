import { Component, OnInit, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './components/navbar/navbar';
import { DocAssistant } from './components/doc-assistant/doc-assistant';
import { DocAssistantState } from './services/doc-assistant-state';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, DocAssistant],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  showDocAssistant = false;
  assistantWidth = 420;

  private _resizing = false;

  constructor(private assistantState: DocAssistantState) {}

  ngOnInit() {
    this.assistantState.open$.subscribe(() => {
      this.showDocAssistant = true;
    });
  }

  onResizeStart(event: MouseEvent) {
    event.preventDefault();
    this._resizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this._resizing) return;
    const newWidth = window.innerWidth - event.clientX;
    // Clamp between 320px and 700px
    this.assistantWidth = Math.max(320, Math.min(700, newWidth));
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    if (this._resizing) {
      this._resizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }
}
