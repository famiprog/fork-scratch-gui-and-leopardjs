import * as vscode from 'vscode';
import { Disposable, disposeAll } from './dispose';

const LEOPARD_FOLDER = "leopard";

interface ScratchDocumentDelegate {
	getFileData(): Promise<any>;
}

/**
 * This editor was inspired from the vscode official example for creating custom editors:
 * https://github.com/microsoft/vscode-extension-samples/tree/main/custom-editor-sample
 */
class ScratchDocument extends Disposable implements vscode.CustomDocument {

	static async create(
		uri: vscode.Uri,
        //TODO DB how we test this backup
		backupId: string | undefined,
		delegate: ScratchDocumentDelegate,
	): Promise<ScratchDocument | PromiseLike<ScratchDocument>> {
		// If we have a backup, read that. Otherwise read the resource from the workspace
		const dataFile = typeof backupId === 'string' ? vscode.Uri.parse(backupId) : uri;
		const fileData = await ScratchDocument.readFile(dataFile);
		return new ScratchDocument(uri, fileData, delegate);
	}

	private static async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		if (uri.scheme === 'untitled') {
			return new Uint8Array();
		}
		return new Uint8Array(await vscode.workspace.fs.readFile(uri));
	}

	private readonly _uri: vscode.Uri;

	private _documentData: Uint8Array;

	private readonly _delegate: ScratchDocumentDelegate;

	private constructor(
		uri: vscode.Uri,
		initialContent: Uint8Array,
		delegate: ScratchDocumentDelegate
	) {
		super();
		this._uri = uri;
		this._documentData = initialContent;
		this._delegate = delegate;
	}

	public get uri() { return this._uri; }

	public get documentData(): Uint8Array { return this._documentData; }

	private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
	/**
	 * Fired when the document is disposed of.
	 */
	public readonly onDidDispose = this._onDidDispose.event;

	private readonly _onDidChangeDocument = this._register(new vscode.EventEmitter<{
		readonly content?: Uint8Array;
	}>());

	/**
	 * Fired to notify webviews that the document has changed.
	 */
	public readonly onDidChangeContent = this._onDidChangeDocument.event;

	private readonly _onDidChange = this._register(new vscode.EventEmitter<{
		readonly label: string,
	}>());

	/**
	 * Fired to tell VS Code that an edit has occurred in the document.
	 *
	 * This updates the document's dirty indicator.
	 */
	public readonly onDidChange = this._onDidChange.event;

	/**
	 * Called by VS Code when there are no more references to the document.
	 *
	 * This happens when all editors for it have been closed.
	 */
	dispose(): void {
		this._onDidDispose.fire();
		super.dispose();
	}

	/**
	 * Called when the user edits the document in a webview.
	 *
	 * This fires an event to notify VS Code that the document has been edited.
	 */
        makeEdit() {

		this._onDidChange.fire({
            label: 'Content',
		});
	}

	/**
	 * Called by VS Code when the user saves the document.
	 */
	async save(cancellation: vscode.CancellationToken): Promise<void> {
		await this.saveAs(this.uri, cancellation);
	}

	/**
	 * Called by VS Code when the user saves the document to a new location.
	 * Or when VS Code trigger a backup
	 */
	async saveAs(targetResource: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
		const filesData = await this._delegate.getFileData();
		if (cancellation.isCancellationRequested) {
			return;
		}

		await vscode.workspace.fs.writeFile(targetResource, filesData);
        
        vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer'); 
	}

	/**
	 * Called by VS Code when the user calls `revert` on a document.
	 */
    // TODO DB: Test this
	async revert(_cancellation: vscode.CancellationToken): Promise<void> {
		const diskContent = await ScratchDocument.readFile(this.uri);
		this._documentData = diskContent;
		this._onDidChangeDocument.fire({
			content: diskContent,
		});
	}

	/**
	 * Called by VS Code to backup the edited document.
	 *
	 * These backups are used to implement hot exit.
	 */
    // TODO DB: Test this
	async backup(destination: vscode.Uri, cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
		await this.saveAs(destination, cancellation);

		return {
			id: destination.toString(),
			delete: async () => {
				try {
					await vscode.workspace.fs.delete(destination);
				} catch {
					// noop
				}
			}
		};
	}
}

