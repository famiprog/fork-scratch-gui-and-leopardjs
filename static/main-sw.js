const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav'
    // Add more mappings as needed
};

function getParentClientId(clientUrl) {
    var urlObject = new URL(clientUrl);
    var searchParams = new URLSearchParams(urlObject.search);
    var parentClientId = searchParams.get("parentAppClientId");
    return parentClientId;
}

self.onmessage = async function(event) {
    if (event.data.type === 'getClientId') {
        // Inform the client about its id in order to be passed back as a parameter of the iframe src
        // We need this because the service worker isn't aware of any relation between the iframe that requests the leopard files,
        // and the scratch parent app. The service worker message needs the id of the parent client app in order to get the requested files from vscode
        event.source.postMessage({ type: 'getClientIdResponse', clientId: event.source.id});
    }
};

/**
 * Because the comunication with vscode is asyncronous we need to match the responses with their corresponding requests
 * In order to know which received content corresponds to which requested file
 */
function generateUIdForGetFileRequest(clientId, fileURL) {
    return `${clientId}_${fileURL}`;
}

function isLeopardFileRequested(url) {
    // The simple check: `.includes("leopard")` doesn't work keywork because
    // for "https://unpkg.com/leopard@^1/dist/index.esm.js" the default fetching mechanism should be used
    return url.includes("leopard/") || url.includes("leopard_ext/");
}

function get404Response(requestUrl) {
    return new Response(`File not found: ${requestUrl} `, {
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({
            'Content-Type': 'text/plain' // Set the content type as needed
        })
    });
}

self.addEventListener("fetch", function(event) {
    const urlString = event.request.url;
    const url = new URL(urlString);

    if (!isLeopardFileRequested(urlString)) {
        event.respondWith(
            fetch(event.request)
        );
        return;
    }

    // Request the leopard files from VSCode
    const responsePromise = new Promise(async function(resolve) {
        var clientUrl;
        // We need the client url in order to obtain the parent of the iframe clientId 
        const clients = await self.clients.matchAll({ includeUncontrolled: true });
        if (urlString.includes("index.html")) {
            // The src of the iframe is the client url
            clientUrl = urlString;
        } else {
            for (const client of clients) {
                if (client.id === event.clientId) {
                    if (client.url.includes("index.html") && (new URL(client.url).origin == url.origin)) {
                    clientUrl = client.url;
                    break;
                    } 
                }
            } 
        }

        // Find the client corresponding to the parentClientId
        const parentClientId = getParentClientId(clientUrl)
        var parentClient;
        for (const client of clients) {
            if (client.id === parentClientId) {
                //   return await getLeopardFileFromCache(getParentClientId(client.url), "." + url.pathname);
                parentClient = client;
                break;
            }
        } 
        
        if (!parentClient) {
            throw new Error("No parent client found for the request of " + urlString);
        }

        // Respond to the initial "fetch" with the file received from vscode
        const pathAndExtension = url.pathname.split('.');
        if (pathAndExtension.length < 2) {
            throw new Error("For the moment only requesting files (with a proper extension) works inside the iframe and " + url + " doesn't have an extension");
        }

        // Listen for file received from VSCode
        const getFileFromVSCodeHandler = function(event) {
            if (event.data && event.data.type === 'getFileFromVSCodeResponse' && event.data.requestUId == requestUId) {
                // Remove the message event listener once the response is received
                self.removeEventListener('message', getFileFromVSCodeHandler);
                if (!event.data.fileContent) {
                    resolve(get404Response(urlString));
                } else {
                    resolve(new Response(event.data.fileContent, { headers: { 'Content-Type': MIME_TYPES["." + pathAndExtension[pathAndExtension.length - 1]]}}));
                }
            }
            };
        self.addEventListener('message', getFileFromVSCodeHandler);

        // Request file from VSCode
        const requestUId = generateUIdForGetFileRequest(parentClientId, url.pathname);
        parentClient.postMessage({ type: 'getFileFromVSCode', path: url.pathname, requestUId});
      });

    event.respondWith(responsePromise); 
});

