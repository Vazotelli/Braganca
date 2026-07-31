// service worker — cache dos assets para a app funcionar sem rede.
//
// Estrategia (importante):
//   • codigo da app (html/js/css) -> REDE PRIMEIRO, cache so' como salvaguarda.
//     Assim uma correcao publicada chega sempre ao browser. (A versao anterior
//     era cache-first e deixava os ficheiros velhos presos indefinidamente.)
//   • plantas (imagens/pdf) -> CACHE PRIMEIRO (sao pesadas e nunca mudam).
//   • outros dominios (ex.: script.google.com do sync) -> nao intercetar.
const CACHE = "obra-braganca-v5";

const NUCLEO = [
  "./", "index.html", "css/estilo.css",
  "js/app.js", "js/estado.js", "js/dados.js", "js/utils.js", "js/ui.js",
  "js/custos.js", "js/medicoes.js", "js/pagamentos.js", "js/cronograma.js",
  "js/plantas.js", "js/plantas_dados.js", "js/painel.js", "js/venda.js",
  "js/registo.js", "js/exportar.js", "js/sincronizar.js", "js/vendor/xlsx.mini.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // cache:"reload" obriga a ir a' rede: sem isto o precache podia copiar
      // ficheiros velhos do cache HTTP do browser.
      .then((c) => c.addAll(NUCLEO.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // sync, fontes, etc.: passar

  // plantas: cache primeiro (ficheiros grandes e estaveis)
  if (url.pathname.includes("/plantas/")) {
    e.respondWith(
      caches.match(req).then((resp) =>
        resp || fetch(req).then((r) => {
          if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
          return r;
        })
      )
    );
    return;
  }

  // codigo da app: rede primeiro, cache como salvaguarda (offline)
  e.respondWith(
    fetch(req)
      .then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
        return r;
      })
      .catch(() => caches.match(req).then((resp) => resp || caches.match("index.html")))
  );
});
