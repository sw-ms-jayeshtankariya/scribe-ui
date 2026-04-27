import { Component, EventEmitter, Output, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { ApiService, Project } from '../../services/api';
import { RoleService, AppRole } from '../../services/role.service';

interface ChunkDetail {
  id: string;
  feature: string;
  section: string;
  words: number;
}

interface AnswerMeta {
  chunks_retrieved: number;
  total_context_words: number;
  conversation_turn: number;
  history_turns_sent: number;
  retrieval_query: string;
  retrieval_time_ms: number;
  generation_time_ms: number;
  total_time_ms: number;
  model: string;
  role?: string;
  chunk_details: ChunkDetail[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: string[];
  confidence?: number;
  guardrail?: boolean;
  meta?: AnswerMeta;
}

@Component({
  selector: 'app-doc-assistant',
  imports: [FormsModule],
  templateUrl: './doc-assistant.html',
  styleUrl: './doc-assistant.scss',
})
export class DocAssistant implements OnInit, AfterViewChecked, OnDestroy {
  @Output() close = new EventEmitter<void>();
  @ViewChild('chatArea') chatAreaRef!: ElementRef<HTMLDivElement>;

  constructor(
    private api: ApiService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private roleService: RoleService,
  ) {}

  selectedProjectId = '';
  userInput = '';
  sending = false;
  loadingProjects = true;
  showDetails: Record<number, boolean> = {};
  currentRole: AppRole = 'REVIEWER';

  projects: Project[] = [];
  messages: ChatMessage[] = [];
  suggestions: string[] = [];
  loadingSuggestions = false;

  private _sessionId = '';
  private _shouldScroll = false;
  private _roleSub!: Subscription;

  get selectedProject(): Project | undefined {
    return this.projects.find(p => p.id === this.selectedProjectId);
  }

  get placeholder(): string {
    if (!this.selectedProjectId) return 'Select a project first';
    return `Ask about ${this.selectedProject?.name ?? ''}...`;
  }

  get turnCount(): number {
    return this.messages.filter(m => m.role === 'user').length;
  }

  ngOnInit() {
    this._roleSub = this.roleService.role$.subscribe(role => {
      this.currentRole = role;
      this.cdr.detectChanges();
    });

    this.api.getProjects().subscribe({
      next: (projects) => {
        this.projects = projects;
        this.loadingProjects = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingProjects = false;
        this.cdr.detectChanges();
      },
    });
  }

  ngAfterViewChecked() {
    if (this._shouldScroll) {
      this._scrollToBottom();
      this._shouldScroll = false;
    }
  }

  ngOnDestroy() {
    this._roleSub?.unsubscribe();
  }

  onProjectChange() {
    if (this._sessionId) {
      this.http.post('/agents-api/chat/clear', {
        project_id: this.selectedProjectId,
        query: '',
        session_id: this._sessionId,
      }).subscribe();
    }
    this.messages = [];
    this.showDetails = {};
    this.suggestions = [];
    this._sessionId = this._generateSessionId();

    // Fetch starter suggestions for the selected project
    if (this.selectedProjectId) {
      this.loadingSuggestions = true;
      this.cdr.detectChanges();
      this.http.post<{ suggestions: string[] }>('/agents-api/chat/suggestions', {
        project_id: this.selectedProjectId,
      }).subscribe({
        next: (res) => {
          this.suggestions = res.suggestions ?? [];
          this.loadingSuggestions = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.loadingSuggestions = false;
          this.cdr.detectChanges();
        },
      });
    }
  }

  clearConversation() {
    if (this._sessionId) {
      this.http.post('/agents-api/chat/clear', {
        project_id: this.selectedProjectId,
        query: '',
        session_id: this._sessionId,
      }).subscribe();
    }
    this.messages = [];
    this.showDetails = {};
    this._sessionId = this._generateSessionId();
    this.cdr.detectChanges();
  }

  useSuggestion(text: string) {
    this.userInput = text;
    this.sendMessage();
  }

  sendMessage() {
    const text = this.userInput.trim();
    if (!text || !this.selectedProjectId || this.sending) return;

    this.messages.push({ role: 'user', text });
    this.userInput = '';
    this.sending = true;
    this.suggestions = [];  // clear current suggestions while waiting
    this._shouldScroll = true;
    this.cdr.detectChanges();

    this.http.post<{
      answer: string;
      confidence: number;
      sources: string[];
      session_id: string;
      guardrail?: boolean;
      meta?: AnswerMeta;
      suggestions?: string[];
    }>('/agents-api/chat', {
      project_id: this.selectedProjectId,
      query: text,
      session_id: this._sessionId,
      role: this.currentRole,
    }).subscribe({
      next: (res) => {
        if (res.session_id) {
          this._sessionId = res.session_id;
        }
        this.messages.push({
          role: 'assistant',
          text: res.answer,
          sources: res.sources,
          confidence: res.confidence,
          guardrail: res.guardrail ?? false,
          meta: res.meta,
        });
        this.suggestions = res.suggestions ?? [];
        this.sending = false;
        this._shouldScroll = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.messages.push({
          role: 'assistant',
          text: 'Could not reach the Doc Assistant agent. Please check that scribe-agents is running.',
        });
        this.sending = false;
        this._shouldScroll = true;
        this.cdr.detectChanges();
      },
    });
  }

  toggleDetails(i: number) {
    this.showDetails[i] = !this.showDetails[i];
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  confidenceLevel(score: number): string {
    if (score >= 85) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  confidenceLabel(score: number): string {
    if (score >= 85) return 'High';
    if (score >= 50) return 'Medium';
    return 'Low';
  }

  roleLabel(role: string): string {
    return { REVIEWER: 'Reviewer', ENGINEER: 'Engineer', ADMIN: 'Admin' }[role] ?? role;
  }

  roleIcon(role: string): string {
    return { REVIEWER: '👁', ENGINEER: '🔧', ADMIN: '🔑' }[role] ?? '👤';
  }

  private _scrollToBottom() {
    try {
      const el = this.chatAreaRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  private _generateSessionId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    return `chat_${ts}_${rand}`;
  }
}
