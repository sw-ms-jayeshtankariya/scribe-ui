import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService, RepoValidationResult, ConfluenceValidationResult } from '../../services/api';

type ValidationState = 'idle' | 'checking' | 'valid' | 'invalid';

interface RepoEntry {
  url: string;
  branch: string;
  state: ValidationState;
  branches: string[];
  repoName: string;
  error: string;
  urlSubject: Subject<string>;
}

interface ConfluenceEntry {
  url: string;
  state: ValidationState;
  spaceKey: string;
  spaceName: string;
  error: string;
  urlSubject: Subject<string>;
}

@Component({
  selector: 'app-create-project',
  imports: [FormsModule, RouterLink],
  templateUrl: './create-project.html',
  styleUrl: './create-project.scss',
})
export class CreateProject {
  constructor(private api: ApiService, private router: Router) {}

  name = '';
  description = '';
  repos: RepoEntry[] = [this._newRepo()];
  confluenceSources: ConfluenceEntry[] = [];
  submitting = false;
  submitError = '';

  // ── Repo helpers ────────────────────────────────────────────────────────

  private _newRepo(): RepoEntry {
    const subject = new Subject<string>();
    const entry: RepoEntry = { url: '', branch: 'main', state: 'idle', branches: [], repoName: '', error: '', urlSubject: subject };
    subject.pipe(debounceTime(600), distinctUntilChanged()).subscribe(url => this._validateRepo(entry, url));
    return entry;
  }

  addRepo() { this.repos.push(this._newRepo()); }

  removeRepo(i: number) {
    if (this.repos.length > 1) {
      this.repos[i].urlSubject.complete();
      this.repos.splice(i, 1);
    }
  }

  onRepoUrlChange(entry: RepoEntry, url: string) {
    entry.url = url;
    if (!url.trim()) { entry.state = 'idle'; entry.branches = []; entry.error = ''; return; }
    entry.state = 'checking';
    entry.urlSubject.next(url);
  }

  private _validateRepo(entry: RepoEntry, url: string) {
    this.api.validateRepo(url).subscribe({
      next: (res: RepoValidationResult) => {
        if (res.valid) {
          entry.state = 'valid';
          entry.branches = res.branches;
          entry.repoName = res.repo_name;
          entry.branch = res.default_branch;
          entry.error = '';
        } else {
          entry.state = 'invalid';
          entry.branches = [];
          entry.error = res.error ?? 'No access to this repository.';
        }
      },
      error: () => { entry.state = 'invalid'; entry.error = 'Could not reach validation API.'; },
    });
  }

  // ── Confluence helpers ──────────────────────────────────────────────────

  private _newConfluence(): ConfluenceEntry {
    const subject = new Subject<string>();
    const entry: ConfluenceEntry = { url: '', state: 'idle', spaceKey: '', spaceName: '', error: '', urlSubject: subject };
    subject.pipe(debounceTime(700), distinctUntilChanged()).subscribe(url => this._validateConfluence(entry, url));
    return entry;
  }

  addConfluenceSource() { this.confluenceSources.push(this._newConfluence()); }

  removeConfluenceSource(i: number) {
    this.confluenceSources[i].urlSubject.complete();
    this.confluenceSources.splice(i, 1);
  }

  onConfluenceUrlChange(entry: ConfluenceEntry, url: string) {
    entry.url = url;
    if (!url.trim()) { entry.state = 'idle'; entry.spaceKey = ''; entry.spaceName = ''; entry.error = ''; return; }
    entry.state = 'checking';
    entry.urlSubject.next(url);
  }

  private _validateConfluence(entry: ConfluenceEntry, url: string) {
    this.api.validateConfluence(url).subscribe({
      next: (res: ConfluenceValidationResult) => {
        if (res.valid) {
          entry.state = 'valid';
          entry.spaceKey = res.space_key;
          entry.spaceName = res.space_name;
          entry.error = '';
        } else {
          entry.state = 'invalid';
          entry.error = res.error ?? 'No access to this Confluence space.';
        }
      },
      error: () => { entry.state = 'invalid'; entry.error = 'Could not reach validation API.'; },
    });
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  get canSubmit(): boolean {
    return (
      !!this.name.trim() &&
      this.repos.length > 0 &&
      this.repos.every(r => r.state === 'valid') &&
      !this.submitting
    );
  }

  onSubmit() {
    if (!this.canSubmit) return;
    this.submitting = true;
    this.submitError = '';

    this.api.createProject({
      name: this.name.trim(),
      description: this.description.trim() || undefined,
      repos: this.repos.map(r => ({ url: r.url, branch: r.branch })),
      confluence_sources: this.confluenceSources
        .filter(c => c.state === 'valid')
        .map(c => ({ url: c.url, space_key: c.spaceKey, space_name: c.spaceName })),
    }).subscribe({
      next: () => this.router.navigate(['/projects']),
      error: (e) => {
        this.submitError = e?.error?.detail ?? 'Failed to create project. Please try again.';
        this.submitting = false;
      },
    });
  }
}
