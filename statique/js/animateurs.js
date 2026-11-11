/* Fil Roug'Anim : la liste publique des animateurs inscrits (cartes [data-animateurs]).
   Chaque carte vient de la fonction profils_resume de la base : un résumé seulement (prénom, poste, département,
   diplômes, dates), jamais la ville, l'âge, la présentation, le CV ni le contact. Au clic, le résumé s'ouvre avec
   la partie verrouillée : la fiche complète est réservée aux structures vérifiées et abonnées (espace structure,
   /compte/?role=structure&profil=…). Ce qui vient des personnes est écrit avec textContent, jamais comme du HTML. */
(function () {
  "use strict";
  var listes = document.querySelectorAll("[data-animateurs]");
  var lib = document.getElementById("an-libelles");
  if (!listes.length || !lib || !window.supabase) return;
  var L = JSON.parse(lib.textContent);
  var sb = window.supabase.createClient(L.url, L.cle, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

  function el(tag, classe, texte) { var e = document.createElement(tag); if (classe) e.className = classe; if (texte != null) e.textContent = texte; return e; }
  function nom(dico, v) { return dico[v] || v; }
  function dateFr(iso, annee) {
    if (!iso) return "";
    var o = { day: "numeric", month: "long" }; if (annee) o.year = "numeric";
    return new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("fr-FR", o);
  }
  function dispo(p) {
    if (!p.dispo_debut) return "";
    return p.dispo_fin ? "Disponible du " + dateFr(p.dispo_debut) + " au " + dateFr(p.dispo_fin, true) : "Disponible à partir du " + dateFr(p.dispo_debut, true);
  }
  function svg(d) { var s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); s.innerHTML = d; return s; }
  var CADENAS = '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>';

  /* -- le résumé, en fenêtre -- */
  var voile = null, dernier = null;
  function fermer() { if (!voile) return; voile.hidden = true; document.documentElement.classList.remove("ff-ouverte"); if (dernier) dernier.focus(); }
  function ouvrir(p, depuis) {
    dernier = depuis || null;
    if (!voile) {
      voile = el("div", "an-voile"); voile.hidden = true;
      voile.addEventListener("click", function (e) { if (e.target === voile) fermer(); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && voile && !voile.hidden) fermer(); });
      document.body.appendChild(voile);
    }
    voile.textContent = "";
    var f = el("div", "an-fiche"); f.setAttribute("role", "dialog"); f.setAttribute("aria-modal", "true"); f.setAttribute("aria-labelledby", "an-nom");
    var x = el("button", "an-fermer"); x.type = "button"; x.setAttribute("aria-label", "Fermer");
    x.appendChild(svg('<path d="M6 6l12 12M18 6 6 18"/>')); x.addEventListener("click", fermer);
    f.appendChild(x);

    var tete = el("div", "an-tete");
    tete.appendChild(el("span", "tp-avatar an-avatar", (p.prenom || "?").charAt(0).toUpperCase()));
    var t = el("div");
    var h = el("h2", null, p.prenom); h.id = "an-nom"; t.appendChild(h);
    t.appendChild(el("p", "an-sous", [p.poste_recherche, nom(L.deps, p.departement) + " (" + p.departement + ")"].filter(Boolean).join(" · ")));
    tete.appendChild(t);
    f.appendChild(tete);

    var puces = el("ul", "an-puces");
    (p.diplomes || []).forEach(function (d) { puces.appendChild(el("li", null, nom(L.diplomes, d))); });
    if (p.qualifs) puces.appendChild(el("li", null, p.qualifs + " qualification" + (p.qualifs > 1 ? "s" : "")));
    if (p.cv) puces.appendChild(el("li", null, "CV joint"));
    if (puces.children.length) f.appendChild(puces);
    var lignes = el("dl", "an-lignes");
    function ligne(a, b) { if (!b) return; lignes.appendChild(el("dt", null, a)); lignes.appendChild(el("dd", null, b)); }
    ligne("Cherche", (p.recherche || []).map(function (r) { return nom(L.recherche, r); }).join(", "));
    ligne("Quand", dispo(p).replace(/^Disponible /, ""));
    ligne("Profil mis à jour", dateFr(p.maj_le, true));
    if (lignes.children.length) f.appendChild(lignes);

    var verrou = el("div", "an-verrou");
    var flou = el("div", "an-flou"); flou.setAttribute("aria-hidden", "true");
    ["Âge et ville", "Sa présentation", "Ses expériences et activités", "Ses qualifications et leurs dates", "Son CV", "Son e-mail"].forEach(function (s) {
      var l = el("p"); l.appendChild(el("b", null, s)); l.appendChild(el("span")); flou.appendChild(l);
    });
    verrou.appendChild(flou);
    var bulle = el("div", "an-bulle");
    bulle.appendChild(svg(CADENAS));
    bulle.appendChild(el("p", "an-bulle-t", "La fiche complète est réservée aux structures abonnées"));
    bulle.appendChild(el("p", "an-bulle-p", "Âge, ville, présentation, qualifications, CV et e-mail pour lui écrire : tout s'ouvre avec l'abonnement de votre structure, dès " + L.prix + " par an."));
    var b = el("div", "an-boutons");
    var a1 = el("a", "bouton-r", "Créer l'espace de ma structure"); a1.href = L.creer; b.appendChild(a1);
    var a2 = el("a", "bouton-blanc", "J'ai déjà un espace : voir la fiche"); a2.href = L.compte + "?role=structure&profil=" + encodeURIComponent(p.id); b.appendChild(a2);
    bulle.appendChild(b);
    verrou.appendChild(bulle);
    f.appendChild(verrou);

    voile.appendChild(f);
    voile.hidden = false;
    document.documentElement.classList.add("ff-ouverte");
    voile.scrollTop = 0;
    x.focus();
  }

  /* -- les cartes -- */
  function carte(p) {
    var li = el("li", "tp-carte an-carte");
    var haut = el("button", "tp-carte-haut an-haut"); haut.type = "button"; haut.tabIndex = -1; haut.setAttribute("aria-hidden", "true");
    haut.appendChild(el("span", "tp-avatar", (p.prenom || "?").charAt(0).toUpperCase()));
    haut.appendChild(el("span", "an-badge", "Inscrit sur le site"));
    li.appendChild(haut);
    var corps = el("div", "tp-carte-corps");
    var h = el("h2"); var bn = el("button", "an-lien", p.prenom); bn.type = "button"; h.appendChild(bn); corps.appendChild(h);
    corps.appendChild(el("p", "tp-carte-lieu", [nom(L.deps, p.departement) + " (" + p.departement + ")", p.poste_recherche].filter(Boolean).join(" · ")));
    var det = (p.diplomes || []).map(function (d) { return nom(L.diplomes, d); });
    if (dispo(p)) det.push(dispo(p).replace(/^D/, "d"));
    if (det.length) corps.appendChild(el("p", "tp-carte-detail", det.join(" · ")));
    li.appendChild(corps);
    var pied = el("div", "tp-carte-pied");
    var note = el("span", "tp-carte-note an-note"); note.appendChild(svg(CADENAS)); note.appendChild(document.createTextNode("Fiche complète : structures abonnées"));
    pied.appendChild(note);
    var voir = el("button", "an-voir", "Voir le profil "); voir.type = "button"; voir.appendChild(el("span", null, "→")).setAttribute("aria-hidden", "true");
    pied.appendChild(voir);
    li.appendChild(pied);
    [haut, bn, voir].forEach(function (x) { x.addEventListener("click", function () { ouvrir(p, bn); }); });
    return li;
  }

  function charger(ul, dep) {
    var n = parseInt(ul.dataset.animateurs, 10) || 6;
    return sb.rpc("profils_resume", { dep: dep || null, n: n }).then(function (r) {
      Array.prototype.forEach.call(ul.querySelectorAll(".an-carte"), function (c) { c.remove(); });
      var data = (r && r.data) || [];
      var avant = ul.querySelector(".tp-carte-exemple");
      data.forEach(function (p) { ul.insertBefore(carte(p), avant); });
      var compte = document.querySelector('[data-animateurs-compte="' + (ul.id || "") + '"]');
      if (compte) compte.textContent = data.length ? data.length + " animateur" + (data.length > 1 ? "s" : "") + (dep ? " dans ce département ou prêt" + (data.length > 1 ? "s" : "") + " à y travailler" : " inscrit" + (data.length > 1 ? "s" : "")) : (dep ? "Pas encore d'animateur dans ce département." : "");
      ul.classList.toggle("an-vide", !data.length);
    });
  }

  Array.prototype.forEach.call(listes, function (ul) {
    var filtre = ul.id && document.querySelector('[data-animateurs-filtre="' + ul.id + '"]');
    var dep = filtre ? (new URLSearchParams(location.search).get("dep") || "") : "";
    if (filtre) {
      filtre.value = dep;
      filtre.addEventListener("change", function () {
        var u = new URL(location.href); if (filtre.value) u.searchParams.set("dep", filtre.value); else u.searchParams.delete("dep");
        history.replaceState(null, "", u);
        charger(ul, filtre.value);
      });
    }
    charger(ul, dep);
  });
})();
