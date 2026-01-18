import { aiWorkflowEngine } from './aiWorkflowEngine';
import { spawn } from 'child_process';

export interface GitRepository {
  path: string;
  name: string;
  branch: string;
  remotes: GitRemote[];
  status: GitStatus;
  config: GitConfig;
}

export interface GitRemote {
  name: string;
  url: string;
  type: 'fetch' | 'push';
}

export interface GitStatus {
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: string[];
  conflicted: string[];
  ahead: number;
  behind: number;
  clean: boolean;
}

export interface GitFileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
  staged: boolean;
  insertions: number;
  deletions: number;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: GitAuthor;
  committer: GitAuthor;
  message: string;
  timestamp: number;
  parents: string[];
  files: GitFileChange[];
  stats: {
    insertions: number;
    deletions: number;
    filesChanged: number;
  };
}

export interface GitAuthor {
  name: string;
  email: string;
  timestamp: number;
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  ahead: number;
  behind: number;
  lastCommit: GitCommit;
}

export interface GitConfig {
  user: {
    name: string;
    email: string;
  };
  core: {
    editor: string;
    autocrlf: boolean;
  };
  remote: Record<string, string>;
}

export interface GitDiff {
  filePath: string;
  oldPath?: string;
  hunks: GitDiffHunk[];
  isBinary: boolean;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
}

export interface GitDiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: GitDiffLine[];
}

export interface GitDiffLine {
  type: 'context' | 'addition' | 'deletion';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface AICommitSuggestion {
  message: string;
  type: 'feat' | 'fix' | 'docs' | 'style' | 'refactor' | 'test' | 'chore';
  scope?: string;
  description: string;
  confidence: number;
  reasoning: string;
}

export interface CodeReviewSuggestion {
  filePath: string;
  lineNumber: number;
  type: 'improvement' | 'bug' | 'security' | 'performance' | 'style';
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  message: string;
  suggestion: string;
  confidence: number;
}

export class GitIntegration {
  private repositories = new Map<string, GitRepository>();
  private currentRepo: GitRepository | null = null;

  // Repository Management
  async initRepository(path: string): Promise<GitRepository> {
    try {
      await this.executeGitCommand(['init'], path);
      return await this.openRepository(path);
    } catch (error) {
      throw new Error(`Failed to initialize repository: ${error}`);
    }
  }

  async openRepository(path: string): Promise<GitRepository> {
    try {
      const repo: GitRepository = {
        path,
        name: path.split('/').pop() || path,
        branch: await this.getCurrentBranch(path),
        remotes: await this.getRemotes(path),
        status: await this.getStatus(path),
        config: await this.getConfig(path),
      };

      this.repositories.set(path, repo);
      this.currentRepo = repo;
      return repo;
    } catch (error) {
      throw new Error(`Failed to open repository: ${error}`);
    }
  }

