import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Relative URL — proxied to http://localhost:8000 via proxy.conf.json
const BASE = '/api/v1';

export interface RepoConfig       { url: string; branch: string; }
export interface TechBadge        { label: string; cls: string; }
export interface ConfluenceSource { url: string; space_key: string; space_name: string; }

export interface FeatureItem {
  feature: string;
  description: string;
  repos: string[];
  key_files: string[];
  jira_epics: string[];
  selected?: boolean; // UI-only toggle
}

export interface SessionEvent {
  session_id: string;
  type: 'info' | 'tool_call' | 'draft_ready' | 'critic_feedback' | 'approved' | 'error' | 'completed' | 'user_message';
  agent: string;
  feature?: string;
  round?: number;
  message: string;
  timestamp: string;
}

export interface Session {
  id: string;
  project_id: string;
  depth: string;
  discovery_mode: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  repos: RepoConfig[];
  confluence_sources: ConfluenceSource[];
  tech_badges: TechBadge[];
  status: string;
  docs_count: number;
  last_generated?: string;
  agent_summary?: string;
  features: string[];
  feature_manifest: FeatureItem[];
  jira_url?: string;
  created_at: string;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  repos: RepoConfig[];
  confluence_sources: ConfluenceSource[];
}

export interface RepoValidationResult {
  valid: boolean;
  branches: string[];
  default_branch: string;
  repo_name: string;
  error?: string;
}

export interface ConfluenceValidationResult {
  valid: boolean;
  space_key: string;
  space_name: string;
  error?: string;
}

export interface DocVersion {
  content: string;
  saved_at: string;
}

export interface Intake {
  id: string;
  project_id: string;
  ticket_id: string;
  title: string;
  description: string;
  reporter: string;
  severity: string;
  guid?: string;
  status: string;  // PENDING | ANALYZING | ANALYZED | FAILED
  session_id: string;
  analysis?: any;
  created_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  session_id: string;
  feature: string;
  content: string;
  depth: string;
  approved: boolean;
  generated_at: string;
  versions: DocVersion[];
  ingestion_status?: string;  // none | pending | ingesting | completed | failed
  chunks_count?: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  // ── Dashboard ───────────────────────────────────────────────────────────────

  getDashboardStats(fromDate?: string, toDate?: string): Observable<any> {
    let params: any = {};
    if (fromDate) params.from_date = fromDate;
    if (toDate) params.to_date = toDate;
    return this.http.get(`${BASE}/dashboard/stats`, { params });
  }

  getProjectsSummary(): Observable<any[]> {
    return this.http.get<any[]>(`${BASE}/dashboard/projects-summary`);
  }

  getRecentSessions(limit = 10): Observable<any[]> {
    return this.http.get<any[]>(`${BASE}/dashboard/recent-sessions`, { params: { limit } });
  }

  getRecentIntakes(limit = 10): Observable<any[]> {
    return this.http.get<any[]>(`${BASE}/dashboard/recent-intakes`, { params: { limit } });
  }

  getAgentActivity(): Observable<any[]> {
    return this.http.get<any[]>(`${BASE}/dashboard/agent-activity`);
  }

  getEventsTimeline(days = 14): Observable<any[]> {
    return this.http.get<any[]>(`${BASE}/dashboard/events-timeline`, { params: { days } });
  }

  // ── Projects ────────────────────────────────────────────────────────────────

  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(`${BASE}/projects/`);
  }

  getProject(id: string): Observable<Project> {
    return this.http.get<Project>(`${BASE}/projects/${id}`);
  }

  // added alias so session-history can call it unambiguously
  fetchProject(id: string): Observable<Project> {
    return this.http.get<Project>(`${BASE}/projects/${id}`);
  }

  createProject(body: ProjectCreate): Observable<Project> {
    return this.http.post<Project>(`${BASE}/projects/`, body);
  }

  deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/projects/${id}`);
  }

  validateRepo(url: string): Observable<RepoValidationResult> {
    return this.http.post<RepoValidationResult>(`${BASE}/projects/validate-repo`, { url });
  }

  validateConfluence(url: string): Observable<ConfluenceValidationResult> {
    return this.http.post<ConfluenceValidationResult>(`${BASE}/projects/validate-confluence`, { url });
  }

  // ── Sessions ──────────────────────────────────────────────────────────────

  generateDocs(projectId: string, depth: string, discoveryMode: string): Observable<{ session_id: string }> {
    return this.http.post<{ session_id: string }>(`${BASE}/sessions/generate`, {
      project_id: projectId,
      depth,
      discovery_mode: discoveryMode,
    });
  }

  confirmFeatures(sessionId: string, features: FeatureItem[], userMessage: string): Observable<void> {
    return this.http.post<void>(`${BASE}/sessions/${sessionId}/confirm-features`, {
      features: features.map(f => ({ ...f })),
      user_message: userMessage,
    });
  }

  getProjectSessions(projectId: string): Observable<Session[]> {
    return this.http.get<Session[]>(`${BASE}/sessions/project/${projectId}`);
  }

  sendSessionMessage(sessionId: string, message: string): Observable<void> {
    return this.http.post<void>(`${BASE}/sessions/${sessionId}/message`, { message });
  }

  openSessionStream(sessionId: string): EventSource {
    return new EventSource(`/api/v1/sessions/${sessionId}/stream`);
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  getProjectDocs(projectId: string): Observable<Document[]> {
    return this.http.get<Document[]>(`${BASE}/documents/project/${projectId}`);
  }

  getDoc(docId: string): Observable<Document> {
    return this.http.get<Document>(`${BASE}/documents/${docId}`);
  }

  saveDocEdit(docId: string, content: string): Observable<Document> {
    return this.http.patch<Document>(`${BASE}/documents/${docId}`, { content });
  }

  resetDocEdit(docId: string): Observable<Document> {
    return this.http.post<Document>(`${BASE}/documents/${docId}/reset`, {});
  }

  approveDoc(docId: string): Observable<{ message: string; doc_id: string }> {
    return this.http.patch<{ message: string; doc_id: string }>(`${BASE}/documents/${docId}/approve`, {});
  }

  getIngestionStatus(docId: string): Observable<{ doc_id: string; ingestion_status: string; chunks_count: number }> {
    return this.http.get<{ doc_id: string; ingestion_status: string; chunks_count: number }>(
      `${BASE}/documents/${docId}/ingestion-status`
    );
  }

  editDocWithAgent(docId: string, content: string, instruction: string): Observable<{ content: string }> {
    return this.http.post<{ content: string }>('http://localhost:8001/edit-doc', {
      doc_id: docId,
      content,
      instruction,
    });
  }

  // ── Intakes ─────────────────────────────────────────────────────────────────

  getProjectIntakes(projectId: string): Observable<Intake[]> {
    return this.http.get<Intake[]>(`${BASE}/intakes/project/${projectId}`);
  }

  getIntake(intakeId: string): Observable<Intake> {
    return this.http.get<Intake>(`${BASE}/intakes/${intakeId}`);
  }

  simulateIntake(body: { project_id: string; title: string; description: string; reporter?: string; severity?: string; guid?: string }): Observable<{ intake_id: string; session_id: string }> {
    return this.http.post<{ intake_id: string; session_id: string }>(`${BASE}/intakes/simulate`, body);
  }

  openIntakeStream(intakeId: string): EventSource {
    return new EventSource(`${BASE}/intakes/${intakeId}/stream`);
  }
}
