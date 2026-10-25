// Retire the legacy worker, which cached every GET including authenticated requests.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 await caches.delete('mcp-core-v027');
 await self.registration.unregister();
 await self.clients.claim();
})()));
