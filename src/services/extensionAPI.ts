import * as fs from 'fs';
import * as path from 'path';

export interface Extension {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  keywords: string[];
  category: string;
  main: string;
  contributes: ExtensionContributes;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines: { gemini: string };
  activationEvents: string[];
  isActive: boolean;
  isEnabled: boolean;
  installPath: string;
  manifest: ExtensionManifest;
  context?: ExtensionContext;
}

export interface ExtensionManifest {
  name: string;
  displayName: string;
  version: string;
  publisher: string;
  description: string;
  icon?: string;
  galleryBanner?: {
    color: string;
    theme: 'dark' | 'light';
  };
  categories: string[];
  contributes: ExtensionContributes;
  scripts?: Record<string, string>;
  main?: string;
  browser?: string;
}

export interface ExtensionContributes {
  commands?: Command[];
  menus?: MenuContribution[];
  keybindings?: Keybinding[];
  languages?: LanguageContribution[];
  grammars?: Grammar[];
  themes?: Theme[];
  snippets?: SnippetContribution[];
  debuggers?: DebuggerContribution[];
  taskDefinitions?: TaskDefinition[];
  problemMatchers?: ProblemMatcher[];
  views?: ViewContribution[];
  viewsContainers?: ViewContainer[];
  configuration?: ConfigurationContribution;
  configurationDefaults?: Record<string, any>;
}

export interface Command {
  command: string;
  title: string;
  category?: string;
  icon?: string | { light: string; dark: string };
  enablement?: string;
  when?: string;
}

export interface MenuContribution {
  commandPalette?: MenuGroup[];
  editor?: MenuGroup[];
  explorer?: MenuGroup[];
  scm?: MenuGroup[];
  debug?: MenuGroup[];
  terminal?: MenuGroup[];
}

export interface MenuGroup {
  command: string;
  when?: string;
  group?: string;
  alt?: string;
}

export interface Keybinding {
  command: string;
  key: string;
  mac?: string;
  linux?: string;
  when?: string;
  args?: any;
}

export interface LanguageContribution {
  id: string;
  aliases?: string[];
  extensions?: string[];
  filenames?: string[];
  firstLine?: string;
  configuration?: string;
}

export interface Grammar {
  language: string;
  scopeName: string;
  path: string;
  embeddedLanguages?: Record<string, string>;
  tokenTypes?: Record<string, string>;
}

export interface Theme {
  id: string;
  label: string;
  uiTheme: 'vs' | 'vs-dark' | 'hc-black';
  path: string;
}

export interface SnippetContribution {
  language: string;
  path: string;
}

export interface DebuggerContribution {
  type: string;
  label: string;
  program?: string;
  runtime?: string;
  configurationAttributes?: Record<string, any>;
  initialConfigurations?: any[];
  configurationSnippets?: any[];
  variables?: Record<string, string>;
}

export interface TaskDefinition {
  type: string;
  required?: string[];
  properties?: Record<string, any>;
}

export interface ProblemMatcher {
  name: string;
  owner: string;
  fileLocation: string | string[];
  pattern: ProblemPattern | ProblemPattern[];
  background?: BackgroundMatcher;
}

export interface ProblemPattern {
  regexp: string;
  file?: number;
  location?: number;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  severity?: number;
  code?: number;
  message: number;
  loop?: boolean;
}

export interface BackgroundMatcher {
  activeOnStart?: boolean;
  beginsPattern?: string;
  endsPattern?: string;
}

export interface ViewContribution {
  id: string;
  name: string;
  when?: string;
  icon?: string;
  contextualTitle?: string;
}

export interface ViewContainer {
  id: string;
  title: string;
  icon: string;
}

export interface ConfigurationContribution {
  title?: string;
  properties: Record<string, ConfigurationProperty>;
}

export interface ConfigurationProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  default?: any;
  description: string;
  enum?: any[];
  enumDescriptions?: string[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  items?: ConfigurationProperty;
  properties?: Record<string, ConfigurationProperty>;
}

