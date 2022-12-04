import { commands, ConfigurationChangeEvent, DiagnosticCollection, DidChangeTextDocumentParams, Disposable, ExtensionContext, TextDocument, Uri, workspace } from 'coc.nvim';
import { PythonSettings } from '../configSettings';
import { LintingEngine } from './linters/lintingEngine';

export class LinterProvider implements Disposable {
  private context: ExtensionContext;
  private disposables: Disposable[];
  private pythonSettings: PythonSettings;
  private engine: LintingEngine;

  public constructor(context: ExtensionContext) {
    this.context = context;
    this.disposables = [];

    this.engine = new LintingEngine();
    this.pythonSettings = PythonSettings.getInstance();

    workspace.onDidOpenTextDocument((e) => this.onDocumentOpened(e), this.context.subscriptions);
    workspace.onDidCloseTextDocument((e) => this.onDocumentClosed(e), this.context.subscriptions);
    workspace.onDidSaveTextDocument((e) => this.onDocumentSaved(e), this.context.subscriptions);
    workspace.onDidChangeTextDocument(e => this.onDocumentChanged(e), this.context.subscriptions);

    const disposable = workspace.onDidChangeConfiguration(this.lintSettingsChangedHandler.bind(this));
    this.disposables.push(disposable);

    this.disposables.push(commands.registerCommand('python.runLinting', this.runLinting.bind(this)));

    setTimeout(() => this.engine.lintOpenPythonFiles().catch(this.emptyFn), 1200);
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }

  private runLinting(): Promise<DiagnosticCollection> {
    return this.engine.lintOpenPythonFiles();
  }

  private lintSettingsChangedHandler(e: ConfigurationChangeEvent) {
    // Look for python files that belong to the specified workspace folder.
    workspace.textDocuments.forEach((document) => {
      if (e.affectsConfiguration('python.linting', document.uri)) {
        this.engine.lintDocument(document).catch(() => {});
      }
    });
  }

  private onDocumentOpened(document: TextDocument): void {
    this.engine.lintDocument(document).catch(() => {});
  }

  private onDocumentSaved(document: TextDocument): void {
    if (this.pythonSettings.linting.lintOnSave) {
      this.engine.lintDocument(document).catch(() => {});
    }
  }

  private onDocumentChanged(e: DidChangeTextDocumentParams) {
    const document = workspace.getDocument(e.textDocument.uri);
    this.engine.lintDocument(document.textDocument).catch(() => {});
  }

  private onDocumentClosed(document: TextDocument) {
    if (!document || !Uri.parse(document.uri).fsPath || !document.uri) {
      return;
    }

    this.engine.clearDiagnostics(document);
  }

  private emptyFn(): void {
    // noop
  }
}
