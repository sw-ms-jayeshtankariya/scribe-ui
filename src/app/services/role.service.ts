import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AppRole = 'REVIEWER' | 'ENGINEER' | 'ADMIN';

@Injectable({ providedIn: 'root' })
export class RoleService {
  private _role$ = new BehaviorSubject<AppRole>('REVIEWER');
  role$ = this._role$.asObservable();

  get current(): AppRole { return this._role$.value; }

  setRole(role: AppRole) { this._role$.next(role); }
}
