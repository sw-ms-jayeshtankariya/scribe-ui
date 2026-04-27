import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-admin-dashboard',
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard implements OnInit {
  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  loading = true;
  fromDate = '';
  toDate = '';

  stats: any = {};
  projectsSummary: any[] = [];
  recentSessions: any[] = [];
  recentIntakes: any[] = [];
  agentActivity: any[] = [];
  eventsTimeline: any[] = [];

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.loading = true;

    // Fire all requests in parallel
    this.api.getDashboardStats(this.fromDate || undefined, this.toDate || undefined).subscribe({
      next: (data) => { this.stats = data; this.cdr.detectChanges(); },
    });

    this.api.getProjectsSummary().subscribe({
      next: (data) => { this.projectsSummary = data; this.cdr.detectChanges(); },
    });

    this.api.getRecentSessions(10).subscribe({
      next: (data) => { this.recentSessions = data; this.cdr.detectChanges(); },
    });

    this.api.getRecentIntakes(10).subscribe({
      next: (data) => { this.recentIntakes = data; this.cdr.detectChanges(); },
    });

    this.api.getAgentActivity().subscribe({
      next: (data) => { this.agentActivity = data; this.cdr.detectChanges(); },
    });

    this.api.getEventsTimeline(14).subscribe({
      next: (data) => {
        this.eventsTimeline = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); },
    });
  }

  onDateChange() {
    this.loadAll();
  }

  maxTimelineCount(): number {
    return Math.max(1, ...this.eventsTimeline.map(e => e.count));
  }

  statusCls(s: string) {
    return `badge badge-status-${s.toLowerCase()}`;
  }

  sevCls(s: string) {
    return { CRITICAL: 'sev-critical', HIGH: 'sev-high', MEDIUM: 'sev-medium', LOW: 'sev-low' }[s] ?? 'sev-medium';
  }
}
