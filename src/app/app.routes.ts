import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Projects } from './pages/projects/projects';
import { CreateProject } from './pages/create-project/create-project';
import { AdminDashboard } from './pages/admin-dashboard/admin-dashboard';
import { SessionHistory } from './pages/session-history/session-history';
import { ViewDocs } from './pages/view-docs/view-docs';
import { Intakes } from './pages/intakes/intakes';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'projects', component: Projects },
  { path: 'projects/new', component: CreateProject },
  { path: 'projects/:id/session', component: SessionHistory },
  { path: 'projects/:id/docs', component: ViewDocs },
  { path: 'projects/:id/intakes', component: Intakes },
  { path: 'dashboard', component: AdminDashboard },
  { path: '**', redirectTo: '' },
];
