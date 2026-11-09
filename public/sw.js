/* Service worker da Sakura & Sal: só mostra as notificações da gestão. Não guarda o site em cache. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", ev => ev.waitUntil(self.clients.claim()));

self.addEventListener("push", ev => {
  let d = {};
  try { d = ev.data ? ev.data.json() : {}; } catch (e) { d = { body: ev.data ? ev.data.text() : "" }; }
  ev.waitUntil(self.registration.showNotification(d.title || "Sakura & Sal", {
    body: d.body || "", icon: "/img/icon-192.png", badge: "/img/favicon.png", data: { url: d.url || "/" }
  }));
});

self.addEventListener("notificationclick", ev => {
  ev.notification.close();
  const url = new URL((ev.notification.data && ev.notification.data.url) || "/", self.location.origin).href;
  ev.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(janelas => {
    const j = janelas.find(w => "focus" in w);
    if (j) return (j.navigate ? j.navigate(url) : Promise.resolve(j)).then(w => (w || j).focus());
    return self.clients.openWindow(url);
  }));
});
