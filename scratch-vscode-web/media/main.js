vscode = acquireVsCodeApi();

// Because the iframe inside the webview doesn't have access to acquireVsCodeApi()
// The webview has to intermediate the communitation between the iframe and the extension
window.addEventListener('message', event => {
    if (event.origin.includes('localhost:3000')) {
        // Redirect the event from extension - iframe
        iframe.contentWindow.postMessage(event.data, "*");
    } else {
        // Redirect the event from iframe -> extension
        vscode.postMessage(event.data);
    }
});