export type ExtensionCategory =
  | 'AI & Machine Learning'
  | 'Debuggers'
  | 'Extension Packs'
  | 'Formatters'
  | 'Keymaps'
  | 'Language Packs'
  | 'Linters'
  | 'Other'
  | 'Programming Languages'
  | 'SCM Providers'
  | 'Snippets'
  | 'Themes'
  | 'Visualization';

export interface ExtensionContext {
  subscriptions: Disposable[];
  workspaceState: Memento;
  globalState: Memento;
  extensionPath: string;
  storagePath?: string;
  globalStoragePath: string;
  logPath: string;
  extensionUri: string;
  environmentVariableCollection: EnvironmentVariableCollection;
}

export interface Disposable {
  dispose(): void;
}

export interface Memento {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: any): Promise<void>;
}

export interface EnvironmentVariableCollection {
  persistent: boolean;
  replace(variable: string, value: string): void;
  append(variable: string, value: string): void;
  prepend(variable: string, value: string): void;
  get(variable: string): EnvironmentVariableMutator | undefined;
  forEach(callback: (variable: string, mutator: EnvironmentVariableMutator) => void): void;
  delete(variable: string): void;
  clear(): void;
}

export interface EnvironmentVariableMutator {
  type: EnvironmentVariableMutatorType;
  value: string;
}

export type EnvironmentVariableMutatorType = 'replace' | 'append' | 'prepend';

export interface ExtensionAPI {
  // Core API
  registerCommand(command: string, callback: (...args: any[]) => any): Disposable;
  executeCommand<T = unknown>(command: string, ...rest: any[]): Promise<T>;

  // UI API
  showInformationMessage(message: string, ...items: string[]): Promise<string | undefined>;
  showWarningMessage(message: string, ...items: string[]): Promise<string | undefined>;
  showErrorMessage(message: string, ...items: string[]): Promise<string | undefined>;
  showInputBox(options?: InputBoxOptions): Promise<string | undefined>;
  showQuickPick(
    items: string[] | QuickPickItem[],
    options?: QuickPickOptions,
  ): Promise<string | QuickPickItem | undefined>;

  // Workspace API
  getWorkspaceFolders(): WorkspaceFolder[] | undefined;
  onDidChangeWorkspaceFolders: Event<WorkspaceFoldersChangeEvent>;
  getConfiguration(section?: string, resource?: string): WorkspaceConfiguration;

  // Editor API
  getActiveTextEditor(): TextEditor | undefined;
  getVisibleTextEditors(): TextEditor[];
  onDidChangeActiveTextEditor: Event<TextEditor | undefined>;
  onDidChangeVisibleTextEditors: Event<TextEditor[]>;

  // File System API
  readFile(uri: string): Promise<Uint8Array>;
  writeFile(uri: string, content: Uint8Array): Promise<void>;
  createDirectory(uri: string): Promise<void>;
  delete(uri: string, options?: { recursive?: boolean; useTrash?: boolean }): Promise<void>;

  // Language Features API
  registerCompletionItemProvider(
    selector: DocumentSelector,
    provider: CompletionItemProvider,
  ): Disposable;
  registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable;
  registerDefinitionProvider(selector: DocumentSelector, provider: DefinitionProvider): Disposable;

  // Debug API
  registerDebugConfigurationProvider(
    debugType: string,
    provider: DebugConfigurationProvider,
  ): Disposable;
  startDebugging(
    folder: WorkspaceFolder | undefined,
    nameOrConfiguration: string | DebugConfiguration,
  ): Promise<boolean>;
}

export interface InputBoxOptions {
  value?: string;
  valueSelection?: [number, number];
  prompt?: string;
  placeHolder?: string;
  password?: boolean;
  ignoreFocusOut?: boolean;
  validateInput?(value: string): string | undefined | null | Promise<string | undefined | null>;
}

export interface QuickPickItem {
  label: string;
  description?: string;
  detail?: string;
  picked?: boolean;
  alwaysShow?: boolean;
}

