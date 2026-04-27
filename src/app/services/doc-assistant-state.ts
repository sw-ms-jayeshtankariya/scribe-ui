import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DocAssistantState {
  private _open$ = new Subject<void>();
  open$ = this._open$.asObservable();

  open() { this._open$.next(); }
}