export class ScratchEditorProvider implements vscode.CustomEditorProvider<ScratchDocument> {

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		// TODO DB: In the vscode "custom-editor-sample" was added a command for creating a new empty file.
		// Maybe we also need some mechanism for the first time a user starts using our app.
		// And he doesn't have a .sb3 file in its workspace.

		return vscode.window.registerCustomEditorProvider(
			ScratchEditorProvider.viewType,
			new ScratchEditorProvider(context),
			{
				webviewOptions: {
                    // TODO DB: make this true for testing purpose
 					retainContextWhenHidden: true,
				},
				supportsMultipleEditorsPerDocument: false,
			});
	}

	private static readonly viewType = 'scratch-vs-code-web.scratch-editor';

	/**
	 * Tracks all known webviews
	 */
    // TODO DB: why we need this because above we have supportsMultipleEditorsPerDocument:false
	private readonly webviews = new WebviewCollection();

	constructor(
		private readonly _context: vscode.ExtensionContext
	) { }

	async openCustomDocument(
		uri: vscode.Uri,
		openContext: { backupId?: string },
		_token: vscode.CancellationToken
	): Promise<ScratchDocument> {
		const document: ScratchDocument = await ScratchDocument.create(uri, openContext.backupId, {
			getFileData: async () => {
				const webviewsForDocument = Array.from(this.webviews.get(document.uri));
				if (!webviewsForDocument.length) {
					throw new Error('Could not find webview to save for');
				}
				const panel = webviewsForDocument[0];
				const response = await this.postMessageWithResponse<number[]>(panel, 'getScratchFile', {});

                return response;
			}
		});

		const listeners: vscode.Disposable[] = [];

		listeners.push(document.onDidChange(e => {
			// Tell VS Code that the document has been edited by the user.
			this._onDidChangeCustomDocument.fire({
				document,
				...e,
			});
		}));

		listeners.push(document.onDidChangeContent(e => {
			// Update all webviews when the document changes
			for (const webviewPanel of this.webviews.get(document.uri)) {
				this.postMessage(webviewPanel, 'update', {
					content: e.content,
				});
			}
		}));

		document.onDidDispose(() => disposeAll(listeners));

		return document;
	}

	async resolveCustomEditor(
		document: ScratchDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		// Add the webview to our internal set of active webviews
		this.webviews.add(document.uri, webviewPanel);

		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true,
		};
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

		webviewPanel.webview.onDidReceiveMessage(e => this.onMessage(document, webviewPanel, e));
	}

	private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<ScratchDocument>>();
	public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

	public saveCustomDocument(document: ScratchDocument, cancellation: vscode.CancellationToken): Thenable<void> {
		return document.save(cancellation);
	}

	public saveCustomDocumentAs(document: ScratchDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Thenable<void> {
		return document.saveAs(destination, cancellation);
	}

	public revertCustomDocument(document: ScratchDocument, cancellation: vscode.CancellationToken): Thenable<void> {
		return document.revert(cancellation);
	}

	public backupCustomDocument(document: ScratchDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> {
		return document.backup(context.destination, cancellation);
	}

	/**
	 * Get the static HTML used for in our editor's webviews.
	 */
    private getHtmlForWebview(webview: vscode.Webview) {
		// Use a nonce to only allow specific scripts to be run
		const nonce = getNonce();
		const stylesPath = vscode.Uri.joinPath(this._context.extensionUri, 'media', 'style.css');
		const scriptPathOnDisk = vscode.Uri.joinPath(this._context.extensionUri, 'media', 'main.js');
		const stylesUri = webview.asWebviewUri(stylesPath);
		const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
		return `<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="UTF-8">
					<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src 'self' http://localhost:8601; style-src 'self' ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<link href="${stylesUri}" rel="stylesheet">
					<script nonce="${nonce}" src="${scriptUri}"></script>
				</head>
				<body>
					<iframe id="iframe" src="http://localhost:8601"></iframe>
				</body>
			</html>`;
	}

	private _requestId = 1;
	private readonly _callbacks = new Map<number, (response: any) => void>();

	private postMessageWithResponse<R = unknown>(panel: vscode.WebviewPanel, type: string, body: any): Promise<R> {
		const requestId = this._requestId++;
		const p = new Promise<R>(resolve => this._callbacks.set(requestId, resolve));
		panel.webview.postMessage({ type, requestId, body });
		return p;
	}

	private postMessage(panel: vscode.WebviewPanel, type: string, body: any): void {
		panel.webview.postMessage({ type, body });
	}

	private async onMessage(document: ScratchDocument, webviewPanel: vscode.WebviewPanel, message: any) {
		switch (message.type) {
			// Equivalent to `init` from the `custom-editor-sample/pawEditorDraw`
			case 'loadScratchFile':
				webviewPanel.webview.postMessage({type: "loadScratchFileResponse", body: document.documentData});
				break;

			case 'getFile':
				const fileUri = vscode.Uri.joinPath(getParentFolder(document.uri), message.body);
				const baseResponse =  {type: "getFileResponse", requestUId: message.requestUId};
				try {
					const fileContent = await vscode.workspace.fs.readFile(fileUri);
					webviewPanel.webview.postMessage({...baseResponse, fileContent});
					break;
				} catch (error) {
					console.log(`File ${fileUri} not found`);
					webviewPanel.webview.postMessage({...baseResponse});
				}
				break;

			case 'saveLeopardFiles':
				const leopardFolderUri = vscode.Uri.joinPath(getParentFolder(document.uri), LEOPARD_FOLDER);
				// Additional save also the associated leopard files (in a "leopard" folder placed besides the .sb3 file) 
				await deleteFolderRecursively(leopardFolderUri);
				for (const [url, content] of Object.entries(message.body)) {
					await writeFile(url.replace("./", ""), leopardFolderUri,  content as Uint8Array|ArrayBuffer|String);
				}
		
				vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
				webviewPanel.webview.postMessage({type: "saveLeopardFilesResponse"});	
				break;

			case 'scratchContentChanged':
				document.makeEdit();
                break;

			case 'response':
				{
					const callback = this._callbacks.get(message.requestId);
					callback?.(message.body);
					break;
				}
		}
	}
}

/**
 * Tracks all webviews.
 */ 
class WebviewCollection {

	private readonly _webviews = new Set<{
		readonly resource: string;
		readonly webviewPanel: vscode.WebviewPanel;
	}>();

	/**
	 * Get all known webviews for a given uri.
	 */
	public *get(uri: vscode.Uri): Iterable<vscode.WebviewPanel> {
		const key = uri.toString();
		for (const entry of this._webviews) {
			if (entry.resource === key) {
				yield entry.webviewPanel;
			}
		}
	}

	/**
	 * Add a new webview to the collection.
	 */
	public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
		const entry = { resource: uri.toString(), webviewPanel };
		this._webviews.add(entry);

		webviewPanel.onDidDispose(() => {
			this._webviews.delete(entry);
		});
	}
}

// Helper methods
function getParentFolder(uri: vscode.Uri):vscode.Uri {
    return vscode.Uri.joinPath(uri, '..');
}

async function deleteFolderRecursively(uri:vscode.Uri) {
	try {
		// Check if the folder exists
		const folderExists = await vscode.workspace.fs.stat(uri).then(stats => stats.type === vscode.FileType.Directory, () => false);
		if (folderExists) {
			// Get list of files in the folder
			const files = await vscode.workspace.fs.readDirectory(uri);

			// Delete each file in the folder and empty child folders recursively
			for (const [name, type] of files) {
				const fileUri = vscode.Uri.joinPath(uri, name);
				if (type === vscode.FileType.Directory) {
					await deleteFolderRecursively(fileUri);
				}
				await vscode.workspace.fs.delete(fileUri);
			}
		}
	} catch (error: any) {
		vscode.window.showErrorMessage(`Error: ${error.message}`);
	}
}

async function writeFile(fileName: string, parentURI: vscode.Uri, content:Uint8Array|ArrayBuffer|String) {
	content = (typeof content === 'string') ? new TextEncoder().encode(content) : new Uint8Array(content as Uint8Array|ArrayBuffer)
	await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(parentURI, fileName), content as Uint8Array);
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}