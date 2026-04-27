import {
  Component, OnInit, OnDestroy, AfterViewChecked,
  ChangeDetectorRef, NgZone, ViewChild, ElementRef,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ApiService, Session, SessionEvent, FeatureItem } from '../../services/api';
import { GenerateDocsModal } from '../../components/generate-docs-modal/generate-docs-modal';
import { Router } from '@angular/router';

@Component({
  selector: 'app-session-history',
  imports: [RouterLink, FormsModule, DatePipe, GenerateDocsModal],
  templateUrl: './session-history.html',
  styleUrl: './session-history.scss',
})
export class SessionHistory implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('logFeed') logFeedRef!: ElementRef<HTMLDivElement>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
  ) {}

  projectId = '';
  projectName = '';
  sessions: Session[] = [];
  activeSession: Session | null = null;
  events: SessionEvent[] = [];
  loadingSessions = true;
  userInput = '';
  sendingMessage = false;
  showGenerateModal = false;

  // Feature confirmation state (AWAITING_CONFIRMATION phase)
  featureManifest: (FeatureItem & { selected: boolean })[] = [];
  confirmInstruction = '';
  confirmingFeatures = false;

  private _es: EventSource | null = null;
  private _shouldScrollBottom = false;
  private _activeSessionId = '';

  get isRunning(): boolean {
    return ['discovering', 'generating'].includes(
      (this.activeSession?.status ?? '').toLowerCase()
    );
  }

  get isAwaitingConfirmation(): boolean {
    return (this.activeSession?.status ?? '').toLowerCase() === 'awaiting_confirmation';
  }

  get isCompleted(): boolean {
    return this.activeSession?.status?.toLowerCase() === 'completed'
      || this.events.some(e => e.type === 'completed');
  }

  get completionEvent(): SessionEvent | undefined {
    return this.events.find(e => e.type === 'completed');
  }

  get docsApproved(): number {
    return this.events.filter(e => e.type === 'approved').length;
  }

  get selectedFeaturesCount(): number {
    return this.featureManifest.filter(f => f.selected).length;
  }

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
    this.projectName = this.projectId.toUpperCase();

    this.route.queryParamMap.subscribe(params => {
      const sid = params.get('sid');
      this._loadSessions(sid ?? undefined);
    });
  }

  ngAfterViewChecked() {
    if (this._shouldScrollBottom) {
      this._scrollToBottom();
      this._shouldScrollBottom = false;
    }
  }

  ngOnDestroy() { this._closeStream(); }

  private _loadSessions(autoSelectId?: string) {
    this.loadingSessions = true;
    this.api.getProjectSessions(this.projectId).subscribe({
      next: (sessions) => {
        this.zone.run(() => {
          this.sessions = sessions;
          this.loadingSessions = false;
          const target = autoSelectId
            ? sessions.find(s => s.id === autoSelectId) ?? sessions[0]
            : sessions[0];
          if (target) this.selectSession(target);
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.zone.run(() => { this.loadingSessions = false; this.cdr.detectChanges(); });
      },
    });
  }

  selectSession(session: Session) {
    if (this._activeSessionId === session.id) return;
    this._closeStream();
    this.activeSession = session;
    this._activeSessionId = session.id;
    this.events = [];
    this.featureManifest = [];
    this.confirmInstruction = '';
    this._openStream(session.id);
    // If already awaiting confirmation, fetch the project for its feature_manifest
    if (session.status?.toLowerCase() === 'awaiting_confirmation') {
      this._loadFeatureManifest(session.project_id);
    }
    this.cdr.detectChanges();
  }

  private _loadFeatureManifest(projectId: string) {
    this.api.fetchProject(projectId).subscribe({
      next: (project) => {
        this.zone.run(() => {
          this.featureManifest = (project.feature_manifest ?? []).map(f => ({ ...f, selected: true }));
          this.cdr.detectChanges();
        });
      },
    });
  }

  private _openStream(sessionId: string) {
    this._es = this.api.openSessionStream(sessionId);

    this._es.onmessage = (ev) => {
      try {
        const event: SessionEvent = JSON.parse(ev.data);
        this.zone.run(() => {
          this.events.push(event);
          this._shouldScrollBottom = true;
          // When Phase 1 finishes load the feature manifest for confirmation
          if (event.type === 'info' && event.message?.includes('Awaiting user confirmation')) {
            const sid = this.activeSession?.id;
            if (sid) {
              const s = this.sessions.find(x => x.id === sid);
              if (s) s.status = 'awaiting_confirmation';
              this.activeSession = { ...this.activeSession!, status: 'awaiting_confirmation' };
              this._loadFeatureManifest(this.activeSession!.project_id);
            }
          }
          // Update session status in sidebar on completion/error
          if (event.type === 'completed' || event.type === 'error') {
            const s = this.sessions.find(x => x.id === sessionId);
            if (s) s.status = event.type === 'completed' ? 'completed' : 'error';
            if (this.activeSession?.id === sessionId) {
              this.activeSession = { ...this.activeSession!, status: s?.status ?? this.activeSession!.status };
            }
          }
          this.cdr.detectChanges();
        });
      } catch {}
    };

    this._es.onerror = () => {
      // Connection closed by server (normal at end of stream) — no action needed
      this._es?.close();
    };
  }

  private _closeStream() {
    this._es?.close();
    this._es = null;
    this._activeSessionId = '';
  }

  private _scrollToBottom() {
    try {
      const el = this.logFeedRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  confirmFeatures() {
    if (!this.activeSession) return;
    this.confirmingFeatures = true;
    const selected = this.featureManifest.filter(f => f.selected).map(({ selected: _, ...f }) => f);
    this.api.confirmFeatures(this.activeSession.id, selected, this.confirmInstruction).subscribe({
      next: () => {
        this.zone.run(() => {
          this.confirmingFeatures = false;
          this.featureManifest = [];
          if (this.activeSession) {
            this.activeSession = { ...this.activeSession, status: 'generating' };
            const s = this.sessions.find(x => x.id === this.activeSession!.id);
            if (s) s.status = 'generating';
          }
          this.cdr.detectChanges();
        });
      },
      error: () => { this.zone.run(() => { this.confirmingFeatures = false; this.cdr.detectChanges(); }); },
    });
  }

  sendMessage() {
    const msg = this.userInput.trim();
    if (!msg || !this.activeSession) return;
    this.sendingMessage = true;
    this.api.sendSessionMessage(this.activeSession.id, msg).subscribe({
      next: () => {
        this.zone.run(() => { this.userInput = ''; this.sendingMessage = false; this.cdr.detectChanges(); });
      },
      error: () => { this.zone.run(() => { this.sendingMessage = false; this.cdr.detectChanges(); }); },
    });
  }

  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) this.sendMessage();
  }

  onGenerate(event: { depth: string; discoveryMode: string }) {
    this.showGenerateModal = false;
    this.api.generateDocs(this.projectId, event.depth, event.discoveryMode).subscribe({
      next: (res) => {
        this.zone.run(() => {
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { sid: res.session_id },
            queryParamsHandling: 'merge',
          });
        });
      },
    });
  }

  tagClass(type: string): string {
    return {
      info: 'tag-agent',
      tool_call: 'tag-tool',
      draft_ready: 'tag-draft',
      critic_feedback: 'tag-critic',
      approved: 'tag-approved',
      error: 'tag-error',
      completed: 'tag-completed',
      user_message: 'tag-user',
    }[type] ?? 'tag-agent';
  }

  tagLabel(type: string, agent: string): string {
    if (type === 'user_message') return 'YOU';
    if (type === 'tool_call') return 'TOOL';
    if (type === 'critic_feedback') return 'CRITIC';
    if (type === 'draft_ready') return 'DRAFT';
    if (type === 'approved') return '✓ APPROVED';
    if (type === 'error') return 'ERROR';
    if (type === 'completed') return 'DONE';
    return agent.toUpperCase();
  }

  formatTime(ts: string): string {
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
    catch { return ts; }
  }

  statusLabel(s: string): string {
    return { discovering: 'Discovering', generating: 'Generating', awaiting_confirmation: 'Awaiting Input',
             completed: 'Completed', error: 'Error', aborted: 'Aborted' }[s.toLowerCase()] ?? s;
  }
}
