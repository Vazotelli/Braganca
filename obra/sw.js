// service worker — cache dos assets para a app funcionar sem rede.
// Bump a versao quando mudares ficheiros para forcar atualizacao do cache.
const CACHE = "obra-braganca-v4";

const NUCLEO = [
  "./", "index.html", "css/estilo.css",
  "js/app.js", "js/estado.js", "js/dados.js", "js/utils.js", "js/ui.js",
  "js/custos.js", "js/medicoes.js", "js/pagamentos.js", "js/cronograma.js",
  "js/plantas.js", "js/plantas_dados.js", "js/painel.js", "js/venda.js",
  "js/registo.js", "js/exportar.js", "js/sincronizar.js", "js/vendor/xlsx.mini.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(NUCLEO)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// cache-first; o que for novo (ex.: plantas) fica em cache ao ser pedido
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((resp) =>
      resp || fetch(e.request).then((r) => {
        if (r.ok && r.type === "basic") {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return r;
      }).catch(() => resp)
    )
  );
});
