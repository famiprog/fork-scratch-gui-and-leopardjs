vscode = acquireVsCodeApi();

// Because the iframe inside the webview doesn't have access to acquireVsCodeApi()
// The webview has to intermediate the communitation between the iframe and the extension
window.addEventListener('message', event => {
    // The address of the webview looks different for when the vscode is run vs the desktop mode: 
    // in browser:  http://1lvf4l8k83bn7sugbsdaocr15as7ohic0uaq9artcupih4pf5d13.localhost:3000
    // the desktop mode: vscode-webview://1gotics9d5sev87elij9q86nt3db061kfk708mkkdjicj77hj19o
    if (event.origin.includes('localhost:3000') || event.origin.includes('vscode-webview')) {
        // Redirect the event from extension - iframe
        iframe.contentWindow.postMessage(event.data, "*");
    } else if (event.origin.includes('localhost:8601')) {
        // Redirect the event from iframe -> extension
        vscode.postMessage(event.data);
    }
});