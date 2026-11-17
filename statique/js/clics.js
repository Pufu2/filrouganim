/* Fil Roug'Anim : ce que le site apporte aux organismes de formation. Un compteur par jour et par organisme :
   les vues de sa page, et les clics vers ses sessions et son site. Rien de personnel n'est envoyé. */
(function () {
  "use strict";
  var s = document.currentScript, url = s && s.dataset.url, cle = s && s.dataset.cle;
  if (!url || !cle || navigator.webdriver) return;
  function compter(o, t) {
    if (!o) return;
    try {
      fetch(url + "/rest/v1/rpc/compter_organisme", { method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json", apikey: cle }, body: JSON.stringify({ o: o, t: t }) }).catch(function () {});
    } catch (e) {}
  }
  var v = document.getElementById("org-vue");
  if (v) { var k = "fra-org-vu:" + location.pathname, deja = false;
    try { deja = sessionStorage.getItem(k) === "1"; sessionStorage.setItem(k, "1"); } catch (e) {}
    if (!deja) compter(v.dataset.org, "vue_page"); }
  function clic(e) { var a = e.target.closest && e.target.closest("[data-org-t]"); if (a) compter(a.dataset.org, a.dataset.orgT); }
  document.addEventListener("click", clic);
  document.addEventListener("auxclick", function (e) { if (e.button === 1) clic(e); });
})();
