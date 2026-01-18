import { ProjectAnalysis, ProjectIssue } from '../types/ProjectAnalysis';

type IssueSource = 'project-analyzer' | 'multi-agent' | 'manual';

export interface IssueRegistrySnapshot {
  sources: Partial<Record<IssueSource, ProjectAnalysis>>;
  combinedIssues: Map<string, ProjectIssue[]>;
  lastUpdated: number;
}

type IssueRegistryListener = (snapshot: IssueRegistrySnapshot) => void;

class IssueRegistry {
  private analyses: Map<IssueSource, ProjectAnalysis> = new Map();
  private listeners: Set<IssueRegistryListener> = new Set();
  private lastUpdated = 0;

  public setAnalysis(source: IssueSource, analysis: ProjectAnalysis): void {
    this.analyses.set(source, JSON.parse(JSON.stringify(analysis)) as ProjectAnalysis);
    this.lastUpdated = Date.now();
    this.notify();
  }

  public clear(source: IssueSource): void {
    if (this.analyses.delete(source)) {
      this.lastUpdated = Date.now();
      this.notify();
    }
  }

  public getAnalysis(source: IssueSource): ProjectAnalysis | undefined {
    const analysis = this.analyses.get(source);
    return analysis ? JSON.parse(JSON.stringify(analysis)) as ProjectAnalysis : undefined;
  }

  public getSnapshot(): IssueRegistrySnapshot {
    const sources: Partial<Record<IssueSource, ProjectAnalysis>> = {};
    this.analyses.forEach((analysis, source) => {
      sources[source] = JSON.parse(JSON.stringify(analysis)) as ProjectAnalysis;
    });

    return {
      sources,
      combinedIssues: this.combineIssuesByFile(sources),
      lastUpdated: this.lastUpdated,
    };
  }

  public subscribe(listener: IssueRegistryListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('[IssueRegistry] Listener error:', error);
      }
    });
  }

  private combineIssuesByFile(sources: Partial<Record<IssueSource, ProjectAnalysis>>): Map<string, ProjectIssue[]> {
    const combined = new Map<string, ProjectIssue[]>();

    Object.values(sources).forEach((analysis) => {
      if (!analysis) {
        return;
      }
      analysis.issues.forEach((issue) => {
        const key = `${issue.file}#${issue.line}`;
        if (!combined.has(key)) {
          combined.set(key, []);
        }
        combined.get(key)!.push(issue);
      });
    });

    return combined;
  }
}

export const issueRegistry = new IssueRegistry();
