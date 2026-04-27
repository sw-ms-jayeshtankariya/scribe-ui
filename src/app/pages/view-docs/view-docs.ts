import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ApiService, Document } from '../../services/api';

@Component({
  selector: 'app-view-docs',
  imports: [RouterLink, FormsModule],
  templateUrl: './view-docs.html',
  styleUrl: './view-docs.scss',
})
export class ViewDocs implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
  ) {}

  projectId = '';
  docs: Document[] = [];
  selectedIdx = 0;
  activeTab: 'business' | 'technical' = 'business';
  showDiff = false;
  loading = true;
  saving = false;
  approving = false;
  resetting = false;

  // Right panel — editor agent
  editorInstruction = '';
  editorLog: { role: 'user' | 'agent'; text: string }[] = [];
  editorRunning = false;

  get selectedDoc(): Document | null {
    return this.docs[this.selectedIdx] ?? null;
  }

  get hasPrevVersion(): boolean {
    return (this.selectedDoc?.versions?.length ?? 0) > 0;
  }

  get prevContent(): string {
    const v = this.selectedDoc?.versions;
    return v && v.length ? v[v.length - 1].content : '';
  }

  get currentContent(): string {
    return this.selectedDoc?.content ?? '';
  }

  get renderedCurrent(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(markdownToHtml(this.currentContent));
  }

  get renderedPrev(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(markdownToHtml(this.prevContent));
  }

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadDocs();
  }

  loadDocs() {
    this.loading = true;
    this.api.getProjectDocs(this.projectId).subscribe({
      next: (docs) => {
        this.docs = docs;
        this.selectedIdx = 0;
        this.loading = false;
        // Resume polling for any docs mid-ingestion
        docs.forEach((d, i) => {
          if (d.ingestion_status === 'pending' || d.ingestion_status === 'ingesting') {
            this._pollIngestion(d.id, i);
          }
        });
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  selectDoc(i: number) {
    this.selectedIdx = i;
    this.showDiff = false;
  }

  approveDoc() {
    if (!this.selectedDoc) return;
    this.approving = true;
    this.api.approveDoc(this.selectedDoc.id).subscribe({
      next: () => {
        this.docs[this.selectedIdx] = {
          ...this.selectedDoc!,
          approved: true,
          ingestion_status: 'pending',
        };
        this.approving = false;
        this._pollIngestion(this.selectedDoc!.id, this.selectedIdx);
        this.cdr.detectChanges();
      },
      error: () => { this.approving = false; this.cdr.detectChanges(); },
    });
  }

  /** Poll ingestion status every 2s until completed or failed. */
  private _pollIngestion(docId: string, docIdx: number) {
    const poll = setInterval(() => {
      this.api.getIngestionStatus(docId).subscribe({
        next: (res) => {
          if (this.docs[docIdx]) {
            this.docs[docIdx] = {
              ...this.docs[docIdx],
              ingestion_status: res.ingestion_status,
              chunks_count: res.chunks_count,
            };
            this.cdr.detectChanges();
          }
          if (res.ingestion_status === 'completed' || res.ingestion_status === 'failed') {
            clearInterval(poll);
          }
        },
        error: () => clearInterval(poll),
      });
    }, 2000);
    // Safety: stop polling after 60s
    setTimeout(() => clearInterval(poll), 60000);
  }

  resetEdits() {
    if (!this.selectedDoc || !this.hasPrevVersion) return;
    this.resetting = true;
    this.api.resetDocEdit(this.selectedDoc.id).subscribe({
      next: (updated) => {
        this.docs[this.selectedIdx] = updated;
        this.showDiff = false;
        this.resetting = false;
        this.cdr.detectChanges();
      },
      error: () => { this.resetting = false; this.cdr.detectChanges(); },
    });
  }

  sendEditorInstruction() {
    const instruction = this.editorInstruction.trim();
    if (!instruction || !this.selectedDoc || this.editorRunning) return;
    this.editorLog.push({ role: 'user', text: instruction });
    this.editorInstruction = '';
    this.editorRunning = true;
    this.cdr.detectChanges();

    this.api.editDocWithAgent(this.selectedDoc.id, this.selectedDoc.content, instruction).subscribe({
      next: (res) => {
        // Save the new content (old pushed to versions automatically)
        this.api.saveDocEdit(this.selectedDoc!.id, res.content).subscribe({
          next: (updated) => {
            this.docs[this.selectedIdx] = updated;
            this.editorLog.push({ role: 'agent', text: 'Document updated.' });
            this.editorRunning = false;
            this.cdr.detectChanges();
          },
          error: () => {
            this.editorLog.push({ role: 'agent', text: 'Could not save changes.' });
            this.editorRunning = false;
            this.cdr.detectChanges();
          },
        });
      },
      error: (err) => {
        const msg = err?.error?.detail ?? err?.message ?? 'Agent error.';
        this.editorLog.push({ role: 'agent', text: `Error: ${msg}` });
        this.editorRunning = false;
        this.cdr.detectChanges();
      },
    });
  }

  onEditorKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.sendEditorInstruction();
    }
  }
}

// ── Minimal markdown → HTML renderer ────────────────────────────────────────

function markdownToHtml(md: string): string {
  if (!md) return '';
  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;
  let inTable = false;
  let tableHeader = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Headings
    if (line.startsWith('# '))  { closeList(); out.push(`<h1>${inline(line.slice(2))}</h1>`); continue; }
    if (line.startsWith('## ')) { closeList(); out.push(`<h2>${inline(line.slice(3))}</h2>`); continue; }
    if (line.startsWith('### ')){ closeList(); out.push(`<h3>${inline(line.slice(4))}</h3>`); continue; }

    // Table rows
    if (line.startsWith('|')) {
      if (!inTable) { closeList(); inTable = true; tableHeader = true; out.push('<table>'); }
      const cells = line.split('|').filter((_, ci) => ci > 0 && ci < line.split('|').length - 1);
      if (/^[\s\-|]+$/.test(line)) { tableHeader = false; continue; } // separator row
      const tag = tableHeader ? 'th' : 'td';
      out.push(`<tr>${cells.map(c => `<${tag}>${inline(c.trim())}</${tag}>`).join('')}</tr>`);
      if (tableHeader) tableHeader = false;
      continue;
    } else if (inTable) { inTable = false; out.push('</table>'); }

    // Bullet list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }

    // Close list if needed
    if (inList && !line.startsWith('- ') && !line.startsWith('* ')) {
      out.push('</ul>'); inList = false;
    }

    // Blank line
    if (line.trim() === '') continue;

    // Paragraph
    out.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  if (inTable) out.push('</table>');
  return out.join('\n');

  function closeList() {
    if (inList) { out.push('</ul>'); inList = false; }
  }
}

function inline(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}
