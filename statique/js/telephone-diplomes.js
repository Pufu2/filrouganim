// Téléphone, « Se former » : le bloc « Tous les diplômes » (icônes 3D en couleur) à la fin des pages de sessions, à la place des
// listes « chercher autrement » ; et les pages de chaque diplôme (/se-former/bafa/…) mises en forme d'information, sans barre
// de recherche : une grande icône, l'essentiel en trois tuiles, « En bref » en lignes, les étapes en frise, le bouton des sessions.
(function () {
  "use strict";
  if (!window.matchMedia("(max-width: 700px)").matches) return;
  var racine = document.documentElement, brut = document.getElementById("tel-diplomes");
  if (!brut) return;
  var D = []; try { D = JSON.parse(brut.textContent) || []; } catch (e) {}
  if (!D.length) return;
  var barre = document.querySelector(".tel-barre"), dossier = (barre && barre.dataset.icones) || "/illus/icones/";
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function icone(nom, n) { var i = el("img"); i.src = dossier + nom + ".png"; i.alt = ""; i.width = n; i.height = n; return i; }
  var ici = D.filter(function (d) { return d.ici; })[0];

  // le bloc « Tous les diplômes » : une grille de tuiles (icône, nom, une ligne)
  function blocDiplomes(titre, sauf) {
    var s = el("section", "tel-dips");
    s.appendChild(el("p", "tel-dips-sur", "Se former"));
    s.appendChild(el("h2", "tel-dips-t", titre));
    var g = el("div", "tel-dips-g");
    D.forEach(function (d) {
      if (sauf && d.ici) return;
      var a = el("a", "tel-dip"); a.href = d.url;
      a.appendChild(el("span", "tel-dip-ic")).appendChild(icone(d.ic, 40));
      a.appendChild(el("b", null, d.ic === "bsb" ? "BSB" : d.court));
      if (d.age) a.appendChild(el("small", null, d.age));
      g.appendChild(a);
    });
    s.appendChild(g);
    return s;
  }

  if (ici) {
    /* ---------- la page d'un diplôme ---------- */
    racine.classList.add("tel-diplome");
    var haut = document.querySelector("main .fs-haut-in");
    if (haut) {
      var ic = el("span", "tel-dip-grand"); ic.appendChild(icone(ici.ic, 72)); haut.insertBefore(ic, haut.firstChild);
      var acc = haut.querySelector(".fs-accroche"); if (acc && ici.resume) acc.textContent = ici.resume;
    }
    // l'essentiel en trois tuiles avec une icône
    var ruban = document.querySelector("main .fs-ruban");
    if (ruban) {
      var IC = { "Accès": "calendrier", "Durée": "duree", "Niveau": "diplome" };
      Array.prototype.forEach.call(ruban.querySelectorAll("li:not(.le-ruban-action)"), function (li) {
        var k = (li.querySelector("small") || {}).textContent; if (IC[k]) li.insertBefore(icone(IC[k], 28), li.firstChild);
      });
    }
    // « En bref » : chaque ligne avec une icône
    var ICB = { "âge": "calendrier", "etapes": "approfondissement", "étapes": "approfondissement", "délai": "duree", "delai": "duree", "prix": "budget", "aides": "coin",
      "durée": "duree", "accès": "calendrier", "niveau": "diplome", "debouches": "directeur", "débouchés": "directeur", "conditions": "contrat", "financement": "budget", "validité": "duree" };
    Array.prototype.forEach.call(document.querySelectorAll("main .le-cles tr"), function (tr) {
      var td = tr.querySelector("td"); if (!td) return;
      var k = td.textContent.trim().toLowerCase(), nom = ICB[k] || (/prix|co[uû]t/.test(k) ? "budget" : /aide|financ/.test(k) ? "budget" : /dur|d[ée]lai/.test(k) ? "duree" : "generale");
      if (nom === "coin") nom = "budget";
      var b = el("b", "tel-cle", td.textContent.trim()); td.textContent = ""; td.appendChild(icone(nom, 22)); td.appendChild(b);
    });
    // le bas : « Tous les diplômes » à la place des cartes « Les autres formations »
    var suite = document.querySelector("main .le-suite");
    var bloc = blocDiplomes("Les autres diplômes", true);
    if (suite) suite.parentNode.insertBefore(bloc, suite); else (document.querySelector("main .fs") || document.getElementById("contenu")).appendChild(bloc);
  } else if (racine.classList.contains("tel-ab") && !racine.classList.contains("tel-sans-carte")) {
    /* ---------- les pages de sessions : « Tous les diplômes » à la fin ---------- */
    var main = document.getElementById("contenu");
    var der = Array.prototype.filter.call(main.children, function (x) { return x.matches("section, div") && !x.matches(".tel-ab-tete"); }).pop();
    main.appendChild(blocDiplomes("Tous les diplômes", false));
  }
})();
