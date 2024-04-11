const mimeTypes = {
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

// Function to get the cache name for a specific client
function getCacheName(clientId) {
    return 'leopard-files-' + clientId;
}

// Function to store data in cache for a specific client
async function cacheLeopardFilesForClient(clientId, data) {
    const cacheName = getCacheName(clientId);
    const cache = await caches.open(cacheName);
    for (let fileName in data) {
        // Look at the extension to determine the response content type
        const urlParts = fileName.split('.');
        if (urlParts.length < 2) {
            throw new Error("For the moment only requesting files (with a proper extension) works inside the iframe and " + url + " doesn't have an extension");
        }
        // Don't know why leopard outputs the costumes and sound files named starting with "./" 
        // but the stage and costume files names doesn't start with ./
        await cache.put(fileName.startsWith("./") ? fileName : ("./" + fileName), new Response(data[fileName], { headers: { 'Content-Type': mimeTypes["." + urlParts[urlParts.length - 1]]} }));  
    }
}

async function getLeopardFileFromCache(clientId, fileName) {
    const cacheName = getCacheName(clientId);
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(fileName);

    if (!cachedResponse) {
        console.log("There was a problem when generating/loading from disk the leopard files for client " + clientId + ": " + fileName + " is missing");
    }
    return cachedResponse;
}

function getParentClientId(clientUrl) {
    var urlObject = new URL(clientUrl);
    var searchParams = new URLSearchParams(urlObject.search);
    var parentClientId = searchParams.get("parentAppClientId");
    return parentClientId;
}

self.onmessage = async function(event) {
    if (event.data == "cleanupCache") {
        const cacheName = getCacheName(event.source.id);
        caches.open(cacheName).then(function(cache) {
            cache.keys().then(function(keys) {
                keys.forEach(function(request, index, array) {
                    cache.delete(request);
                });
            });
        });
    } else {
        // Cache the received leopard files in order to serve them when they will be requested by the iframe
        await cacheLeopardFilesForClient(event.source.id, event.data); 
        // Inform the client about its id in order to be passed back as a parameter of the iframe src
        // We need this because the service worker isn't aware of any relation between the main app client and the iframe client inside of it
        // But we need to serve, for an iframe, the exact leopard files generated in its exact parent app. 
        // This allows us to have many tabs opened with our application and each to have different leopard projects opened 
        event.source.postMessage(event.source.id);
    }
};



self.addEventListener("fetch", function(event) {
    const urlString = event.request.url;
    const url = new URL(urlString);
    if (urlString.includes("leopard.html")) {
        var parentClientId = getParentClientId(urlString);
        
        event.respondWith(
            (async function() {
                return await getLeopardFileFromCache(parentClientId, "./index.html");
            })()
        ); 
    } else {
        event.respondWith(
            (async function() {
              const clients = await self.clients.matchAll({ includeUncontrolled: true });
              
              for (const client of clients) {
                if (client.id === event.clientId) {
                  if (client.url.includes("leopard.html") && (new URL(client.url).origin == url.origin)) {
                    return await getLeopardFileFromCache(getParentClientId(client.url), "." + url.pathname);
                  } else {
                    return fetch(event.request);
                  }
                }
              }
              
              // If no matching client is found, proceed with default response
              return fetch(event.request);
            })()
          );
        }
});

