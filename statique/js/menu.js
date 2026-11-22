// Le menu du haut : grands menus au survol ou au clic (ordinateur), tiroir avec des tiroirs dedans (téléphone).
(function () {
  var nav = document.getElementById("menu-principal");
  if (!nav) return;
  var tiroir = document.querySelector(".mm-tiroir");
  var boutons = Array.prototype.slice.call(nav.querySelectorAll(".mm-bouton"));
  var grand = window.matchMedia("(min-width: 1001px)");
  var minuterie = null;

  function panneau(b) { return document.getElementById(b.getAttribute("aria-controls")); }
  function ouvrir(b, oui) {
    boutons.forEach(function (x) {
      var o = oui && x === b;
      x.setAttribute("aria-expanded", o ? "true" : "false");
      panneau(x).hidden = !o;
    });
    document.documentElement.classList.toggle("mm-ouvert", !!oui && grand.matches);
    if (oui && b && grand.matches) recaler(panneau(b));
  }
  // les grands menus : au milieu de la page (jamais collés au bord de l'écran)
  function recaler(p) {
    p.style.marginLeft = "";
    var r = p.getBoundingClientRect(), d = (window.innerWidth - r.width) / 2 - r.left;
    if (Math.abs(d) > 1) p.style.marginLeft = Math.round(d) + "px";
  }
  function tout_fermer() { ouvrir(null, false); }

  boutons.forEach(function (b) {
    // ordinateur : le volet s'ouvre au survol, et un clic sur le titre mène à la page de la partie (la même que sa carte sombre) ;
    // téléphone : un clic ouvre le tiroir de la partie
    b.addEventListener("click", function () {
      if (grand.matches && b.dataset.href) { tout_fermer(); location.href = b.dataset.href; return; }
      ouvrir(b, b.getAttribute("aria-expanded") !== "true");
    });
    var item = b.parentNode;
    item.addEventListener("mouseenter", function () { if (!grand.matches) return; clearTimeout(minuterie); minuterie = setTimeout(function () { ouvrir(b, true); }, 90); });
    item.addEventListener("mouseleave", function () { if (!grand.matches) return; clearTimeout(minuterie); minuterie = setTimeout(tout_fermer, 160); });
    // au clavier : le volet s'ouvre quand le titre reçoit le focus, et se ferme quand on en sort
    item.addEventListener("focusin", function () { if (grand.matches && b.getAttribute("aria-expanded") !== "true") ouvrir(b, true); });
    item.addEventListener("focusout", function (e) { if (grand.matches && !item.contains(e.relatedTarget)) ouvrir(b, false); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var ouvert = boutons.filter(function (b) { return b.getAttribute("aria-expanded") === "true"; })[0];
    tout_fermer();
    if (ouvert) ouvert.focus();
  });
  document.addEventListener("click", function (e) { if (grand.matches && !nav.contains(e.target)) tout_fermer(); });

  if (tiroir) {
    tiroir.addEventListener("click", function () {
      var oui = tiroir.getAttribute("aria-expanded") !== "true";
      tiroir.setAttribute("aria-expanded", oui ? "true" : "false");
      tiroir.setAttribute("aria-label", oui ? "Fermer le menu" : "Ouvrir le menu");
      nav.classList.toggle("mm-visible", oui);
      document.documentElement.classList.toggle("mm-tiroir-ouvert", oui);
      if (!oui) tout_fermer();
    });
  }
  grand.addEventListener("change", function () {
    tout_fermer();
    if (tiroir) { tiroir.setAttribute("aria-expanded", "false"); nav.classList.remove("mm-visible"); document.documentElement.classList.remove("mm-tiroir-ouvert"); }
  });
})();

// Le bouton « statistiques » : ouvre et ferme la petite fenêtre « Le site en chiffres »
(function () {
  var b = document.querySelector(".jm-st"), p = document.getElementById("jm-st-panneau");
  if (!b || !p) return;
  function montrer(oui) { b.setAttribute("aria-expanded", oui ? "true" : "false"); p.hidden = !oui; }
  b.addEventListener("click", function (e) { e.stopPropagation(); montrer(p.hidden); });
  document.addEventListener("click", function (e) { if (!p.hidden && !p.contains(e.target)) montrer(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !p.hidden) { montrer(false); b.focus(); } });
})();

