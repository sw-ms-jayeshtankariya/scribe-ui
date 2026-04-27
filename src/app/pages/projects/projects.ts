import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { ApiService, Project } from '../../services/api';
import { GenerateDocsModal } from '../../components/generate-docs-modal/generate-docs-modal';

@Component({
  selector: 'app-projects',
  imports: [RouterLink, GenerateDocsModal, SlicePipe],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
})
export class Projects implements OnInit, OnDestroy {
  constructor(private api: ApiService, private cdr: ChangeDetectorRef, private zone: NgZone, private router: Router) {}

  projects: Project[] = [];
  loading = true;
  error = '';
  showGenerateModal = false;
  selectedProject: Project | null = null;

  private _pollTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.loadProjects();
  }

  ngOnDestroy() {
    this._stopPolling();
  }

  loadProjects() {
    this.loading = true;
    this.error = '';
    this.api.getProjects().subscribe({
      next: (data) => {
        this.zone.run(() => {
          this.projects = data;
          this.loading = false;
          this.cdr.detectChanges();
          this._managePoll();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.error = 'Could not load projects. Is scribe-api running?';
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  /** If any project is still PENDING or SCANNING, poll every 4s for updates. */
  private _managePoll() {
    const needsPoll = this.projects.some(p => p.status === 'PENDING' || p.status === 'SCANNING');
    if (needsPoll && !this._pollTimer) {
      this._pollTimer = setInterval(() => this._silentRefresh(), 4000);
    } else if (!needsPoll && this._pollTimer) {
      this._stopPolling();
    }
  }

  /** Refresh project list without showing the loading spinner. */
  private _silentRefresh() {
    this.api.getProjects().subscribe({
      next: (data) => {
        this.zone.run(() => {
          this.projects = data;
          this.cdr.detectChanges();
          this._managePoll();
        });
      },
    });
  }

  private _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  openGenerate(p: Project) { this.selectedProject = p; this.showGenerateModal = true; }

  onGenerate(event: { depth: string; discoveryMode: string }) {
    if (!this.selectedProject) return;
    this.showGenerateModal = false;
    const projectId = this.selectedProject.id;
    this.api.generateDocs(projectId, event.depth, event.discoveryMode).subscribe({
      next: (res) => {
        this.zone.run(() => {
          this.router.navigate(['/projects', projectId, 'session'], {
            queryParams: { sid: res.session_id },
          });
        });
      },
      error: () => alert('Could not start generation. Is scribe-api running?'),
    });
  }

  deleteProject(p: Project, event: Event) {
    event.stopPropagation();
    if (!confirm(`Delete project "${p.name}"? This cannot be undone.`)) return;
    this.api.deleteProject(p.id).subscribe({ next: () => this.loadProjects() });
  }

  statusLabel(s: string) {
    return { PENDING: 'Pending', SCANNING: 'Scanning…', READY: 'Ready', ERROR: 'Error',
             AWAITING_CONFIRMATION: 'Ready', DISCOVERING: 'Discovering…', GENERATING: 'Generating…' }[s] ?? s;
  }

  /** Returns a human-friendly scanning step message for the progress bar. */
  scanningHint(p: Project): string {
    if (p.status === 'PENDING') return 'Queued — waiting for agent…';
    if (p.status === 'SCANNING') return 'Agent is analyzing repositories and detecting tech stack…';
    return '';
  }
}
