// Mundicacau CRM · service worker: guarda a app para abrir depressa; os dados vêm sempre do Supabase.
const CACHE = "crm-vending-teste-v23";
const SHELL = ["./", "index.html", "config.js", "maquinas.js", "oficina.js", "offline.js", "logo.png", "extrato.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== "oficina-cdn" && k !== "oficina-img").map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // bibliotecas e letras (CDN): guardar para a app abrir sem rede
  if (/(^|\.)(cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname)) {
    e.respondWith(caches.open("oficina-cdn").then(c => c.match(e.request).then(r => r || fetch(e.request).then(n => { if (n.ok || n.type === "opaque") c.put(e.request, n.clone()); return n; }))));
    return;
  }
  // fotos e desenhos do servidor: guardar a última cópia para ver sem rede (chave sem o código temporário)
  if (u.pathname.includes("/storage/v1/object/")) {
    const chave = u.origin + decodeURIComponent(u.pathname).replace("/object/sign/", "/object/x/").replace("/object/public/", "/object/x/");
    e.respondWith(fetch(e.request).then(n => { if (n.ok) { const c = n.clone(); caches.open("oficina-img").then(x => x.put(chave, c)); } return n; })
      .catch(() => caches.open("oficina-img").then(x => x.match(chave)).then(r => r || Response.error())));
    return;
  }
  if (u.origin !== location.origin) return; // resto do Supabase passa direto
  e.respondWith(
    fetch(e.request,{cache:"no-cache"}).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match("index.html")))
  );
});
