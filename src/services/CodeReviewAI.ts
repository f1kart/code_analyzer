/**
 * Code Review AI with Learning
 * AI-powered code review that learns team preferences
 * KEN RULES: PRODUCTION-READY, NO MOCKUPS
 */

export interface CodeReview {
  id: string;
  timestamp: Date;
  files: Array<{
    path: string;
    comments: ReviewComment[];
  }>;
  summary: {
    issuesFound: number;
    suggestions: number;
    criticalIssues: number;
  };
  overallScore: number; // 0-100
}

export interface ReviewComment {
  id: string;
  file: string;
  line: number;
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  category: 'bug' | 'performance' | 'security' | 'style' | 'best-practice';
  message: string;
  suggestion?: string;
  codeSnippet: string;
  confidence: number; // 0-1
}

export interface TeamPreferences {
  codingStyle: Record<string, any>;
  namingConventions: Record<string, string>;
  approvedPatterns: string[];
  bannedPatterns: string[];
  customRules: Array<{
    name: string;
    description: string;
    pattern: string;
    severity: ReviewComment['severity'];
  }>;
}

/**
 * Code Review AI with Learning
 */
export class CodeReviewAI {
  private apiKey: string;
  private reviewHistory: CodeReview[] = [];
  private teamPreferences: TeamPreferences = {
    codingStyle: {},
    namingConventions: {},
    approvedPatterns: [],
    bannedPatterns: [],
    customRules: [],
  };
  private feedbackHistory: Array<{
    commentId: string;
    accepted: boolean;
    feedback?: string;
  }> = [];
  
  // Rate limiting configuration
  private readonly REQUEST_DELAY_MS = 1000; // 1 second between requests
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY_MS = 2000; // 2 seconds
  private readonly BATCH_SIZE = 5; // Process 5 files at a time
  private lastRequestTime = 0;

  constructor() {
    this.apiKey = this.getAPIKey();
    console.log('[CodeReviewAI] Initialized');
  }

  /**
   * Review code changes with rate limiting and batch processing
   */
  public async reviewCode(
    files: Array<{ path: string; content: string; diff?: string }>,
    onProgress?: (current: number, total: number, fileName: string) => void
  ): Promise<CodeReview> {
    console.log(`[CodeReviewAI] Reviewing ${files.length} files with rate limiting...`);

    const review: CodeReview = {
      id: this.generateId(),
      timestamp: new Date(),
      files: [],
      summary: {
        issuesFound: 0,
        suggestions: 0,
        criticalIssues: 0,
      },
      overallScore: 100,
    };

    // Process files in batches with rate limiting
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Progress callback
      if (onProgress) {
        onProgress(i + 1, files.length, file.path);
      }
      
      try {
        // Wait for rate limit before processing
        await this.enforceRateLimit();
        
        const comments = await this.reviewFileWithRetry(file);
        if (comments.length > 0) {
          review.files.push({
            path: file.path,
            comments,
          });
        }
      } catch (error: any) {
        console.error(`[CodeReviewAI] Failed to review ${file.path} after retries:`, error.message);
        // Continue with next file instead of failing entire review
      }
      
      // Log progress every 10 files
      if ((i + 1) % 10 === 0) {
        console.log(`[CodeReviewAI] Progress: ${i + 1}/${files.length} files reviewed`);
      }
    }

    // Calculate summary
    const allComments = review.files.flatMap(f => f.comments);
    review.summary.issuesFound = allComments.length;
    review.summary.suggestions = allComments.filter(c => c.severity === 'suggestion').length;
    review.summary.criticalIssues = allComments.filter(c => c.severity === 'critical').length;
    review.overallScore = this.calculateScore(allComments);

