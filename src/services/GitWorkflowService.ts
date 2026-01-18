/**
 * Git Workflow Enhancement Service
 * Visual merge conflict resolution, AI commit messages, PR review assistant
 * Production-ready with multiple git providers integration
 */

export interface GitConfig {
  provider: 'github' | 'gitlab' | 'bitbucket' | 'azure-devops';
  token: string;
  repository: string;
  branch: string;
}

export interface MergeConflict {
  file: string;
  conflicts: ConflictBlock[];
  status: 'unresolved' | 'resolved';
}

export interface ConflictBlock {
  id: string;
  startLine: number;
  endLine: number;
  currentVersion: string;
  incomingVersion: string;
  baseVersion?: string;
  resolution?: 'current' | 'incoming' | 'both' | 'custom';
  customResolution?: string;
}

export interface CommitSuggestion {
  type: 'feat' | 'fix' | 'docs' | 'style' | 'refactor' | 'test' | 'chore';
  scope?: string;
  subject: string;
  body: string;
  breaking?: boolean;
  issues?: string[];
  confidence: number;
}

export interface PRReviewSuggestion {
  reviewers: string[];
  labels: string[];
  riskyChanges: RiskyChange[];
  suggestedTests: string[];
  checklistItems: string[];
}

export interface RiskyChange {
  file: string;
  line: number;
  reason: string;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

export class GitWorkflowService {
  private apiKey: string;
  private config?: GitConfig;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || localStorage.getItem('geminiApiKey') || '';
  }

  configure(config: GitConfig): void {
    this.config = config;
  }

  /**
   * Detect and parse merge conflicts
   */
  async detectConflicts(filePath: string, content: string): Promise<MergeConflict | null> {
    const conflictMarkers = {
      current: '<<<<<<< HEAD',
      separator: '=======',
      incoming: '>>>>>>>',
    };

    const conflicts: ConflictBlock[] = [];
    const lines = content.split('\n');
    
    let inConflict = false;
    let currentBlock: Partial<ConflictBlock> = {};
    let currentLines: string[] = [];
    let incomingLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith(conflictMarkers.current)) {
        inConflict = true;
        currentBlock = {
          id: `conflict-${i}`,
          startLine: i + 1,
        };
        currentLines = [];
        continue;
      }

      if (line.startsWith(conflictMarkers.separator) && inConflict) {
        currentBlock.currentVersion = currentLines.join('\n');
        currentLines = [];
        continue;
      }

      if (line.startsWith(conflictMarkers.incoming) && inConflict) {
        currentBlock.incomingVersion = currentLines.join('\n');
        currentBlock.endLine = i + 1;
        conflicts.push(currentBlock as ConflictBlock);
        inConflict = false;
        currentBlock = {};
        currentLines = [];
        continue;
      }