  async cloneRepository(
    url: string,
    path: string,
    options?: {
      branch?: string;
      depth?: number;
      recursive?: boolean;
    },
  ): Promise<GitRepository> {
    try {
      const args = ['clone'];

      if (options?.branch) {
        args.push('-b', options.branch);
      }
      if (options?.depth) {
        args.push('--depth', options.depth.toString());
      }
      if (options?.recursive) {
        args.push('--recursive');
      }

      args.push(url, path);

      await this.executeGitCommand(args);
      return await this.openRepository(path);
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error}`);
    }
  }

  // Status and Information
  async getStatus(repoPath?: string): Promise<GitStatus> {
    const path = repoPath || this.currentRepo?.path;
    if (!path) throw new Error('No repository selected');

    try {
      const statusOutput = await this.executeGitCommand(['status', '--porcelain=v1', '-b'], path);
      const status = this.parseStatusOutput(statusOutput);

      // Get ahead/behind info
      const branchInfo = await this.executeGitCommand(['status', '-b', '--porcelain'], path);
      const aheadBehind = this.parseAheadBehind(branchInfo);

      return {
        ...status,
        ...aheadBehind,
        clean:
          status.staged.length === 0 &&
          status.unstaged.length === 0 &&
          status.untracked.length === 0,
      };
    } catch (error) {
      throw new Error(`Failed to get status: ${error}`);
    }
  }

  async getBranches(repoPath?: string): Promise<GitBranch[]> {
    const path = repoPath || this.currentRepo?.path;
    if (!path) throw new Error('No repository selected');

    try {
      const branchOutput = await this.executeGitCommand(['branch', '-vv'], path);
      return this.parseBranchOutput(branchOutput, path);
    } catch (error) {
      throw new Error(`Failed to get branches: ${error}`);
    }
  }

  async getCommitHistory(options?: {
    limit?: number;
    branch?: string;
    author?: string;
    since?: string;
    until?: string;
    path?: string;
  }): Promise<GitCommit[]> {
    const path = this.currentRepo?.path;
    if (!path) throw new Error('No repository selected');

    try {
      const args = ['log', '--pretty=format:%H|%h|%an|%ae|%at|%cn|%ce|%ct|%P|%s', '--numstat'];

      if (options?.limit) {
        args.push(`-${options.limit}`);
      }
      if (options?.branch) {
        args.push(options.branch);
      }
      if (options?.author) {
        args.push(`--author=${options.author}`);
      }
      if (options?.since) {
        args.push(`--since=${options.since}`);
      }
      if (options?.until) {
        args.push(`--until=${options.until}`);
      }
      if (options?.path) {
        args.push('--', options.path);
      }

      const logOutput = await this.executeGitCommand(args, path);
      return this.parseLogOutput(logOutput);
    } catch (error) {
      throw new Error(`Failed to get commit history: ${error}`);
    }
  }

  async getDiff(options?: {
    staged?: boolean;
    commit?: string;
    path?: string;
    unified?: number;
  }): Promise<GitDiff[]> {
    const path = this.currentRepo?.path;
    if (!path) throw new Error('No repository selected');

    try {
      const args = ['diff'];

      if (options?.staged) {
        args.push('--staged');
      }
      if (options?.commit) {
        args.push(options.commit);
      }
      if (options?.unified) {
        args.push(`-U${options.unified}`);
      }

      args.push('--no-color', '--no-ext-diff');

      if (options?.path) {
        args.push('--', options.path);
      }

      const diffOutput = await this.executeGitCommand(args, path);
      return this.parseDiffOutput(diffOutput);
    } catch (error) {
      throw new Error(`Failed to get diff: ${error}`);
    }
  }

  // Staging and Committing
  async stageFiles(files: string[]): Promise<void> {
    const path = this.currentRepo?.path;
    if (!path) throw new Error('No repository selected');

    try {
      await this.executeGitCommand(['add', ...files], path);
    } catch (error) {
      throw new Error(`Failed to stage files: ${error}`);
    }
  }

  async unstageFiles(files: string[]): Promise<void> {
    const path = this.currentRepo?.path;
    if (!path) throw new Error('No repository selected');

    try {
      await this.executeGitCommand(['reset', 'HEAD', ...files], path);
    } catch (error) {
      throw new Error(`Failed to unstage files: ${error}`);
    }
  }

  async commit(
    message: string,
    options?: {
      amend?: boolean;
      signoff?: boolean;
      noVerify?: boolean;
    },
  ): Promise<string> {
    const path = this.currentRepo?.path;
    if (!path) throw new Error('No repository selected');

    try {
      const args = ['commit', '-m', message];

      if (options?.amend) {
        args.push('--amend');
      }
      if (options?.signoff) {
        args.push('--signoff');
      }
      if (options?.noVerify) {
        args.push('--no-verify');
      }

      const output = await this.executeGitCommand(args, path);
      const hashMatch = output.match(/\[.+\s([a-f0-9]+)\]/);
      return hashMatch ? hashMatch[1] : '';
    } catch (error) {
      throw new Error(`Failed to commit: ${error}`);
    }
  }

  // Branch Management
  async createBranch(name: string, startPoint?: string): Promise<void> {
    const path = this.currentRepo?.path;
    if (!path) throw new Error('No repository selected');

    try {
      const args = ['checkout', '-b', name];
      if (startPoint) {
        args.push(startPoint);
      }
      await this.executeGitCommand(args, path);
    } catch (error) {
      throw new Error(`Failed to create branch: ${error}`);
    }
  }

  async switchBranch(name: string): Promise<void> {
    const path = this.currentRepo?.path;
    if (!path) throw new Error('No repository selected');

    try {
      await this.executeGitCommand(['checkout', name], path);
      if (this.currentRepo) {
        this.currentRepo.branch = name;
      }
    } catch (error) {
      throw new Error(`Failed to switch branch: ${error}`);
    }
  }

  async deleteBranch(name: string, force = false): Promise<void> {
    const path = this.currentRepo?.path;
    if (!path) throw new Error('No repository selected');

    try {
      const args = ['branch', force ? '-D' : '-d', name];
      await this.executeGitCommand(args, path);
    } catch (error) {
      throw new Error(`Failed to delete branch: ${error}`);
    }
  }

  async mergeBranch(
    branch: string,
    options?: {
      noFastForward?: boolean;
      squash?: boolean;
      message?: string;
    },
  ): Promise<void> {
    const path = this.currentRepo?.path;
    if (!path) throw new Error('No repository selected');

    try {
      const args = ['merge'];

      if (options?.noFastForward) {
        args.push('--no-ff');
      }
      if (options?.squash) {
        args.push('--squash');
      }
      if (options?.message) {
        args.push('-m', options.message);
      }

      args.push(branch);
      await this.executeGitCommand(args, path);
    } catch (error) {
      throw new Error(`Failed to merge branch: ${error}`);
    }
  }

  // Remote Operations
  async fetch(remote = 'origin'): Promise<void> {
    const path = this.currentRepo?.path;
    if (!path) throw new Error('No repository selected');

    try {
      await this.executeGitCommand(['fetch', remote], path);
    } catch (error) {
      throw new Error(`Failed to fetch: ${error}`);
    }
  }

  async pull(remote = 'origin', branch?: string): Promise<void> {
    const path = this.currentRepo?.path;
    if (!path) throw new Error('No repository selected');

    try {
      const args = ['pull', remote];
      if (branch) {
        args.push(branch);
      }
      await this.executeGitCommand(args, path);
    } catch (error) {
      throw new Error(`Failed to pull: ${error}`);
    }
  }

  async push(
    remote = 'origin',
    branch?: string,
    options?: {
      force?: boolean;
      setUpstream?: boolean;
    },
  ): Promise<void> {
    const path = this.currentRepo?.path;
    if (!path) throw new Error('No repository selected');

    try {
      const args = ['push'];

      if (options?.force) {
        args.push('--force');
      }
      if (options?.setUpstream) {
        args.push('--set-upstream');
      }

      args.push(remote);
      if (branch) {
        args.push(branch);
      }

      await this.executeGitCommand(args, path);
    } catch (error) {
      throw new Error(`Failed to push: ${error}`);
    }
  }

  // AI-Powered Features
  async generateCommitMessage(_stagedFiles?: string[]): Promise<AICommitSuggestion[]> {
    const path = this.currentRepo?.path;
    if (!path) throw new Error('No repository selected');

    try {
      const diff = await this.getDiff({ staged: true });
      if (diff.length === 0) {
        throw new Error('No staged changes to analyze');
      }

      const diffText = this.formatDiffForAI(diff);

      const prompt = `Analyze these git changes and suggest commit messages following conventional commits format:

${diffText}

Generate 3 commit message suggestions with:
1. Type (feat, fix, docs, style, refactor, test, chore)
2. Optional scope
3. Clear, concise description
4. Confidence level (0-1)
5. Reasoning for the suggestion

Format as JSON array of objects with: message, type, scope, description, confidence, reasoning`;

      const agent = aiWorkflowEngine.getAllAgents()[0];
      if (!agent) {
        throw new Error('No AI agent available');
      }

      const session = await aiWorkflowEngine.runSequentialWorkflow(
        { userGoal: prompt, additionalContext: 'Git commit message generation' },
        [agent.id],
      );

      const result = this.parseAIResponse(session.result?.finalOutput || '[]');
      return Array.isArray(result) ? result : [result];
    } catch (error) {
      console.warn('AI commit message generation failed:', error);
      return [
        {
          message: 'Update files',
          type: 'chore',
          description: 'Update files with recent changes',
          confidence: 0.5,
          reasoning: 'Fallback message due to AI analysis failure',
        },
      ];
    }
  }

  async reviewChanges(files?: string[]): Promise<CodeReviewSuggestion[]> {
    const path = this.currentRepo?.path;
    if (!path) throw new Error('No repository selected');

    try {
      const diff = await this.getDiff({ staged: false });
      const suggestions: CodeReviewSuggestion[] = [];

      for (const fileDiff of diff) {
        if (files && !files.includes(fileDiff.filePath)) continue;

        const fileReview = await this.reviewFileDiff(fileDiff);
        suggestions.push(...fileReview);
      }

      return suggestions;
    } catch (error) {
      console.warn('AI code review failed:', error);
      return [];
    }
  }

  private async reviewFileDiff(diff: GitDiff): Promise<CodeReviewSuggestion[]> {
    try {
      const diffText = this.formatSingleDiffForAI(diff);

      const prompt = `Review this code change for potential issues:

File: ${diff.filePath}
${diffText}

Look for:
1. Potential bugs or logic errors
2. Security vulnerabilities
3. Performance issues
4. Code style problems
5. Best practice violations

For each issue found, provide:
- Line number
- Issue type and severity
- Clear description
- Suggested improvement
- Confidence level

Format as JSON array of review suggestions.`;

      const agent = aiWorkflowEngine.getAllAgents()[0];
      if (!agent) return [];

      const session = await aiWorkflowEngine.runSequentialWorkflow(
        { userGoal: prompt, additionalContext: 'Git code review' },
        [agent.id],
      );

      const result = this.parseAIResponse(session.result?.finalOutput || '[]');
      return Array.isArray(result)
        ? result.map((r) => ({
            ...r,
            filePath: diff.filePath,
          }))
        : [];
    } catch (error) {
      console.warn(`Failed to review ${diff.filePath}:`, error);
      return [];
    }
  }

  // Utility Methods
  private async executeGitCommand(args: string[], cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const gitProcess = spawn('git', args, {
        cwd: cwd || this.currentRepo?.path,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';

      gitProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      gitProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      gitProcess.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Git command failed: ${stderr.trim() || 'Unknown error'}`));
        }
      });

      gitProcess.on('error', (error) => {
        reject(new Error(`Git command execution failed: ${error.message}`));
      });
    });
  }

  private parseStatusOutput(output: string): GitStatus {
    const lines = output
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);
    const staged: GitFileChange[] = [];
    const unstaged: GitFileChange[] = [];
    const untracked: string[] = [];
    const conflicted: string[] = [];

    for (const line of lines) {
      if (line.startsWith('##')) continue; // Branch info

      const statusCode = line.substring(0, 2);
      const filePath = line.substring(3);

      if (statusCode.includes('U') || (statusCode.includes('A') && statusCode.includes('A'))) {
        conflicted.push(filePath);
      } else if (statusCode[0] !== ' ') {
        staged.push({
          path: filePath,
          status: this.mapStatusCode(statusCode[0]),
          staged: true,
          insertions: 0,
          deletions: 0,
        });
      } else if (statusCode[1] !== ' ') {
        if (statusCode[1] === '?') {
          untracked.push(filePath);
        } else {
          unstaged.push({
            path: filePath,
            status: this.mapStatusCode(statusCode[1]),
            staged: false,
            insertions: 0,
            deletions: 0,
          });
        }
      }
    }

    return {
      staged,
      unstaged,
      untracked,
      conflicted,
      ahead: 0,
      behind: 0,
      clean: false,
    };
  }

  private parseAheadBehind(output: string): { ahead: number; behind: number } {
    const match = output.match(/\[ahead (\d+)(?:, behind (\d+))?\]/);
    return {
      ahead: match ? parseInt(match[1]) : 0,
      behind: match && match[2] ? parseInt(match[2]) : 0,
    };
  }

  private parseBranchOutput(output: string, _repoPath: string): GitBranch[] {
    const lines = output.trim().split('\n');
    const branches: GitBranch[] = [];

    for (const line of lines) {
      const current = line.startsWith('*');
      const parts = line.replace('*', '').trim().split(/\s+/);
      const name = parts[0];
      const hash = parts[1];

      branches.push({
        name,
        current,
        ahead: 0,
        behind: 0,
        lastCommit: {
          hash,
          shortHash: hash.substring(0, 7),
          author: { name: '', email: '', timestamp: 0 },
          committer: { name: '', email: '', timestamp: 0 },
          message: '',
          timestamp: 0,
          parents: [],
          files: [],
          stats: { insertions: 0, deletions: 0, filesChanged: 0 },
        },
      });
    }

    return branches;
  }

  private parseLogOutput(output: string): GitCommit[] {
    const commits: GitCommit[] = [];
    const entries = output.split('\n\n');

    for (const entry of entries) {
      const lines = entry.trim().split('\n');
      if (lines.length === 0) continue;

      const commitLine = lines[0];
      const parts = commitLine.split('|');

      if (parts.length >= 9) {
        commits.push({
          hash: parts[0],
          shortHash: parts[1],
          author: {
            name: parts[2],
            email: parts[3],
            timestamp: parseInt(parts[4]) * 1000,
          },
          committer: {
            name: parts[5],
            email: parts[6],
            timestamp: parseInt(parts[7]) * 1000,
          },
          message: parts[9],
          timestamp: parseInt(parts[4]) * 1000,
          parents: parts[8].split(' ').filter((p) => p.length > 0),
          files: [],
          stats: { insertions: 0, deletions: 0, filesChanged: 0 },
        });
      }
    }

    return commits;
  }

  private parseDiffOutput(output: string): GitDiff[] {
    const diffs: GitDiff[] = [];
    const files = output.split('diff --git');

    for (const fileContent of files) {
      if (!fileContent.trim()) continue;

      const diff = this.parseSingleFileDiff(fileContent);
      if (diff) {
        diffs.push(diff);
      }
    }

    return diffs;
  }

  private parseSingleFileDiff(content: string): GitDiff | null {
    const lines = content.split('\n');
    const headerMatch = lines[0]?.match(/a\/(.+) b\/(.+)/);

    if (!headerMatch) return null;

    const filePath = headerMatch[2];
    const hunks: GitDiffHunk[] = [];

    let currentHunk: GitDiffHunk | null = null;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }

        const hunkMatch = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@(.*)/);
        if (hunkMatch) {
          currentHunk = {
            oldStart: parseInt(hunkMatch[1]),
            oldLines: parseInt(hunkMatch[2]) || 1,
            newStart: parseInt(hunkMatch[3]),
            newLines: parseInt(hunkMatch[4]) || 1,
            header: line,
            lines: [],
          };
        }
      } else if (
        currentHunk &&
        (line.startsWith(' ') || line.startsWith('+') || line.startsWith('-'))
      ) {
        const type = line.startsWith('+')
          ? 'addition'
          : line.startsWith('-')
            ? 'deletion'
            : 'context';
        currentHunk.lines.push({
          type,
          content: line.substring(1),
        });
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return {
      filePath,
      hunks,
      isBinary: content.includes('Binary files'),
      isNew: content.includes('new file mode'),
      isDeleted: content.includes('deleted file mode'),
      isRenamed: content.includes('rename from'),
    };
  }

  private mapStatusCode(code: string): GitFileChange['status'] {
    switch (code) {
      case 'A':
        return 'added';
      case 'M':
        return 'modified';
      case 'D':
        return 'deleted';
      case 'R':
        return 'renamed';
      case 'C':
        return 'copied';
      default:
        return 'modified';
    }
  }

  private formatDiffForAI(diffs: GitDiff[]): string {
    return diffs.map((diff) => this.formatSingleDiffForAI(diff)).join('\n\n');
  }

  private formatSingleDiffForAI(diff: GitDiff): string {
    let result = `File: ${diff.filePath}\n`;

    for (const hunk of diff.hunks) {
      result += `${hunk.header}\n`;
      for (const line of hunk.lines) {
        const prefix = line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' ';
        result += `${prefix}${line.content}\n`;
      }
    }

    return result;
  }

  private parseAIResponse(response: string): any {
    try {
      const jsonMatch =
        response.match(/```json\n([\s\S]*?)\n```/) ||
        response.match(/\[[\s\S]*\]/) ||
        response.match(/\{[\s\S]*\}/);

      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;
      return JSON.parse(jsonStr);
    } catch (error) {
      console.warn('Failed to parse AI response:', error);
      return [];
    }
  }

  private async getCurrentBranch(path: string): Promise<string> {
    try {
      const output = await this.executeGitCommand(['branch', '--show-current'], path);
      return output.trim() || 'main';
    } catch (error) {
      return 'main';
    }
  }

  private async getRemotes(path: string): Promise<GitRemote[]> {
    try {
      const output = await this.executeGitCommand(['remote', '-v'], path);
      const remotes: GitRemote[] = [];

      for (const line of output.split('\n')) {
        const match = line.match(/^(\w+)\s+(.+)\s+\((fetch|push)\)$/);
        if (match) {
          remotes.push({
            name: match[1],
            url: match[2],
            type: match[3] as 'fetch' | 'push',
          });
        }
      }

      return remotes;
    } catch (error) {
      return [];
    }
  }

  private async getConfig(path: string): Promise<GitConfig> {
    try {
      const userNameOutput = await this.executeGitCommand(['config', 'user.name'], path);
      const userEmailOutput = await this.executeGitCommand(['config', 'user.email'], path);

      return {
        user: {
          name: userNameOutput.trim(),
          email: userEmailOutput.trim(),
        },
        core: {
          editor: 'code',
          autocrlf: false,
        },
        remote: {},
      };
    } catch (error) {
      return {
        user: { name: '', email: '' },
        core: { editor: 'code', autocrlf: false },
        remote: {},
      };
    }
  }

  // Public getters
  getCurrentRepository(): GitRepository | null {
    return this.currentRepo;
  }

  getRepositories(): GitRepository[] {
    return Array.from(this.repositories.values());
  }

  isRepositoryOpen(): boolean {
    return this.currentRepo !== null;
  }
}

export const gitIntegration = new GitIntegration();