export interface QuickPickOptions {
  matchOnDescription?: boolean;
  matchOnDetail?: boolean;
  placeHolder?: string;
  ignoreFocusOut?: boolean;
  canPickMany?: boolean;
}

export interface Event<T> {
  (listener: (e: T) => any, thisArgs?: any): Disposable;
}

export interface WorkspaceFolder {
  uri: string;
  name: string;
  index: number;
}

export interface WorkspaceFoldersChangeEvent {
  added: WorkspaceFolder[];
  removed: WorkspaceFolder[];
}

export interface WorkspaceConfiguration {
  get<T>(section: string): T | undefined;
  get<T>(section: string, defaultValue: T): T;
  has(section: string): boolean;
  inspect<T>(section: string): ConfigurationInspect<T> | undefined;
  update(section: string, value: any, configurationTarget?: ConfigurationTarget): Promise<void>;
}

export interface ConfigurationInspect<T> {
  key: string;
  defaultValue?: T;
  globalValue?: T;
  workspaceValue?: T;
  workspaceFolderValue?: T;
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

export interface TextEditor {
  document: TextDocument;
  selection: Selection;
  selections: Selection[];
  visibleRanges: Range[];
  options: TextEditorOptions;
  viewColumn?: ViewColumn;
}

export interface TextDocument {
  uri: string;
  fileName: string;
  isUntitled: boolean;
  languageId: string;
  version: number;
  isDirty: boolean;
  isClosed: boolean;
  save(): Promise<boolean>;
  eol: EndOfLine;
  lineCount: number;
  lineAt(line: number): TextLine;
  getText(range?: Range): string;
  getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined;
  validateRange(range: Range): Range;
  validatePosition(position: Position): Position;
}

export interface Selection extends Range {
  anchor: Position;
  active: Position;
  isReversed: boolean;
}

export interface Range {
  start: Position;
  end: Position;
  isEmpty: boolean;
  isSingleLine: boolean;
  contains(positionOrRange: Position | Range): boolean;
  isEqual(other: Range): boolean;
  intersection(range: Range): Range | undefined;
  union(other: Range): Range;
  with(start?: Position, end?: Position): Range;
}

export interface Position {
  line: number;
  character: number;
  isBefore(other: Position): boolean;
  isBeforeOrEqual(other: Position): boolean;
  isAfter(other: Position): boolean;
  isAfterOrEqual(other: Position): boolean;
  isEqual(other: Position): boolean;
  compareTo(other: Position): number;
  translate(lineDelta?: number, characterDelta?: number): Position;
  with(line?: number, character?: number): Position;
}

export interface TextLine {
  lineNumber: number;
  text: string;
  range: Range;
  rangeIncludingLineBreak: Range;
  firstNonWhitespaceCharacterIndex: number;
  isEmptyOrWhitespace: boolean;
}

export interface TextEditorOptions {
  tabSize?: number;
  insertSpaces?: boolean;
  cursorStyle?: TextEditorCursorStyle;
  lineNumbers?: TextEditorLineNumbersStyle;
}

export enum TextEditorCursorStyle {
  Line = 1,
  Block = 2,
  Underline = 3,
  LineThin = 4,
  BlockOutline = 5,
  UnderlineThin = 6,
}

export enum TextEditorLineNumbersStyle {
  Off = 0,
  On = 1,
  Relative = 2,
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
}

export enum EndOfLine {
  LF = 1,
  CRLF = 2,
}

export type DocumentSelector = string | DocumentFilter | Array<string | DocumentFilter>;

export interface DocumentFilter {
  language?: string;
  scheme?: string;
  pattern?: string;
}

export interface CompletionItemProvider {
  provideCompletionItems(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
    context: CompletionContext,
  ): Promise<CompletionItem[] | CompletionList>;
  resolveCompletionItem?(item: CompletionItem, token: CancellationToken): Promise<CompletionItem>;
}

export interface HoverProvider {
  provideHover(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
  ): Promise<Hover | undefined>;
}

export interface DefinitionProvider {
  provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
  ): Promise<Definition | DefinitionLink[]>;
}

