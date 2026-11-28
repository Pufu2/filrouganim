// Téléphone, l'onglet « Connexion » (/compte/ sans être connecté) : une page « Profil » sur le modèle de bonchoeur.fr
// (titre, « Connexion ou inscription » qui ouvre une feuille montant du bas, les lignes Paramètres, Aide, Confidentialité,
// Juridique, et leurs écrans), sans barre de recherche. Le formulaire de connexion reste celui de compte.js : il est
// seulement déplacé dans la feuille, en deux temps (l'e-mail, puis le mot de passe). Icônes : Lucide (licence ISC).
(function () {
  "use strict";
  if (!window.matchMedia("(max-width: 700px)").matches) return;
  var auth = document.getElementById("auth"), vcx = document.getElementById("v-connexion"), form = document.getElementById("f-connexion");
  if (!auth || !vcx || !form) return;
  var R = document.documentElement;
  R.classList.add("tel-cnx-page");
  var IC = {"settings": "<path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\"></path><circle cx=\"12\" cy=\"12\" r=\"3\"></circle>", "chevron-right": "<path d=\"m9 18 6-6-6-6\"></path>", "circle-question-mark": "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\"></path><path d=\"M12 17h.01\"></path>", "hand": "<path d=\"M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2\"></path><path d=\"M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2\"></path><path d=\"M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8\"></path><path d=\"M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15\"></path>", "notebook-text": "<path d=\"M2 6h4\"></path><path d=\"M2 10h4\"></path><path d=\"M2 14h4\"></path><path d=\"M2 18h4\"></path><rect width=\"16\" height=\"20\" x=\"4\" y=\"2\" rx=\"2\"></rect><path d=\"M9.5 8h5\"></path><path d=\"M9.5 12H16\"></path><path d=\"M9.5 16H14\"></path>", "download": "<path d=\"M12 15V3\"></path><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path><path d=\"m7 10 5 5 5-5\"></path>", "arrow-left": "<path d=\"m12 19-7-7 7-7\"></path><path d=\"M19 12H5\"></path>", "map-pin": "<path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\"></path><circle cx=\"12\" cy=\"10\" r=\"3\"></circle>", "users": "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"></path><path d=\"M16 3.128a4 4 0 0 1 0 7.744\"></path><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"></path><circle cx=\"9\" cy=\"7\" r=\"4\"></circle>", "church": "<path d=\"M10 9h4\"></path><path d=\"M12 7v5\"></path><path d=\"M14 21v-3a2 2 0 0 0-4 0v3\"></path><path d=\"m18 9 3.52 2.147a1 1 0 0 1 .48.854V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6.999a1 1 0 0 1 .48-.854L6 9\"></path><path d=\"M6 21V7a1 1 0 0 1 .376-.782l5-3.999a1 1 0 0 1 1.249.001l5 4A1 1 0 0 1 18 7v14\"></path>", "search": "<path d=\"m21 21-4.34-4.34\"></path><circle cx=\"11\" cy=\"11\" r=\"8\"></circle>", "book-open": "<path d=\"M12 5v16\"></path><path d=\"M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z\"></path>"};
  IC.x = '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>';
  IC.building = '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>';
  IC.check = '<path d="M20 6 9 17l-5-5"/>';
  function svg(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || "") + "</svg>"; }
  function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  function ligne(ic, texte, href, action) {
    var a = el(href ? "a" : "button", "tc-ligne", svg(ic) + "<span>" + texte + "</span>" + svg("chevron-right"));
    if (href) a.href = href; else { a.type = "button"; a.addEventListener("click", action); }
    return a;
  }
  function liste(items) { var u = el("ul", "tc-liste"); items.forEach(function (x) { var li = el("li"); li.appendChild(x); u.appendChild(li); }); return u; }
  function retourRond(fond) { var b = el("button", "tc-retour-rond" + (fond ? " tc-fond" : ""), svg("arrow-left")); b.type = "button"; b.setAttribute("aria-label", "Retour"); b.addEventListener("click", retour); return b; }
  function barreTitre(titre) { var d = el("div", "tc-barre"), b = el("button", "tc-retour", svg("arrow-left")); b.type = "button"; b.setAttribute("aria-label", "Retour"); b.addEventListener("click", retour); d.appendChild(b); d.appendChild(el("h1", null, titre)); return d; }
  function retour() { if (history.state && history.state.tc) history.back(); else aller(""); }

  var racine = el("div", "tc"); racine.id = "tc";
  var ecrans = {};

  /* ---------- Profil ---------- */
  var p = el("section", "tc-ecran tc-profil");
  p.appendChild(el("h1", "tc-titre", "Profil"));
  p.appendChild(el("p", "tc-intro", "Connectez-vous pour retrouver vos candidatures, vos offres, vos demandes et vos séjours."));
  var bloc = el("div", "tc-cta"), bp = el("button", "tc-bouton", "Connexion ou inscription"); bp.type = "button"; bp.addEventListener("click", ouvrir);
  bloc.appendChild(bp);
  var ls = el("a", "tc-lien-s", "Vous êtes une structure ?"); ls.href = "/recruter/"; bloc.appendChild(ls);
  p.appendChild(bloc);
  var l1 = liste([ligne("settings", "Paramètres", null, function () { aller("parametres"); }), ligne("circle-question-mark", "Obtenir de l'aide", null, function () { aller("aide"); }), ligne("hand", "Confidentialité", null, function () { aller("confidentialite"); })]);
  l1.classList.add("tc-liste-1"); p.appendChild(l1);
  p.appendChild(liste([ligne("notebook-text", "Juridique", null, function () { aller("juridique"); })]));
  var pied = el("div", "tc-pied"), bi = el("button", "tc-bouton-c", svg("download") + " Ajouter à l'écran d'accueil"); bi.type = "button"; bi.addEventListener("click", ouvrirInstaller);
  pied.appendChild(bi); p.appendChild(pied);
  ecrans[""] = p;

  /* ---------- Paramètres ---------- */
  var pa = el("section", "tc-ecran tc-page");
  pa.appendChild(barreTitre("Paramètres"));
  var pac = el("div", "tc-page-corps");
  var sd = el("section", "tc-section"); sd.appendChild(el("h2", null, "Mes données sur cet appareil")); var sdc = el("div", "tc-donnees"); sd.appendChild(sdc); pac.appendChild(sd);
  var sp = el("section", "tc-section"); sp.appendChild(el("h2", "tc-h2-ic", svg("map-pin") + " Position"));
  sp.appendChild(el("p", "tc-doux", "Votre position n'est jamais demandée ni enregistrée : vous choisissez vous-même une ville ou un département pour chercher une session, un poste ou une place."));
  var sl = el("a", "tc-lien-b", "En savoir plus sur la confidentialité"); sl.href = "/confidentialite/"; sp.appendChild(sl); pac.appendChild(sp);
  pa.appendChild(pac); ecrans.parametres = pa;
  var CLES = [["fra-favoris", function (v) { var n = 0; try { n = JSON.parse(v).length; } catch (e) {} return n ? n + " offre" + (n > 1 ? "s" : "") + " gardée" + (n > 1 ? "s" : "") + " pour comparer" : ""; }],
              ["fra-parcours", function () { return "Vos dates de « Mon parcours BAFA »"; }],
              ["fra-depart", function () { return "Le département de vos recherches"; }],
              ["fra-carnet-code", function () { return "Le code d'un carnet de séjour"; }]];
  function majDonnees() {
    sdc.textContent = "";
    var l = [];
    try { CLES.forEach(function (c) { var v = localStorage.getItem(c[0]); if (v) { var t = c[1](v); if (t) l.push(t); } }); } catch (e) {}
    if (!l.length) { sdc.appendChild(el("p", "tc-doux", "Rien n'est gardé sur cet appareil.")); return; }
    var u = el("ul", "tc-puces"); l.forEach(function (t) { u.appendChild(el("li", null, t)); }); sdc.appendChild(u);
    var b = el("button", "tc-bouton-c tc-petit", "Effacer ces données"); b.type = "button";
    b.addEventListener("click", function () { if (!confirm("Effacer ces données de cet appareil ?")) return; try { CLES.forEach(function (c) { localStorage.removeItem(c[0]); }); localStorage.removeItem("fra-carnet-auteur"); } catch (e) {} majDonnees(); });
    sdc.appendChild(b);
  }

  /* ---------- Aide ---------- */
  var ai = el("section", "tc-ecran tc-aide");
  var aih = el("div", "tc-aide-haut"); aih.appendChild(retourRond(false));
  aih.appendChild(el("h1", "tc-titre-2", "Bonjour, comment pouvons-nous vous aider\u00a0?"));
  var ab = el("button", "tc-bouton", "Me connecter ou m'inscrire"); ab.type = "button"; ab.addEventListener("click", ouvrir); var abw = el("div", "tc-cta"); abw.appendChild(ab); aih.appendChild(abw);
  aih.appendChild(el("h2", "tc-h2", "Guides pour démarrer"));
  var la = liste([ligne("search", "Trouver une session BAFA, BAFD…", "/se-former/sessions/"), ligne("users", "Trouver un poste ou un stage pratique", "/trouver-un-poste/offres/"),
                  ligne("building", "Vous êtes une structure : créer votre page", "/recruter/"), ligne("map-pin", "Trouver une colo ou un accueil pour mon enfant", "/enfants/")]);
  la.classList.add("tc-liste-sep"); aih.appendChild(la); ai.appendChild(aih);
  var plus = el("section", "tc-plus"); plus.appendChild(el("h2", "tc-h2", "En savoir plus"));
  [["book-open", "Comment ça marche", "Le site expliqué, pour chacun des quatre usages.", "/comment-ca-marche/"], ["search", "Comment les sessions sont classées", "D'où viennent les sessions, et dans quel ordre elles s'affichent.", "/classement-des-sessions/"], ["users", "Qui fait Fil Roug'Anim", "Pourquoi ce site existe, et comment il est fait.", "/a-propos/"]].forEach(function (x) {
    var a = el("a", "tc-carte", '<span class="tc-carte-ic">' + svg(x[0]) + '</span><span><b>' + x[1] + "</b><span>" + x[2] + "</span></span>"); a.href = x[3]; plus.appendChild(a);
  });
  var joindre = el("div", "tc-joindre", '<p class="tc-joindre-t">Besoin de nous joindre ?</p><p>Une question, une erreur sur une session ou une fiche : écrivez-nous, une personne vous répond.</p>');
  var cj = el("a", null, "Contactez-nous"); cj.href = "/contact/"; joindre.appendChild(cj); plus.appendChild(joindre);
  ai.appendChild(plus); ecrans.aide = ai;

  /* ---------- Confidentialité ---------- */
  var co = el("section", "tc-ecran tc-page");
  co.appendChild(barreTitre("Votre vie privée"));
  var coc = el("div", "tc-page-corps tc-texte");
  coc.appendChild(el("p", null, "Quand vous utilisez Fil Roug'Anim, quelques informations peuvent être enregistrées sur votre appareil, uniquement pour que le site fonctionne : rester connecté, se souvenir de vos choix (offres gardées, parcours BAFA). Fil Roug'Anim ne dépose aucun cookie, n'utilise aucun traceur publicitaire et ne vend aucune donnée."));
  coc.appendChild(el("p", null, 'Pour tout savoir sur les informations utilisées et vos droits, consultez la <a href="/confidentialite/">politique de confidentialité</a>.'));
  coc.appendChild(el("div", "tc-interrupteur", '<p>Strictement nécessaires</p><span aria-label="Toujours actifs"><span>' + svg("check") + "</span></span>"));
  coc.appendChild(el("p", "tc-doux tc-sous-inter", "Indispensables au fonctionnement du site (connexion, sécurité, vos choix) : ils ne peuvent pas être désactivés. Ce sont les seuls que Fil Roug'Anim utilise."));
  co.appendChild(coc);
  var cof = el("div", "tc-page-pied"), cob = el("button", "tc-bouton", "Compris"); cob.type = "button"; cob.addEventListener("click", retour); cof.appendChild(cob); co.appendChild(cof);
  ecrans.confidentialite = co;

  /* ---------- Juridique ---------- */
  var ju = el("section", "tc-ecran tc-juridique");
  ju.appendChild(retourRond(true)); ju.appendChild(el("h1", "tc-titre tc-titre-j", "Juridique"));
  ju.appendChild(liste([ligne("notebook-text", "Conditions d'utilisation", "/conditions-utilisation/"), ligne("notebook-text", "Conditions de vente", "/conditions-de-vente/"),
                        ligne("notebook-text", "Politique de confidentialité", "/confidentialite/"), ligne("notebook-text", "Mentions légales", "/mentions-legales/")]));
  ecrans.juridique = ju;

  Object.keys(ecrans).forEach(function (k) { racine.appendChild(ecrans[k]); });

  /* ---------- les écrans : #parametres, #aide… (le bouton retour du téléphone revient au Profil) ---------- */
  function montrer(nom) {
    if (!ecrans[nom]) nom = "";
    Object.keys(ecrans).forEach(function (k) { ecrans[k].hidden = k !== nom; });
    R.classList.toggle("tc-sous", nom !== "");
    if (nom === "parametres") majDonnees();
    window.scrollTo(0, 0);
  }
  function aller(nom) {
    if (nom) history.pushState({ tc: nom }, "", "#" + nom); else history.replaceState(null, "", location.pathname + location.search);
    montrer(nom);
  }
  window.addEventListener("popstate", function () { montrer((location.hash || "").slice(1)); });

  /* ---------- la feuille « Connexion ou inscription » ---------- */
  var voile = el("div", "tc-voile"); voile.setAttribute("role", "dialog"); voile.setAttribute("aria-modal", "true"); voile.setAttribute("aria-label", "Connexion ou inscription"); voile.hidden = true;
  var feuille = el("div", "tc-feuille");
  var fh = el("div", "tc-feuille-haut"), fx = el("button", "tc-fermer", svg("x")); fx.type = "button"; fx.setAttribute("aria-label", "Fermer"); fx.addEventListener("click", fermer);
  fh.appendChild(el("span")); fh.appendChild(fx); feuille.appendChild(fh);
  var fc = el("div", "tc-feuille-corps");
  var tete = el("div", "tc-feuille-tete"); var im = el("img"); im.src = "/marque-sombre.png"; im.alt = ""; im.width = 86; im.height = 72; tete.appendChild(im);
  var fh2 = el("h2", null, "Connexion ou inscription"); tete.appendChild(fh2); fc.appendChild(tete);
  // le formulaire de compte.js, en deux temps
  var champEmail = form.querySelector('input[type="email"]'), champMdp = form.querySelector('input[type="password"]');
  var blocMdp = champMdp && champMdp.closest(".champ"), envoyer = form.querySelector('button[type="submit"]');
  form.classList.add("tc-form");
  var lab = champEmail.closest("label"); if (lab) { var sp1 = lab.querySelector("span"); if (sp1) sp1.className = "tc-cache"; }
  champEmail.placeholder = "Adresse e-mail";
  var continuer = el("button", "tc-bouton tc-continuer", "Continuer"); continuer.type = "button"; continuer.disabled = true;
  form.insertBefore(continuer, blocMdp);
  function emailOk() { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((champEmail.value || "").trim()); }
  champEmail.addEventListener("input", function () { continuer.disabled = !emailOk(); });
  function etape(n) {
    feuille.dataset.etape = n;
    fh2.textContent = n === 2 ? "Connexion" : "Connexion ou inscription";
    if (n === 2 && champMdp) setTimeout(function () { champMdp.focus(); }, 50);
  }
  continuer.addEventListener("click", function () { if (emailOk()) etape(2); });
  form.addEventListener("keydown", function (e) { if (e.key === "Enter" && feuille.dataset.etape !== "2" && e.target === champEmail) { e.preventDefault(); if (emailOk()) etape(2); } });
  if (envoyer) envoyer.innerHTML = "Se connecter";
  fc.appendChild(form);
  var ou = el("div", "tc-ou", "<span></span>ou<span></span>"); fc.appendChild(ou);
  var g0 = vcx.querySelector("[data-google]");
  var gs = el("div", "tc-sociaux"), gb = el("button", "tc-social"); gb.type = "button"; gb.setAttribute("aria-label", "Continuer avec Google");
  var gsvg = g0 && g0.querySelector("svg"); if (gsvg) gb.appendChild(gsvg.cloneNode(true));
  gb.addEventListener("click", function () { if (g0) g0.click(); }); gs.appendChild(gb); fc.appendChild(gs);
  var nouveau = el("div", "tc-nouveau"); nouveau.appendChild(el("div", "tc-ou", "<span></span>Nouveau sur Fil Roug'Anim ?<span></span>"));
  var cc = el("a", "tc-bouton-c", "Créer un compte"); cc.href = "/compte/?inscription=1"; nouveau.appendChild(cc); fc.appendChild(nouveau);
  feuille.appendChild(fc); voile.appendChild(feuille); document.body.appendChild(voile);
  voile.addEventListener("click", function (e) { if (e.target === voile) fermer(); });

  /* ---------- la feuille « Ajouter à l'écran d'accueil » ---------- */
  var invite = null; window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); invite = e; });
  var voile2 = el("div", "tc-voile"); voile2.setAttribute("role", "dialog"); voile2.setAttribute("aria-modal", "true"); voile2.setAttribute("aria-label", "Ajouter à l'écran d'accueil"); voile2.hidden = true;
  var f2 = el("div", "tc-feuille tc-feuille-courte"), f2h = el("div", "tc-feuille-haut"), f2x = el("button", "tc-fermer", svg("x")); f2x.type = "button"; f2x.setAttribute("aria-label", "Fermer");
  f2x.addEventListener("click", function () { fermerVoile(voile2); }); f2h.appendChild(el("span")); f2h.appendChild(f2x); f2.appendChild(f2h);
  var f2c = el("div", "tc-feuille-corps tc-installer");
  var im2 = el("img"); im2.src = "/marque-sombre.png"; im2.alt = ""; im2.width = 72; im2.height = 60; f2c.appendChild(im2);
  f2c.appendChild(el("h2", null, "Fil Roug'Anim sur votre écran d'accueil"));
  f2c.appendChild(el("p", "tc-doux", "Une icône comme une application, pour ouvrir le site en un geste."));
  var etapesI = el("ol", "tc-etapes");
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  (ios ? ["Touchez le bouton Partager de Safari (le carré avec une flèche)", "Choisissez « Sur l'écran d'accueil »", "Touchez « Ajouter »"]
       : ["Ouvrez le menu du navigateur (les trois points)", "Choisissez « Ajouter à l'écran d'accueil »", "Confirmez avec « Ajouter »"]).forEach(function (t) { etapesI.appendChild(el("li", null, t)); });
  f2c.appendChild(etapesI);
  var inst = el("button", "tc-bouton", "Ajouter maintenant"); inst.type = "button"; inst.hidden = true;
  inst.addEventListener("click", function () { if (invite) { invite.prompt(); invite = null; fermerVoile(voile2); } });
  f2c.appendChild(inst);
  f2.appendChild(f2c); voile2.appendChild(f2); document.body.appendChild(voile2);
  voile2.addEventListener("click", function (e) { if (e.target === voile2) fermerVoile(voile2); });
  function ouvrirInstaller() { inst.hidden = !invite; ouvrirVoile(voile2); }

  // les effets : le voile apparaît en 200 ms, la feuille monte en 300 ms (et l'inverse en fermant)
  function ouvrirVoile(v) { v.hidden = false; R.classList.add("tc-bloque"); void v.offsetWidth; v.classList.add("tc-ouvert"); }
  function fermerVoile(v) {
    v.classList.remove("tc-ouvert");
    setTimeout(function () { v.hidden = true; if (!document.querySelector(".tc-voile.tc-ouvert")) R.classList.remove("tc-bloque"); }, 300);
  }
  function ouvrir() { etape(1); continuer.disabled = !emailOk(); ouvrirVoile(voile); }
  function fermer() { fermerVoile(voile); }

  auth.insertBefore(racine, auth.firstChild);

  // la page « Profil » n'existe que tant que la connexion est l'écran affiché (pas l'inscription, ni « mot de passe oublié »)
  function regarder() {
    var actif = !auth.hidden && !vcx.hidden;
    R.classList.toggle("tel-cnx", actif);
    if (!actif && !voile.hidden) { voile.hidden = true; voile.classList.remove("tc-ouvert"); R.classList.remove("tc-bloque"); }
  }
  new MutationObserver(regarder).observe(document.getElementById("espace-compte") || document.body, { attributes: true, subtree: true, attributeFilter: ["hidden"] });
  regarder();
  montrer((location.hash || "").slice(1));
})();
