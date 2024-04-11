import * as vscode from 'vscode';
import { ScratchEditorProvider } from './scratchEditor';

export function activate(context: vscode.ExtensionContext) {
	vscode.workspace.getConfiguration().update('files.autoSave', 'off');

	context.subscriptions.push(
		ScratchEditorProvider.register(context),
	);
}
