import * as vscode from 'vscode';

const PARENT_FOLDER = "workspace";
const SCRATCH_FOLDER = "scratch";
const SCRATCH_FILE = "project.sb3";
const LEOPARD_FOLDER = "leopard";

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('scratch-vscode-web.start', () => {
			ScratchPanel.create(context.extensionUri);
		})
	);
}

function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
	return {
		// Enable javascript in the webview
		enableScripts: true,
		// And restrict the webview to only loading content from our extension's `media` directory.
		localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
	};
}

class ScratchPanel {
	public static readonly viewType = 'scratch-vscode-web';
	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	public static create(extensionUri: vscode.Uri) {
		const panel = vscode.window.createWebviewPanel(
			ScratchPanel.viewType,
			'Scratch + Leopard',
			vscode.ViewColumn.One,
			getWebviewOptions(extensionUri),
		);
		new ScratchPanel(panel, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
		
		this._panel.webview.onDidReceiveMessage(
			async message => {
				switch (message.command) {
					case 'load files':
						let files: {[key: string]: any} = {};
						// Read the files
						files["project.sb3"] = await vscode.workspace.fs.readFile(vscode.Uri.file(`${PARENT_FOLDER}/${SCRATCH_FOLDER}/${SCRATCH_FILE}`));
						await this.readFilesInFolder(vscode.Uri.parse(`${PARENT_FOLDER}/${LEOPARD_FOLDER}`), files);
						// Message the webview to redirect further to the scratch app
						this._panel.webview.postMessage({command: "load files response", files});
						return;
					case 'save files':
						await this.createNewOrClearOldOutputFolder();
						// Write the files
						await this.writeFile(`${SCRATCH_FOLDER}/${SCRATCH_FILE}`, message.files["scratch"]);
						for (const [url, content] of Object.entries(message.files["leopard"] )) {
							await this.writeFile(`${LEOPARD_FOLDER}/${url.replace("./", "")}`, content as Uint8Array|ArrayBuffer|String);
						}
						
						vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer'); 
					return; 	
				}
			},
			null,
			this._disposables
		);
	}

	async readFilesInFolder(folderPath:vscode.Uri, outputFiles:{[key: string]: any}) {
		const fileEntries = await vscode.workspace.fs.readDirectory(folderPath);
		for (const [name, type] of fileEntries) {
			const uri:vscode.Uri = vscode.Uri.joinPath(folderPath, name);
			if (type === vscode.FileType.File) {
				// add the file to the map
				outputFiles[uri.path.replace(`/${PARENT_FOLDER}/${LEOPARD_FOLDER}`, '.')] = await vscode.workspace.fs.readFile(vscode.Uri.file(uri.path));
				const path = uri.path.replace(`/${PARENT_FOLDER}/`, '');
			} else {
				// read folder recursive
				await this.readFilesInFolder(uri, outputFiles);
			}
		}
	}

	async createNewOrClearOldOutputFolder() {
		const outputFolderUri = vscode.Uri.file(PARENT_FOLDER);
		try {
			// Check if the folder exists
			const folderExists = await vscode.workspace.fs.stat(outputFolderUri).then(stats => stats.type === vscode.FileType.Directory, () => false);
	
			if (folderExists) {
				// Get list of files in the folder
				const files = await vscode.workspace.fs.readDirectory(outputFolderUri);
	
				// Delete each file in the folder
				for (const [name, type] of files) {
					const fileUri = vscode.Uri.joinPath(outputFolderUri, name);
					await vscode.workspace.fs.delete(fileUri, { recursive: true });
				}
			} else {
				await vscode.workspace.fs.createDirectory(outputFolderUri);
			}
		} catch (error: any) {
			vscode.window.showErrorMessage(`Error: ${error.message}`);
		}
	}

	async writeFile(fileName: string, content:Uint8Array|ArrayBuffer|String) {
		console.log(fileName);
	    content = (typeof content === 'string') ? new TextEncoder().encode(content) : new Uint8Array(content as Uint8Array|ArrayBuffer)
		await vscode.workspace.fs.writeFile(vscode.Uri.file(`${PARENT_FOLDER}/${fileName}`), content as Uint8Array);
	}

	public dispose() {
		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update() {
		this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Use a nonce to only allow specific scripts to be run
		const nonce = getNonce();
		const stylesPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css');
		const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js');
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
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