export interface CancellationToken {
  isCancellationRequested: boolean;
  onCancellationRequested: Event<any>;
}

export interface CompletionContext {
  triggerKind: CompletionTriggerKind;
  triggerCharacter?: string;
}

export enum CompletionTriggerKind {
  Invoke = 0,
  TriggerCharacter = 1,
  TriggerForIncompleteCompletions = 2,
}

export interface CompletionItem {
  label: string;
  kind?: CompletionItemKind;
  tags?: CompletionItemTag[];
  detail?: string;
  documentation?: string | MarkdownString;
  sortText?: string;
  filterText?: string;
  preselect?: boolean;
  insertText?: string | SnippetString;
  range?: Range | { inserting: Range; replacing: Range };
  commitCharacters?: string[];
  keepWhitespace?: boolean;
  additionalTextEdits?: TextEdit[];
  command?: Command;
}

export interface CompletionList {
  isIncomplete?: boolean;
  items: CompletionItem[];
}

export enum CompletionItemKind {
  Text = 0,
  Method = 1,
  Function = 2,
  Constructor = 3,
  Field = 4,
  Variable = 5,
  Class = 6,
  Interface = 7,
  Module = 8,
  Property = 9,
  Unit = 10,
  Value = 11,
  Enum = 12,
  Keyword = 13,
  Snippet = 14,
  Color = 15,
  Reference = 17,
  File = 16,
  Folder = 18,
  EnumMember = 19,
  Constant = 20,
  Struct = 21,
  Event = 22,
  Operator = 23,
  TypeParameter = 24,
  User = 25,
  Issue = 26,
}

export enum CompletionItemTag {
  Deprecated = 1,
}

export interface MarkdownString {
  value: string;
  isTrusted?: boolean;
  supportThemeIcons?: boolean;
  supportHtml?: boolean;
  baseUri?: string;
}

export interface SnippetString {
  value: string;
  appendText(string: string): SnippetString;
  appendTabstop(number?: number): SnippetString;
  appendPlaceholder(
    value: string | ((snippet: SnippetString) => any),
    number?: number,
  ): SnippetString;
  appendChoice(values: string[], number?: number): SnippetString;
  appendVariable(
    name: string,
    defaultValue: string | ((snippet: SnippetString) => any),
  ): SnippetString;
}

export interface TextEdit {
  range: Range;
  newText: string;
}

export interface Hover {
  contents: MarkdownString[] | MarkdownString;
  range?: Range;
}

export type Definition = Location | Location[];

export interface Location {
  uri: string;
  range: Range;
}

export interface DefinitionLink {
  originSelectionRange?: Range;
  targetUri: string;
  targetRange: Range;
  targetSelectionRange?: Range;
}

export interface DebugConfigurationProvider {
  provideDebugConfigurations?(
    folder: WorkspaceFolder | undefined,
    token?: CancellationToken,
  ): Promise<DebugConfiguration[]>;
  resolveDebugConfiguration?(
    folder: WorkspaceFolder | undefined,
    debugConfiguration: DebugConfiguration,
    token?: CancellationToken,
  ): Promise<DebugConfiguration>;
  resolveDebugConfigurationWithSubstitutedVariables?(
    folder: WorkspaceFolder | undefined,
    debugConfiguration: DebugConfiguration,
    token?: CancellationToken,
  ): Promise<DebugConfiguration>;
}

export interface DebugConfiguration {
  type: string;
  name: string;
  request: string;
  [key: string]: any;
}

export class ExtensionManager {
  private extensions = new Map<string, Extension>();
  private activeExtensions = new Set<string>();
  private extensionCallbacks = new Set<
    (extension: Extension, event: 'activated' | 'deactivated') => void
  >();
  private api: ExtensionAPI;

  constructor() {
    this.api = this.createAPI();
    this.loadExtensions();
  }

