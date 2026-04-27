import { Component, EventEmitter, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { RoleService, AppRole } from '../../services/role.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  @Output() openDocAssistant = new EventEmitter<void>();

  constructor(private roleService: RoleService) {}

  get currentRole(): AppRole { return this.roleService.current; }

  userName = 'Tankariya, Jayesh';
  userEmail = 'jayeshtankariya@gmail.com';
  roles: AppRole[] = ['REVIEWER', 'ENGINEER', 'ADMIN'];
  showRoleMenu = false;

  toggleRoleMenu() { this.showRoleMenu = !this.showRoleMenu; }

  selectRole(role: AppRole) {
    this.roleService.setRole(role);
    this.showRoleMenu = false;
  }
}