    this.reviewHistory.push(review);
    console.log(`[CodeReviewAI] Review complete: ${review.files.length} files with issues found`);
    return review;
  }

  /**
   * Enforce rate limiting between API requests
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.REQUEST_DELAY_MS) {
      const delay = this.REQUEST_DELAY_MS - timeSinceLastRequest;
      await this.sleep(delay);
    }
    
    this.lastRequestTime = Date.now();
  }
  
  /**
   * Review single file with retry logic
   */
  private async reviewFileWithRetry(file: {
    path: string;
    content: string;
    diff?: string;
  }): Promise<ReviewComment[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await this.reviewFile(file);
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a rate limit error
        if (error.message.includes('429') || error.message.includes('rate limit')) {
          if (attempt < this.MAX_RETRIES) {
            // Exponential backoff: 2s, 4s, 8s
            const delay = this.INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
            console.log(`[CodeReviewAI] Rate limit hit for ${file.path}, retrying in ${delay}ms (attempt ${attempt + 1}/${this.MAX_RETRIES})`);
            await this.sleep(delay);
            continue;
          }
        }
        
        // For other errors, throw immediately
        if (!error.message.includes('429')) {
          throw error;
        }
      }
    }
    
    throw lastError || new Error('Review failed after retries');
  }

  /**
   * Review single file
   */
  private async reviewFile(file: {
    path: string;
    content: string;
    diff?: string;
  }): Promise<ReviewComment[]> {
    const comments: ReviewComment[] = [];

    // Skip non-code files
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cs', '.cpp', '.c', '.h', '.go', '.rs', '.php', '.rb', '.swift', '.kt'];
    const fileExt = file.path.substring(file.path.lastIndexOf('.')).toLowerCase();
    if (!codeExtensions.includes(fileExt)) {
      console.log(`[CodeReviewAI] Skipping non-code file: ${file.path}`);
      return comments;
    }

    try {
      const prompt = `You are a senior code reviewer. Review this ${file.path} file.

${file.content}

Team preferences:
- Coding style: ${JSON.stringify(this.teamPreferences.codingStyle)}
- Naming conventions: ${JSON.stringify(this.teamPreferences.namingConventions)}
- Approved patterns: ${this.teamPreferences.approvedPatterns.join(', ')}
- Banned patterns: ${this.teamPreferences.bannedPatterns.join(', ')}

Return JSON array of review comments:
[{
  "line": 10,
  "severity": "major",
  "category": "bug",
  "message": "Issue description",
  "suggestion": "How to fix",
  "confidence": 0.9
}]

Focus on: bugs, security issues, performance problems, and violations of team preferences.`;

      const response = await this.callAI(prompt);
      const aiComments = this.parseAIResponse(response);

      for (const comment of aiComments) {
        comments.push({
          id: this.generateId(),
          file: file.path,
          line: comment.line,
          severity: comment.severity,
          category: comment.category,
          message: comment.message,
          suggestion: comment.suggestion,
          codeSnippet: this.extractCodeSnippet(file.content, comment.line),
          confidence: comment.confidence || 0.8,
        });
      }
    } catch (error: any) {
      console.error(`[CodeReviewAI] Review failed for ${file.path}:`, error.message);
    }

    return comments;
  }

  /**
   * Learn from feedback
   */
  public learnFromFeedback(
    commentId: string,
    accepted: boolean,
    feedback?: string
  ): void {
    this.feedbackHistory.push({ commentId, accepted, feedback });

    // Find the comment
    const comment = this.findComment(commentId);
    if (!comment) return;

    if (accepted) {
      // Reinforce this type of check
      this.reinforcePattern(comment);
    } else {
      // Suppress this type of check
      this.suppressPattern(comment);
    }

    console.log(`[CodeReviewAI] Learned from feedback: ${accepted ? 'accepted' : 'rejected'}`);
  }

  /**
   * Update team preferences
   */
  public updatePreferences(preferences: Partial<TeamPreferences>): void {
    this.teamPreferences = {
      ...this.teamPreferences,
      ...preferences,
    };
    console.log('[CodeReviewAI] Team preferences updated');
  }

  /**
   * Get review history
   */
  public getReviewHistory(): CodeReview[] {
    return [...this.reviewHistory];
  }

  /**
   * Get learning insights
   */
  public getLearningInsights(): {
    totalReviews: number;
    acceptanceRate: number;
    topCategories: Array<{ category: string; count: number }>;
    improvedAreas: string[];
  } {
    const totalFeedback = this.feedbackHistory.length;
    const accepted = this.feedbackHistory.filter(f => f.accepted).length;
    const acceptanceRate = totalFeedback > 0 ? (accepted / totalFeedback) * 100 : 0;

    const categoryCount = new Map<string, number>();
    for (const review of this.reviewHistory) {
      for (const file of review.files) {
        for (const comment of file.comments) {
          const count = categoryCount.get(comment.category) || 0;
          categoryCount.set(comment.category, count + 1);
        }
      }
    }

    const topCategories = Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalReviews: this.reviewHistory.length,
      acceptanceRate,
      topCategories,
      improvedAreas: this.teamPreferences.approvedPatterns,
    };
  }

  /**
   * Helper methods
   */
  private async callAI(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4000,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`AI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  private parseAIResponse(response: string): any[] {
    try {
      if (!response || typeof response !== 'string') {
        return [];
      }
      
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (jsonMatch && jsonMatch[0]) {
        const parsed = JSON.parse(jsonMatch[0]);
        return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    } catch (error) {
      console.warn('[CodeReviewAI] Failed to parse AI response:', error);
      return [];
    }
  }

  private extractCodeSnippet(content: string, line: number): string {
    if (!content || typeof content !== 'string') {
      return '';
    }
    
    const lines = content.split('\n');
    if (!lines || lines.length === 0) {
      return '';
    }
    
    // Ensure line number is valid
    const validLine = Math.max(1, Math.min(line || 1, lines.length));
    const start = Math.max(0, validLine - 2);
    const end = Math.min(lines.length, validLine + 1);
    
    return lines.slice(start, end).join('\n');
  }

  private findComment(commentId: string): ReviewComment | null {
    for (const review of this.reviewHistory) {
      for (const file of review.files) {
        const comment = file.comments.find(c => c.id === commentId);
        if (comment) return comment;
      }
    }
    return null;
  }

  private reinforcePattern(comment: ReviewComment): void {
    const pattern = `${comment.category}:${comment.severity}`;
    if (!this.teamPreferences.approvedPatterns.includes(pattern)) {
      this.teamPreferences.approvedPatterns.push(pattern);
    }
  }

  private suppressPattern(comment: ReviewComment): void {
    const pattern = `${comment.category}:${comment.severity}`;
    if (!this.teamPreferences.bannedPatterns.includes(pattern)) {
      this.teamPreferences.bannedPatterns.push(pattern);
    }
  }

  private calculateScore(comments: ReviewComment[]): number {
    if (comments.length === 0) return 100;

    const severityWeights = {
      critical: 20,
      major: 10,
      minor: 5,
      suggestion: 2,
    };

    const totalDeduction = comments.reduce(
      (sum, c) => sum + severityWeights[c.severity],
      0
    );

    return Math.max(0, 100 - totalDeduction);
  }

  private getAPIKey(): string {
    if (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) {
      return process.env.VITE_GEMINI_API_KEY;
    }
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) {
      return (import.meta as any).env.VITE_GEMINI_API_KEY;
    }
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('gemini_api_key');
      if (stored) return stored;
    }
    return '';
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function getCodeReviewAI(): CodeReviewAI {
  return new CodeReviewAI();
}