  // Extension Lifecycle
  async installExtension(extensionPath: string): Promise<Extension> {
    try {
      const manifest = await this.loadManifest(extensionPath);
      const extension = this.createExtension(manifest, extensionPath);

      this.extensions.set(extension.id, extension);
      this.saveExtensions();

      return extension;
    } catch (error) {
      throw new Error(`Failed to install extension: ${error}`);
    }
  }

  async uninstallExtension(extensionId: string): Promise<void> {
    const extension = this.extensions.get(extensionId);
    if (!extension) return;

    if (extension.isActive) {
      await this.deactivateExtension(extensionId);
    }

    this.extensions.delete(extensionId);
    this.saveExtensions();
  }

  async activateExtension(extensionId: string): Promise<void> {
    const extension = this.extensions.get(extensionId);
    if (!extension || extension.isActive) return;

    try {
      // Load extension module
      const extensionModule = await this.loadExtensionModule(extension);

      // Create extension context
      extension.context = this.createExtensionContext(extension);

      // Activate extension
      if (extensionModule.activate) {
        await extensionModule.activate(extension.context);
      }

      extension.isActive = true;
      this.activeExtensions.add(extensionId);

      this.notifyExtensionCallbacks(extension, 'activated');
    } catch (error) {
      throw new Error(`Failed to activate extension ${extensionId}: ${error}`);
    }
  }

  async deactivateExtension(extensionId: string): Promise<void> {
    const extension = this.extensions.get(extensionId);
    if (!extension || !extension.isActive) return;

    try {
      // Load extension module
      const extensionModule = await this.loadExtensionModule(extension);

      // Deactivate extension
      if (extensionModule.deactivate) {
        await extensionModule.deactivate();
      }

      // Dispose context subscriptions
      if (extension.context) {
        extension.context.subscriptions.forEach((subscription) => {
          subscription.dispose();
        });
      }

      extension.isActive = false;
      this.activeExtensions.delete(extensionId);

      this.notifyExtensionCallbacks(extension, 'deactivated');
    } catch (error) {
      throw new Error(`Failed to deactivate extension ${extensionId}: ${error}`);
    }
  }

  enableExtension(extensionId: string): void {
    const extension = this.extensions.get(extensionId);
    if (extension) {
      extension.isEnabled = true;
      this.saveExtensions();
    }
  }

  disableExtension(extensionId: string): void {
    const extension = this.extensions.get(extensionId);
    if (extension) {
      if (extension.isActive) {
        this.deactivateExtension(extensionId);
      }
      extension.isEnabled = false;
      this.saveExtensions();
    }
  }

