/* Fil Roug'Anim : le carnet de séjour pour l'équipe (/enfants/carnet/?j=…), sans compte. */
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
  if (!jeton) { etat.textContent = "Il manque le lien de la structure : ouvrez le lien qu'elle vous a donné."; return; }
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
})();
