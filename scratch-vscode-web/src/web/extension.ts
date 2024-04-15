import * as vscode from 'vscode';
import { ScratchEditorProvider } from './scratchEditor';

export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(
		ScratchEditorProvider.register(context),
	);
}
