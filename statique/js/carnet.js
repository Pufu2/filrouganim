/* Fil Roug'Anim : le carnet de séjour (/enfants/carnet/), sans compte.
   - ?j=… : l'équipe écrit la nouvelle du jour (carnet_equipe, ecrire_carnet) ;
   - sinon : les familles ouvrent le carnet avec le code donné par la structure (carnet_famille), s'inscrivent pour
     le recevoir par e-mail (suivre_carnet) ; ?code=… le pré-remplit, ?arret=… arrête les e-mails (arreter_carnet). */
(function () {
  "use strict";
  var r = document.getElementById("cj"); if (!r) return;
  var m = location.search.match(/[?&]j=([0-9a-zA-Z_-]{16,80})/), etat = document.getElementById("cj-etat"), f = document.getElementById("cj-form");
  var jeton = m && m[1], sid = null;
  function rpc(n, c) { return fetch(r.dataset.url + "/rest/v1/rpc/" + n, { method: "POST", headers: { "Content-Type": "application/json", apikey: r.dataset.cle }, body: JSON.stringify(c) })
    .then(function (x) { return x.json().then(function (j) { if (!x.ok) throw new Error((j && j.message) || "erreur"); return j; }); }); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function dateFr(d) { return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }); }
  function fil(l) {
    var ol = document.getElementById("cj-liste"); ol.textContent = "";
    document.getElementById("cj-fil").hidden = !l.length;
    l.forEach(function (x) { var li = el("li"); li.appendChild(el("p", "pa-c-sur", dateFr(x.jour)));
      if (x.titre) li.appendChild(el("h3", null, x.titre)); li.appendChild(el("p", "pa-c-texte", x.texte)); ol.appendChild(li); });
  }
  function charger() {
    return rpc("carnet_equipe", { j: jeton }).then(function (d) {
      if (!d) { etat.textContent = "Ce lien n'est plus valable : demandez le nouveau lien à la structure."; return; }
      sid = d.id; etat.hidden = true; f.hidden = false;
      document.getElementById("cj-sejour").textContent = d.titre + " · " + d.structure;
      var ds = d.dates || [], sel = f.elements.date_id, auj = new Date().toISOString().slice(0, 10);
      sel.textContent = ""; var o0 = el("option", null, "Toutes les sessions"); o0.value = ""; sel.appendChild(o0);
      ds.forEach(function (x) { var o = el("option", null, "du " + dateFr(x.debut) + " au " + dateFr(x.fin)); o.value = x.id; if (x.debut <= auj && x.fin >= auj) o.selected = true; sel.appendChild(o); });
      document.getElementById("cj-l-date").hidden = ds.length < 2;
      fil(d.dernieres || []);
    });
  }
  if (!jeton) { familles(); return; }
  // l'équipe : le haut de page change de ton
  document.getElementById("cj-sur").textContent = "Carnet de séjour · pour l'équipe";
  document.getElementById("cj-h1").textContent = "La nouvelle du jour";
  document.getElementById("cj-chapo").textContent = "Quelques lignes sur la journée : les familles les reçoivent par e-mail et dans leur espace parent.";
  etat.hidden = false;
  try { var a = localStorage.getItem("fra-carnet-auteur"); if (a) f.elements.auteur.value = a; } catch (e) {}
  charger().catch(function () { etat.textContent = "Le carnet n'a pas pu s'ouvrir. Vérifiez votre connexion et rechargez la page."; });
  f.addEventListener("submit", function (e) {
    e.preventDefault(); if (!f.checkValidity()) { f.reportValidity(); return; }
    var b = f.querySelector("button[type=submit]"), ret = document.getElementById("cj-retour"); b.disabled = true;
    try { localStorage.setItem("fra-carnet-auteur", f.elements.auteur.value.trim()); } catch (e2) {}
    rpc("ecrire_carnet", { sid: sid, j: jeton, did: f.elements.date_id.value ? parseInt(f.elements.date_id.value, 10) : null, titre: f.elements.titre.value, texte: f.elements.texte.value, auteur: f.elements.auteur.value })
      .then(function () { f.elements.titre.value = ""; f.elements.texte.value = ""; ret.hidden = false; ret.className = "cj-retour sjf-ok"; ret.textContent = "C'est envoyé : les familles reçoivent la nouvelle. Merci !"; return charger(); })
      .catch(function (err) { ret.hidden = false; ret.className = "cj-retour sjf-ko"; ret.textContent = /fetch|network/i.test(String(err.message)) ? "L'envoi n'a pas marché. Vérifiez votre connexion." : err.message; })
      .then(function () { b.disabled = false; });
  });
  /* ---------- les familles ---------- */
  function familles() {
    var cf = document.getElementById("cf"), fc = document.getElementById("cf-code"), err = document.getElementById("cf-erreur"), code = "";
    cf.hidden = false;
    var arret = location.search.match(/[?&]arret=([0-9a-f]{16,64})/);
    if (arret) {
      rpc("arreter_carnet", { j: arret[1] }).then(function () { err.hidden = false; err.className = "cj-retour sjf-ok"; err.textContent = "C'est fait : vous ne recevrez plus les nouvelles de ce séjour par e-mail."; })
        .catch(function () { err.hidden = false; err.textContent = "L'arrêt n'a pas marché. Réessayez dans un instant."; });
    }
    function ouvrir(c) {
      err.hidden = true;
      return rpc("carnet_famille", { code: c }).then(function (d) {
        code = c; try { localStorage.setItem("fra-carnet-code", c); } catch (e) {}
        fc.elements.code.value = c;
        document.getElementById("cf-dates").textContent = "Du " + dateFr(d.debut) + " au " + dateFr(d.fin);
        document.getElementById("cf-titre").textContent = d.titre;
        document.getElementById("cf-structure").textContent = "Avec " + d.structure;
        document.getElementById("cf-lien-espace").href = "/compte/?onglet=carnet&code=" + encodeURIComponent(c);
        var ol = document.getElementById("cf-liste"); ol.textContent = "";
        (d.nouvelles || []).forEach(function (x) {
          var li = el("li"); li.appendChild(el("p", "pa-c-sur", dateFr(x.jour || String(x.cree_le).slice(0, 10)) + (x.auteur ? " · " + x.auteur : "")));
          if (x.titre) li.appendChild(el("h3", null, x.titre)); li.appendChild(el("p", "pa-c-texte", x.texte)); ol.appendChild(li);
        });
        document.getElementById("cf-vide").hidden = !!(d.nouvelles || []).length;
        document.getElementById("cf-carnet").hidden = false;
      }).catch(function (e) {
        err.hidden = false; err.className = "cj-retour sjf-ko";
        err.textContent = /fetch|network/i.test(String(e.message)) ? "Le carnet n'a pas pu s'ouvrir : vérifiez votre connexion." : e.message;
      });
    }
    fc.addEventListener("submit", function (e) { e.preventDefault(); var c = fc.elements.code.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); if (c) ouvrir(c); });
    var fs = document.getElementById("cf-suivre"), rs = document.getElementById("cf-suivre-retour");
    fs.addEventListener("submit", function (e) {
      e.preventDefault(); if (!fs.checkValidity()) { fs.reportValidity(); return; }
      var b = fs.querySelector("button"); b.disabled = true;
      rpc("suivre_carnet", { code: code, email: fs.elements[0].value })
        .then(function () { rs.hidden = false; rs.className = "cj-retour sjf-ok"; rs.textContent = "C'est noté : chaque nouvelle de l'équipe vous arrivera par e-mail."; })
        .catch(function (x) { rs.hidden = false; rs.className = "cj-retour sjf-ko"; rs.textContent = x.message; })
        .then(function () { b.disabled = false; });
    });
    var m2 = location.search.match(/[?&]code=([A-Za-z0-9-]{4,16})/), memo = null;
    try { memo = localStorage.getItem("fra-carnet-code"); } catch (e) {}
    if (m2) ouvrir(m2[1].toUpperCase().replace(/[^A-Z0-9]/g, "")); else if (memo && !arret) ouvrir(memo);
  }
})();