  // Extension Loading
  private async loadManifest(extensionPath: string): Promise<ExtensionManifest> {
    try {
      // Look for package.json first (npm-style extensions)
      const packageJsonPath = path.join(extensionPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageJsonContent);

        // Convert npm package.json to extension manifest format
        return {
          name: packageJson.name || 'unknown-extension',
          displayName: packageJson.displayName || packageJson.name || 'Unknown Extension',
          version: packageJson.version || '0.0.1',
          publisher: packageJson.publisher || packageJson.author || 'unknown',
          description: packageJson.description || 'No description available',
          icon: packageJson.icon,
          galleryBanner: packageJson.galleryBanner,
          categories: packageJson.categories || ['Other'],
          contributes: packageJson.contributes || {},
          scripts: packageJson.scripts,
          main: packageJson.main,
          browser: packageJson.browser,
        };
      }

      // Look for extension.json (custom extension format)
      const extensionJsonPath = path.join(extensionPath, 'extension.json');
      if (fs.existsSync(extensionJsonPath)) {
        const extensionJsonContent = fs.readFileSync(extensionJsonPath, 'utf8');
        return JSON.parse(extensionJsonContent);
      }

      throw new Error('No valid extension manifest found (package.json or extension.json)');
    } catch (error) {
      console.error(`Failed to load extension manifest from ${extensionPath}:`, error);
      throw new Error(
        `Invalid extension: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private createExtension(manifest: ExtensionManifest, installPath: string): Extension {
    return {
      id: `${manifest.publisher}.${manifest.name}`,
      name: manifest.displayName || manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.publisher,
      license: 'MIT',
      keywords: [],
      category: 'Other',
      main: manifest.main || 'extension.js',
      contributes: manifest.contributes,
      engines: { gemini: '^1.0.0' },
      activationEvents: ['*'],
      isActive: false,
      isEnabled: true,
      installPath,
      manifest,
    };
  }

  private async loadExtensionModule(extension: Extension): Promise<any> {
    try {
      const mainPath = path.join(extension.installPath, extension.main);

      // Check if the main file exists
      if (!fs.existsSync(mainPath)) {
        throw new Error(`Extension main file not found: ${mainPath}`);
      }

      // Use dynamic import to load the extension module
      const moduleUrl = `file://${mainPath}`;
      const extensionModule = await import(moduleUrl);

      return extensionModule;
    } catch (error) {
      console.error(`Failed to load extension module for ${extension.id}:`, error);
      throw new Error(
        `Extension module load failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private createExtensionContext(extension: Extension): ExtensionContext {
    return {
      subscriptions: [],
      workspaceState: this.createMemento(`workspace-${extension.id}`),
      globalState: this.createMemento(`global-${extension.id}`),
      extensionPath: extension.installPath,
      globalStoragePath: `${extension.installPath}/storage`,
      logPath: `${extension.installPath}/logs`,
      extensionUri: extension.installPath,
      environmentVariableCollection: this.createEnvironmentVariableCollection(),
    };
  }

  private createMemento(_key: string): Memento {
    return {
      get<T>(key: string, defaultValue?: T): T | undefined {
        const stored = localStorage.getItem(`memento-${key}`);
        return stored ? JSON.parse(stored) : defaultValue;
      },
      async update(key: string, value: any): Promise<void> {
        localStorage.setItem(`memento-${key}`, JSON.stringify(value));
      },
    };
  }

  private createEnvironmentVariableCollection(): EnvironmentVariableCollection {
    const variables = new Map<string, EnvironmentVariableMutator>();

    return {
      persistent: true,
      replace(variable: string, value: string): void {
        variables.set(variable, { type: 'replace', value });
      },
      append(variable: string, value: string): void {
        variables.set(variable, { type: 'append', value });
      },
      prepend(variable: string, value: string): void {
        variables.set(variable, { type: 'prepend', value });
      },
      get(variable: string): EnvironmentVariableMutator | undefined {
        return variables.get(variable);
      },
      forEach(callback: (variable: string, mutator: EnvironmentVariableMutator) => void): void {
        variables.forEach((mutator, variable) => callback(variable, mutator));
      },
      delete(variable: string): void {
        variables.delete(variable);
      },
      clear(): void {
        variables.clear();
      },
    };
  }

  // API Implementation
  private createAPI(): ExtensionAPI {
    return {
      // Core API
      registerCommand: (_command: string, _callback: (...args: any[]) => any): Disposable => {
        // Register command implementation
        return { dispose: () => {} };
      },

      executeCommand: async <_T = unknown>(_command: string, ..._rest: any[]): Promise<_T> => {
        // Execute command implementation
        return {} as _T;
      },

      // UI API
      showInformationMessage: async (
        message: string,
        ...items: string[]
      ): Promise<string | undefined> => {
        return window.confirm(message) ? items[0] : undefined;
      },

      showWarningMessage: async (
        message: string,
        ...items: string[]
      ): Promise<string | undefined> => {
        return window.confirm(message) ? items[0] : undefined;
      },

      showErrorMessage: async (
        message: string,
        ...items: string[]
      ): Promise<string | undefined> => {
        return window.confirm(message) ? items[0] : undefined;
      },

      showInputBox: async (_options?: InputBoxOptions): Promise<string | undefined> => {
        return window.prompt('Enter value:') || undefined;
      },

      showQuickPick: async (
        items: string[] | QuickPickItem[],
        _options?: QuickPickOptions,
      ): Promise<string | QuickPickItem | undefined> => {
        // Mock quick pick implementation
        return Array.isArray(items) && items.length > 0 ? items[0] : undefined;
      },

      // Workspace API
      getWorkspaceFolders: (): WorkspaceFolder[] | undefined => {
        return [
          {
            uri: '/workspace',
            name: 'Workspace',
            index: 0,
          },
        ];
      },

      onDidChangeWorkspaceFolders: (
        _listener: (e: WorkspaceFoldersChangeEvent) => any,
      ): Disposable => {
        return { dispose: () => {} };
      },

      getConfiguration: (_section?: string, _resource?: string): WorkspaceConfiguration => {
        return {
          get: <T>(_section: string, defaultValue?: T): T | undefined => defaultValue,
          has: (_section: string): boolean => false,
          inspect: <T>(_section: string) => undefined,
          update: async (_section: string, _value: any) => {},
        };
      },

      // Editor API
      getActiveTextEditor: (): TextEditor | undefined => undefined,
      getVisibleTextEditors: (): TextEditor[] => [],
      onDidChangeActiveTextEditor: (_listener: (e: TextEditor | undefined) => any): Disposable => {
        return { dispose: () => {} };
      },
      onDidChangeVisibleTextEditors: (_listener: (e: TextEditor[]) => any): Disposable => {
        return { dispose: () => {} };
      },

      // File System API
      readFile: async (_uri: string): Promise<Uint8Array> => new Uint8Array(),
      writeFile: async (_uri: string, _content: Uint8Array): Promise<void> => {},
      createDirectory: async (_uri: string): Promise<void> => {},
      delete: async (
        _uri: string,
        _options?: { recursive?: boolean; useTrash?: boolean },
      ): Promise<void> => {},

      // Language Features API
      registerCompletionItemProvider: (
        _selector: DocumentSelector,
        _provider: CompletionItemProvider,
      ): Disposable => {
        return { dispose: () => {} };
      },
      registerHoverProvider: (
        _selector: DocumentSelector,
        _provider: HoverProvider,
      ): Disposable => {
        return { dispose: () => {} };
      },
      registerDefinitionProvider: (
        _selector: DocumentSelector,
        _provider: DefinitionProvider,
      ): Disposable => {
        return { dispose: () => {} };
      },

      // Debug API
      registerDebugConfigurationProvider: (
        _debugType: string,
        _provider: DebugConfigurationProvider,
      ): Disposable => {
        return { dispose: () => {} };
      },
      startDebugging: async (
        _folder: WorkspaceFolder | undefined,
        _nameOrConfiguration: string | DebugConfiguration,
      ): Promise<boolean> => {
        return true;
      },
    };
  }

  // Persistence
  private loadExtensions(): void {
    try {
      const saved = localStorage.getItem('installed_extensions');
      if (saved) {
        const data = JSON.parse(saved);
        this.extensions = new Map(data);
      }
    } catch (error) {
      console.warn('Failed to load extensions:', error);
    }
  }

  private saveExtensions(): void {
    try {
      const data = Array.from(this.extensions.entries());
      localStorage.setItem('installed_extensions', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save extensions:', error);
    }
  }

  // Event Handling
  onExtensionChanged(
    callback: (extension: Extension, event: 'activated' | 'deactivated') => void,
  ): () => void {
    this.extensionCallbacks.add(callback);
    return () => this.extensionCallbacks.delete(callback);
  }

  private notifyExtensionCallbacks(extension: Extension, event: 'activated' | 'deactivated'): void {
    this.extensionCallbacks.forEach((callback) => {
      try {
        callback(extension, event);
      } catch (error) {
        console.warn('Extension callback failed:', error);
      }
    });
  }

  // Public API
  getExtensions(): Extension[] {
    return Array.from(this.extensions.values());
  }

  getActiveExtensions(): Extension[] {
    return Array.from(this.extensions.values()).filter((ext) => ext.isActive);
  }

  getExtension(extensionId: string): Extension | null {
    return this.extensions.get(extensionId) || null;
  }

  getAPI(): ExtensionAPI {
    return this.api;
  }
}

export const extensionManager = new ExtensionManager();
