import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='dist/client';
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?files(`${dir}/${e.name}`):`${dir}/${e.name}`))).flat()}
const list=(await files(root)).filter(p=>!p.endsWith('/sw.js')&&!p.endsWith('.map'));const assets=['/',...list.map(p=>p.slice(root.length))];const hash=createHash('sha256');for(const f of list)hash.update(await readFile(f));const version='tu100-'+hash.digest('hex').slice(0,12);
await writeFile(`${root}/sw.js`,`const CACHE=${JSON.stringify(version)};const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('tu100-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match(event.request).then(hit=>hit||(event.request.mode==='navigate'?cache.match('/'):Response.error())))))});
`);console.log(`Offline package: ${assets.length} assets, ${version}`);
