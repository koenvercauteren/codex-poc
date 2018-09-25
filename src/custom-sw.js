localforage.config({
  name: 'My-IDB'
})

// See https://developers.google.com/web/tools/workbox/guides/configure-workbox
workbox.core.setLogLevel(workbox.core.LOG_LEVELS.debug);

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// We need this in Webpack plugin (refer to swSrc option):
// https://developers.google.com/web/tools/workbox/modules/workbox-webpack-plugin#full_injectmanifest_config
workbox.precaching.precacheAndRoute(self.__precacheManifest);

const blobHandler = ({ url, event }) => (
  fetch(event.request)
    .then(response => response.blob())
    .then(blob =>
      localforage
        .setItem(url.href, blob)
        .then(() => new Response(blob, {
          status: 200,
          statusText: "OK",
        }))
    )
    .catch(() =>
      localforage
        .getItem(url.href)
        .then(val => new Response(val, {
          status: 200,
          statusText: "OK",
        }))
    )
);

const pdfHandler = ({ url, event }) => (
  fetch(event.request)
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => {
      console.log(url.href);
      return localforage
        .setItem(url.href, arrayBuffer)
        .then(() => new Response(arrayBuffer, {
          status: 200,
          statusText: "OK",
        }))
    })
    .catch(() =>
      localforage
        .getItem(url.href)
        .then(val => new Response(val, {
          status: 200,
          statusText: "OK",
        }))
    )
);


// app-shell
workbox.routing.registerRoute('/', workbox.strategies.networkFirst());

// external
workbox.routing.registerRoute('https://pakket-p-public.s3.amazonaws.com/pdf/506764_6063_bl_spitze3_lr1.pdf', pdfHandler);
workbox.routing.registerRoute('https://pakket-p-public.s3.amazonaws.com/pdf/506764_6063_ol_spitze3_lr1.pdf', pdfHandler);

workbox.routing.registerRoute('https://pakket-p-public.s3.amazonaws.com/mp3/test.mp3', blobHandler);
workbox.routing.registerRoute('https://pakket-p-public.s3.amazonaws.com/mp4/test.mp4', blobHandler);
