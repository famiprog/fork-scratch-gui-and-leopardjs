import * as vscode from 'vscode';
import { ScratchEditorProvider } from './scratchEditor';


var scratchChannel: vscode.OutputChannel;
var isLoggingEnabled: boolean = true;

export function activate(context: vscode.ExtensionContext) {
    scratchChannel = vscode.window.createOutputChannel('Scratch');

	context.subscriptions.push(
		ScratchEditorProvider.register(context),
	);

	context.subscriptions.push(vscode.commands.registerCommand('scratch-vs-code-web.enableLogging', () => {
        isLoggingEnabled = true;
        vscode.window.showInformationMessage('Logging enabled for scratch extension');
    }));

    context.subscriptions.push(vscode.commands.registerCommand('scratch-vs-code-web.disableLogging', () => {
        isLoggingEnabled = false;
        vscode.window.showInformationMessage('Logging disabled for scratch extension');
    }));
}

export function deactivate() {
    if (scratchChannel) {
        scratchChannel.dispose();
    }
}

export function logScratchMessage(message: string) {
	if (isLoggingEnabled && scratchChannel) {
		const timestamp = Date.now();
		scratchChannel.appendLine(`[${timestamp}] ${message}`);
	}
}