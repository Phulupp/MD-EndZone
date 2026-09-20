"use strict";

/* ==========================================================================
   Öffentliche Akte-Ansicht (akte.html)
   --------------------------------------------------------------------------
   Liest die per Zugriffslink geteilte Kopie einer Akte (Collection
   "freigaben", Dokument-ID = Schlüssel aus dem Adress-Anhang) und zeigt sie
   schreibgeschützt an. Kein Login. Ob die Kopie noch gültig ist, prüft
   Firestore selbst (siehe firestore.rules). Nutzt dieselbe Darstellung wie die
   App (js/core/akte-dokument.js) und denselben PDF-Export (js/core/akte-pdf.js).
   ========================================================================== */
(function () {
  const zustand = document.getElementById("akte-zustand");
  const dokument = document.getElementById("akte-dokument");
  const fuss = document.getElementById("akte-fuss");
  const btnPdf = document.getElementById("btn-pdf");

  function zeigeFehler(text) {
    zustand.textContent = text;
    zustand.classList.add("akte-oeffentlich__zustand--fehler");
    zustand.hidden = false;
    dokument.hidden = true;
    btnPdf.hidden = true;
  }

  function formatZeit(ts) {
    if (!ts || typeof ts.toDate !== "function") return "";
    const d = ts.toDate();
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())} Uhr`;
  }

  const token = (window.location.hash || "").replace(/^#/, "").trim();
  if (!/^[0-9a-f]{32,}$/.test(token)) {
    zeigeFehler("Dieser Link ist unvollständig. Bitte den ganzen Link verwenden.");
    return;
  }
  if (typeof db === "undefined" || !db) {
    zeigeFehler("Die Verbindung zur Datenbank ist nicht möglich. Bitte Internetverbindung prüfen und neu laden.");
    return;
  }

  let daten = null;

  db.collection("freigaben")
    .doc(token)
    .get()
    .then((snap) => {
      if (!snap.exists) return zeigeFehler("Dieser Link ist ungültig oder abgelaufen.");
      const freigabe = snap.data();
      daten = freigabe.daten;
      document.title = `Akte ${daten.nummer} — ${daten.patientName} — Medical Department`;
      document.getElementById("akte-kicker").textContent = `Behandlungsakte · Akte ${daten.nummer}`;
      document.getElementById("akte-titel").textContent = daten.behandlungsgrund || `Akte ${daten.nummer}`;
      document.getElementById("akte-inhalt").innerHTML = akteInhaltHtml(daten);
      document.getElementById("akte-seite").innerHTML = akteSeiteHtml(daten);
      const stand = formatZeit(freigabe.aktualisiertAm);
      const bis = formatZeit(freigabe.laeuftAb);
      fuss.textContent = `Schreibgeschützte Kopie${stand ? `, Stand ${stand}` : ""}${bis ? `. Dieser Link ist gültig bis ${bis}.` : "."}`;
      fuss.hidden = false;
      zustand.hidden = true;
      dokument.hidden = false;
      btnPdf.hidden = false;
    })
    .catch(() => zeigeFehler("Dieser Link ist ungültig oder abgelaufen."));

  btnPdf.addEventListener("click", () => {
    if (!daten) return;
    try {
      speichereAktePdf(daten);
    } catch (fehler) {
      console.error(fehler);
      window.alert("Das PDF konnte nicht erstellt werden. Bitte Seite neu laden und es erneut versuchen.");
    }
  });
})();