      if (inConflict) {
        currentLines.push(line);
      }
    }

    if (conflicts.length === 0) {
      return null;
    }

    return {
      file: filePath,
      conflicts,
      status: 'unresolved',
    };
  }

  /**
   * Resolve merge conflict with AI assistance
   */
  async resolveConflict(conflict: MergeConflict): Promise<string> {
    const prompt = `Analyze this merge conflict and suggest the best resolution:

File: ${conflict.file}

${conflict.conflicts.map((block, idx) => `
Conflict ${idx + 1}:
Current Version (HEAD):
${block.currentVersion}

Incoming Version:
${block.incomingVersion}
`).join('\n')}

Provide:
1. Analysis of what changed
2. Recommended resolution strategy
3. Merged code (production-ready)

Output only the resolved code, no explanations.`;

    const response = await this.callAI(prompt);
    return response.replace(/```[\w]*\n?/g, '').trim();
  }

  /**
   * Generate AI-powered commit message
   */
  async generateCommitMessage(changes: Array<{ file: string; diff: string }>): Promise<CommitSuggestion> {
    const diffSummary = changes.map(c => `${c.file}:\n${c.diff}`).join('\n\n');

    const prompt = `Generate a conventional commit message for these changes:

${diffSummary}

Format: <type>(<scope>): <subject>

Rules:
- type: feat, fix, docs, style, refactor, test, chore
- subject: imperative mood, lowercase, no period
- body: explain what and why
- breaking: note breaking changes

Return JSON: { "type": "", "scope": "", "subject": "", "body": "", "breaking": false }`;

    const response = await this.callAI(prompt);
    
    try {
      const parsed = JSON.parse(response.replace(/```json\n?|\n?```/g, ''));
      return {
        ...parsed,
        confidence: this.calculateCommitConfidence(changes, parsed),
      };
    } catch {
      return this.fallbackCommitMessage(changes);
    }
  }

  /**
   * Analyze PR and suggest reviewers
   */
  async analyzePR(changes: Array<{ file: string; additions: number; deletions: number; diff: string }>): Promise<PRReviewSuggestion> {
    const filesChanged = changes.map(c => c.file).join(', ');
    const totalChanges = changes.reduce((sum, c) => sum + c.additions + c.deletions, 0);

    const prompt = `Analyze this Pull Request:

Files: ${filesChanged}
Total Changes: ${totalChanges} lines

Diff Summary:
${changes.map(c => `${c.file}: +${c.additions} -${c.deletions}`).join('\n')}

${changes.slice(0, 3).map(c => `\nFile: ${c.file}\n${c.diff.substring(0, 500)}`).join('\n')}

Provide:
1. Risky changes that need careful review
2. Suggested test coverage
3. Review checklist items
4. Recommended labels

Return JSON with: riskyChanges[], suggestedTests[], checklistItems[], labels[]`;

    const response = await this.callAI(prompt);
    
    try {
      const parsed = JSON.parse(response.replace(/```json\n?|\n?```/g, ''));
      return {
        reviewers: await this.suggestReviewers(changes),
        ...parsed,
      };
    } catch {
      return this.fallbackPRAnalysis(changes);
    }
  }

  /**
   * Suggest reviewers based on file ownership and expertise
   */
  private async suggestReviewers(changes: Array<{ file: string }>): Promise<string[]> {
    if (!this.config) return [];

    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.config.repository}/commits`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      const commits = await response.json();
      const fileAuthors = new Map<string, Map<string, number>>();

      for (const change of changes) {
        const fileCommits = commits.filter((c: any) => 
          c.files?.some((f: any) => f.filename === change.file)
        );

        const authors = new Map<string, number>();
        fileCommits.forEach((c: any) => {
          const author = c.author?.login;
          if (author) {
            authors.set(author, (authors.get(author) || 0) + 1);
          }
        });

        fileAuthors.set(change.file, authors);
      }

      const reviewerScores = new Map<string, number>();
      fileAuthors.forEach(authors => {
        authors.forEach((count, author) => {
          reviewerScores.set(author, (reviewerScores.get(author) || 0) + count);
        });
      });

      return Array.from(reviewerScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([author]) => author);
    } catch {
      return [];
    }
  }

  /**
   * Enforce branch strategy
   */
  validateBranchStrategy(branchName: string, strategy: 'gitflow' | 'github-flow' | 'gitlab-flow'): { valid: boolean; message?: string } {
    const patterns = {
      'gitflow': /^(feature|bugfix|hotfix|release)\/[\w-]+$/,
      'github-flow': /^[\w-]+$/,
      'gitlab-flow': /^(feature|production|pre-production)\/[\w-]+$/,
    };

    const pattern = patterns[strategy];
    const valid = pattern.test(branchName);

    if (!valid) {
      return {
        valid: false,
        message: `Branch name "${branchName}" does not follow ${strategy} convention`,
      };
    }

    return { valid: true };
  }

  /**
   * Call AI for analysis
   */
  private async callAI(prompt: string): Promise<string> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  private calculateCommitConfidence(changes: any[], commit: any): number {
    let confidence = 0.5;
    
    if (commit.type && commit.subject) confidence += 0.3;
    if (commit.body) confidence += 0.1;
    if (changes.length < 10) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  private fallbackCommitMessage(changes: any[]): CommitSuggestion {
    return {
      type: 'chore',
      subject: `update ${changes.length} file(s)`,
      body: changes.map(c => `- ${c.file}`).join('\n'),
      confidence: 0.3,
    };
  }

  private fallbackPRAnalysis(changes: any[]): PRReviewSuggestion {
    return {
      reviewers: [],
      labels: ['needs-review'],
      riskyChanges: [],
      suggestedTests: ['Add unit tests for changed functionality'],
      checklistItems: ['Code review', 'Tests pass', 'Documentation updated'],
    };
  }
}
