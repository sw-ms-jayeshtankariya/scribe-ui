import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface CostRow { project: string; runs: number; tokens: string; cost: string; }
interface AgentRow { name: string; calls: number; avgTokens: number; avgDuration: string; filesScanned: number; totalCost: string; }
interface RunRow { id: string; project: string; depth: string; status: string; duration: string; agentCalls: number; files: number; features: number; cost: string; }

@Component({
  selector: 'app-admin-dashboard',
  imports: [FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard {
  fromDate = '';
  toDate = '';
  totalQueries = 48;

  summaryStats = { runs: 83, cost: '$17.9010', tokens: '2.2M' };

  costByProject: CostRow[] = [
    { project: 'UI Path - RPA', runs: 11, tokens: '1.8M', cost: '$17.4858' },
    { project: 'Backhaul CDR', runs: 2, tokens: '75.2K', cost: '$0.2600' },
    { project: 'Load Balancer', runs: 11, tokens: '173.7K', cost: '$0.1368' },
    { project: 'ISE', runs: 6, tokens: '22.3K', cost: '$0.0095' },
    { project: 'MagentaMOP', runs: 53, tokens: '3.5K', cost: '$0.0000' },
  ];

  agentPerformance: AgentRow[] = [
    { name: 'uipath_discovery', calls: 102, avgTokens: 2523, avgDuration: '1m 40s', filesScanned: 160, totalCost: '$94.565' },
    { name: 'uipath_extractor', calls: 302, avgTokens: 1012, avgDuration: '-', filesScanned: 460, totalCost: '$2.1206' },
    { name: 'prometheus_extractor', calls: 52, avgTokens: 1424, avgDuration: '-', filesScanned: 10, totalCost: '$0.4053' },
    { name: 'feature_discovery', calls: 2, avgTokens: 14973, avgDuration: '-', filesScanned: 0, totalCost: '$0.0095' },
    { name: 'prometheus_discovery', calls: 107, avgTokens: 1377, avgDuration: '-', filesScanned: 18, totalCost: '$0.0000' },
    { name: 'technical_extractor', calls: 2, avgTokens: 20929, avgDuration: '-', filesScanned: 0, totalCost: '$0.0000' },
    { name: 'business_rewriter', calls: 2, avgTokens: 5934, avgDuration: '-', filesScanned: 0, totalCost: '$0.0000' },
    { name: 'discovery', calls: 1, avgTokens: 3210, avgDuration: '-', filesScanned: 0, totalCost: '$0.0000' },
  ];

  recentRuns: RunRow[] = [
    { id: 'run_20260409_ISE01', project: 'ISE', depth: 'STANDARD', status: 'completed', duration: '78.5min', agentCalls: 67, files: 11, features: 7, cost: '$0.0143' },
    { id: 'run_20260409_ISE02', project: 'ISE', depth: 'STANDARD', status: 'completed', duration: '2.7min', agentCalls: 0, files: 59, features: 0, cost: '$0.0000' },
    { id: 'run_20260415_MOP01', project: 'MagentaMOP', depth: 'RELEASE', status: 'completed', duration: '20.6min', agentCalls: 47, files: 17, features: 4, cost: '$0.0143' },
    { id: 'run_20260415_MOP02', project: 'MagentaMOP', depth: 'RELEASE', status: 'running', duration: '-', agentCalls: 0, files: 0, features: 0, cost: '$0.0000' },
    { id: 'run_20260415_MOP03', project: 'MagentaMOP', depth: 'RELEASE', status: 'pending', duration: '-', agentCalls: 0, files: 0, features: 0, cost: '$0.0000' },
  ];

  topQuestions = [
    { q: 'A difference between question A, B, or...', count: 32 },
    { q: 'Implementation Plan date required?', count: 24 },
    { q: 'Is Sentinel date required?', count: 19 },
    { q: 'How can I extend MOP lifespan?', count: 15 },
    { q: 'What are Secure MOP triggers?', count: 12 },
  ];

  statusCls(s: string) { return `badge badge-status-${s}`; }
}
