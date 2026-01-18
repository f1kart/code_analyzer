export interface ProjectIssue {
  id: string;
  file: string;
  line: number;
  type:
    | 'todo'
    | 'placeholder'
    | 'mock'
    | 'debug'
    | 'incomplete'
    | 'dependency'
    | 'feature'
    | 'warning'
    | 'error'
    | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  suggestion?: string;
  codeSnippet?: string;
  aiExplanation?: string;
}

export interface ProjectIssueCategoryTotals {
  todos: number;
  placeholders: number;
  mocks: number;
  debug: number;
  incomplete: number;
  dependencies: number;
  features: number;
}

export interface ProjectAnalysis {
  totalFiles: number;
  issuesFound: number;
  issues: ProjectIssue[];
  categories: ProjectIssueCategoryTotals;
  codeCoverage: number;
  testCoverage: number;
  documentation: number;
  errorHandling: number;
  criticalIssues: ProjectIssue[];
  implementedFeatures: string[];
  missingFeatures: string[];
}
