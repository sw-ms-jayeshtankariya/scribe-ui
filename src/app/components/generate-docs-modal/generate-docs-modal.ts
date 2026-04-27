import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-generate-docs-modal',
  imports: [FormsModule],
  templateUrl: './generate-docs-modal.html',
  styleUrl: './generate-docs-modal.scss',
})
export class GenerateDocsModal {
  @Input() projectName = '';
  @Output() close = new EventEmitter<void>();
  @Output() generate = new EventEmitter<{ depth: string; discoveryMode: string }>();

  depth: 'overview' | 'standard' | 'detailed' = 'standard';
  discoveryMode: 'auto' | 'jira-first' | 'code-first' = 'auto';

  depthOptions = [
    { id: 'overview',  label: 'Overview',  time: '~2 min',  cost: '~$0.05', desc: 'Quick feature inventory with 1-paragraph summaries. Scans directory structure and config files only. Minimal AI usage.' },
    { id: 'standard',  label: 'Standard',  time: '~5 min',  cost: '~$0.30', desc: 'Feature docs with workflow steps, inputs/outputs, business rules, and integration points. Reads key files.' },
    { id: 'detailed',  label: 'Detailed',  time: '~15 min', cost: '~$1.50', desc: 'Full deep-dive: every workflow parsed, call graphs traced, all API endpoints, DB queries, error paths, and UI interactions documented.' },
  ];

  discoveryOptions = [
    { id: 'auto',       label: 'Auto',        desc: 'Use JIRA Epic history if available, otherwise scan code.' },
    { id: 'jira-first', label: 'JIRA-first',  desc: 'Features from Epics & release history (recommended when JIRA is well-maintained).' },
    { id: 'code-first', label: 'Code-first',  desc: 'Scan repository structure to discover features (ignores JIRA).' },
  ];

  get selectedDepth() { return this.depthOptions.find(d => d.id === this.depth)!; }
  get generateLabel() { return `Generate ${this.selectedDepth.label}`; }

  onGenerate() {
    this.generate.emit({ depth: this.depth, discoveryMode: this.discoveryMode });
  }
}
