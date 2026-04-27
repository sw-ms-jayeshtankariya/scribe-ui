import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ApiService, Intake, SessionEvent } from '../../services/api';

@Component({
  selector: 'app-intakes',
  imports: [RouterLink, FormsModule, DatePipe],
  templateUrl: './intakes.html',
  styleUrl: './intakes.scss',
})
export class Intakes implements OnInit, OnDestroy {
  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
  ) {}

  projectId = '';
  intakes: Intake[] = [];
  selectedIntake: Intake | null = null;
  events: SessionEvent[] = [];
  loading = true;
  showSimulateForm = false;

  // Simulate form
  simTitle = '';
  simDescription = '';
  simReporter = 'Customer Support';
  simSeverity = 'MEDIUM';
  simGuid = '';
  simulating = false;

  private _es: EventSource | null = null;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadIntakes();
  }

  ngOnDestroy() {
    this._closeStream();
    if (this._pollTimer) clearInterval(this._pollTimer);
  }

  loadIntakes() {
    this.loading = true;
    this.api.getProjectIntakes(this.projectId).subscribe({
      next: (data) => {
        this.zone.run(() => {
          this.intakes = data;
          this.loading = false;
          this._managePoll();
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.zone.run(() => { this.loading = false; this.cdr.detectChanges(); });
      },
    });
  }

  selectIntake(intake: Intake) {
    this._closeStream();
    this.selectedIntake = intake;
    this.events = [];

    if (intake.status === 'ANALYZING' || intake.status === 'PENDING') {
      this._openStream(intake.id);
    }
    this.cdr.detectChanges();
  }

  simulateIntake() {
    if (!this.simTitle.trim() || this.simulating) return;
    this.simulating = true;

    this.api.simulateIntake({
      project_id: this.projectId,
      title: this.simTitle.trim(),
      description: this.simDescription.trim(),
      reporter: this.simReporter.trim() || 'Customer Support',
      severity: this.simSeverity,
      guid: this.simGuid.trim() || undefined,
    }).subscribe({
      next: (res) => {
        this.zone.run(() => {
          this.simulating = false;
          this.showSimulateForm = false;
          this.simTitle = '';
          this.simDescription = '';
          this.simGuid = '';
          this.loadIntakes();
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.zone.run(() => { this.simulating = false; this.cdr.detectChanges(); });
      },
    });
  }

  severityClass(s: string): string {
    return { CRITICAL: 'sev-critical', HIGH: 'sev-high', MEDIUM: 'sev-medium', LOW: 'sev-low' }[s] ?? 'sev-medium';
  }

  statusLabel(s: string): string {
    return { PENDING: 'Pending', ANALYZING: 'Analyzing…', ANALYZED: 'Analyzed', FAILED: 'Failed' }[s] ?? s;
  }

  private _openStream(intakeId: string) {
    this._es = this.api.openIntakeStream(intakeId);
    this._es.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data);
        this.zone.run(() => {
          this.events.push(event);
          if (event.type === 'completed' || event.status === 'ANALYZED' || event.status === 'FAILED') {
            this._closeStream();
            this.loadIntakes();  // refresh to get final analysis
          }
          this.cdr.detectChanges();
        });
      } catch {}
    };
    this._es.onerror = () => { this._es?.close(); };
  }

  private _closeStream() {
    this._es?.close();
    this._es = null;
  }

  private _managePoll() {
    const needsPoll = this.intakes.some(i => i.status === 'PENDING' || i.status === 'ANALYZING');
    if (needsPoll && !this._pollTimer) {
      this._pollTimer = setInterval(() => {
        this.api.getProjectIntakes(this.projectId).subscribe({
          next: (data) => {
            this.zone.run(() => {
              this.intakes = data;
              // Update selected intake if it changed
              if (this.selectedIntake) {
                const updated = data.find(i => i.id === this.selectedIntake!.id);
                if (updated) this.selectedIntake = updated;
              }
              this._managePoll();
              this.cdr.detectChanges();
            });
          },
        });
      }, 5000);
    } else if (!needsPoll && this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }
}
