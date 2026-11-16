/* L'administration habillée comme l'accueil du site : un bandeau brun-noir avec la barre blanche flottante
   (les grandes rubriques), le titre de la page dans le bandeau, puis les pages de la rubrique en onglets
   façon recherche de l'accueil, posés sur le contenu. Le menu latéral reste dans la page, caché : il porte
   toujours les onglets et les pastilles, ce module ne fait que les montrer autrement. */
(function () {
  "use strict";
  var V = null, B = null, enCours = false;
  var RUBRIQUES = { "Pilotage": "Aujourd'hui", "Utilisateurs": "Membres", "Acquisition": "Croissance", "Contenu": "Contenu" };
  var ACCROCHES = { accueil: "ne perds pas le fil de ta journée" };
  function el(tag, classe, texte) { var e = document.createElement(tag); if (classe) e.className = classe; if (texte != null) e.textContent = texte; return e; }

  // les rubriques et leurs pages, lues dans le menu latéral
  function groupes() {
    var nav = V.querySelector(".co-nav"), l = [], g = null;
    Array.prototype.forEach.call(nav.children, function (x) {
      if (x.classList.contains("co-groupe")) { g = { nom: x.textContent.trim(), pages: [] }; l.push(g); }
      else if (g && x.dataset && x.dataset.ongletVers) g.pages.push(x);
    });
    return l;
  }
  function pastille(b) { var p = b.querySelector(".co-pastille"); return p && !p.hidden && !p.classList.contains("co-pastille-neutre") ? (parseInt(p.textContent, 10) || 0) : 0; }

  function construire() {
    V = document.getElementById("v-admin");
    if (!V || B) return B;
    B = el("header", "ag-bandeau");
    var barre = el("div", "ag-barre");
    var m = V.querySelector(".co-marque");
    var logo = el("a", "ag-logo"); logo.href = m ? m.getAttribute("href") : "/"; logo.setAttribute("aria-label", "Fil Roug'Anim, retour au site");
    if (m) logo.innerHTML = m.innerHTML;
    barre.appendChild(logo);
    barre.appendChild(el("nav", "ag-rubriques"));
    var droite = el("div", "ag-droite"); droite.id = "ag-droite";
    var site = el("a", "ag-site", "Voir le site →"); site.href = "/"; droite.appendChild(site);
    barre.appendChild(droite);
    B.appendChild(barre);
    B.appendChild(el("div", "ag-titre"));
    B.appendChild(el("nav", "ag-onglets"));
    V.insertBefore(B, V.firstChild);
    new MutationObserver(function (ms) {
      if (enCours) return;
      if (ms.every(function (x) { return B.contains(x.target); })) return;
      requestAnimationFrame(maj);
    }).observe(V, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "aria-current", "hidden"] });
    maj();
    return B;
  }

  function maj() {
    if (!B || enCours) return;
    enCours = true;
    try { majBandeau(); } finally { setTimeout(function () { enCours = false; }, 0); }
  }
  function majBandeau() {
    var gs = groupes(), act = V.querySelector(".co-nav [aria-current]");
    var gAct = gs.filter(function (g) { return g.pages.indexOf(act) >= 0; })[0] || gs[0];
    // les rubriques
    var r = B.querySelector(".ag-rubriques"); r.textContent = "";
    gs.forEach(function (g) {
      var b = el("button", "ag-rubrique" + (g === gAct ? " ag-on" : "")); b.type = "button";
      b.dataset.ongletVers = g.pages[0].dataset.ongletVers;
      b.appendChild(document.createTextNode(RUBRIQUES[g.nom] || g.nom));
      var n = g.pages.reduce(function (a, p) { return a + pastille(p); }, 0);
      if (n) b.appendChild(el("i", null, n > 99 ? "99+" : String(n)));
      if (g === gAct) b.setAttribute("aria-current", "true");
      r.appendChild(b);
    });
    // les pages de la rubrique, en onglets
    var o = B.querySelector(".ag-onglets"); o.textContent = "";
    gAct.pages.forEach(function (p) {
      var b = el("button", "ag-onglet" + (p === act ? " ag-on" : "")); b.type = "button"; b.dataset.ongletVers = p.dataset.ongletVers;
      var svg = p.querySelector("svg"); if (svg) b.appendChild(svg.cloneNode(true));
      b.appendChild(el("span", null, (p.querySelector("span") || p).textContent));
      var n = pastille(p); if (n) b.appendChild(el("i", null, n > 99 ? "99+" : String(n)));
      o.appendChild(b);
    });
    // le titre : le haut de la page ouverte monte dans le bandeau (il garde ses boutons)
    var nom = act ? act.dataset.ongletVers : "";
    var sec = V.querySelector('[data-onglet="' + nom + '"]');
    var t = B.querySelector(".ag-titre");
    var dedans = t.firstElementChild;
    if (dedans && dedans.dataset.origine !== (sec ? sec.id : "")) {
      var d = document.getElementById(dedans.dataset.origine);
      if (d && !d.querySelector(".ap-hero")) d.insertBefore(dedans, d.firstChild); else dedans.remove();
      dedans = null;
    }
    var h = sec && sec.querySelector(".ap-hero");
    if (h) { if (dedans) dedans.remove(); h.dataset.origine = sec.id; t.appendChild(h); dedans = h; }
    if (!dedans) {
      var f = el("div", "ap-hero ag-hero-simple"); f.dataset.origine = sec ? sec.id : "";
      var g2 = el("div", "ap-hero-t");
      g2.appendChild(el("p", "ap-sur", (RUBRIQUES[gAct.nom] || gAct.nom).toLowerCase()));
      var h2 = el("h2"); h2.appendChild(document.createTextNode(act ? (act.querySelector("span") || act).textContent : "Administration")); g2.appendChild(h2);
      f.appendChild(g2); t.appendChild(f); dedans = f;
    }
    var sur = dedans.querySelector(".ap-sur");
    if (sur && ACCROCHES[nom]) { sur.textContent = ACCROCHES[nom]; }
    t.classList.toggle("ag-centre", !dedans.querySelector(".ap-hero-cote"));
  }

  window.FRA_ADMIN_G = { droite: function () { construire(); return document.getElementById("ag-droite"); }, maj: maj };
  // l'espace a pu s'ouvrir avant ce fichier : on se branche dès que l'administration est à l'écran
  function brancher() {
    if (!document.body.classList.contains("admin-g")) return;
    var d = window.FRA_ADMIN_G.droite(); if (!d) return;
    var bas = document.getElementById("co-bascule");
    if (bas && !bas.hidden && bas.parentNode !== d) d.insertBefore(bas, d.firstChild);
    var moi = document.querySelector("#v-admin .co-nav .co-moi"); if (moi) d.appendChild(moi);
    maj();
  }
  brancher();
  new MutationObserver(brancher).observe(document.body, { attributes: true, attributeFilter: ["class"] });
})();
