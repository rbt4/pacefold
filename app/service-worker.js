// Legacy Pacefold 12 service-worker migration.
// Existing /app/ registrations install this once, unregister, and allow the
// root-scoped Pacefold 13 worker to take over the complete site.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    await self.registration.unregister();
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of clients){try{await client.navigate(client.url);}catch(_){}}
  })());
});
