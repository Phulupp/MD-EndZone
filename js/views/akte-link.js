"use strict";

  /* ------------------------------------------------------------------------
     18b. Zugriffslink für eine Akte
     ------------------------------------------------------------------------
     Erzeugt eine schreibgeschützte KOPIE der Akte in der Collection
     "freigaben" (Dokument-ID = zufälliger Schlüssel). Wer den Link kennt,
     sieht sie auf akte.html - ohne Konto - und kann sie als PDF speichern.
     Die Kopie läuft nach ZUGRIFFSLINK_TAGE Tagen ab (erzwingt firestore.rules)
     und lässt sich jederzeit löschen oder aktualisieren. Die Kopie wird
     bewusst NICHT automatisch mit der Akte synchron gehalten: was jemand über
     den Link sieht, ändert sich nur, wenn hier ausdrücklich aktualisiert wird. */
  let linkAkteId = null;
  let linkDoc = null;

  function erzeugeZugriffsToken() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function zugriffsUrl(token) {
    // Der Schlüssel steht hinter "#": er wird so nie an einen Server gesendet
    // (weder beim Aufruf noch als Referrer).
    return new URL(`akte.html#${token}`, window.location.href).href;
  }

  function gueltigBisTimestamp() {
    return firebase.firestore.Timestamp.fromDate(new Date(Date.now() + ZUGRIFFSLINK_TAGE * 24 * 60 * 60 * 1000));
  }

  // Aktuell gültiger Link zu dieser Akte (oder null); abgelaufene werden
  // nebenbei aufgeräumt.
  async function ladeZugriffsLink(akteId) {
    const snap = await db.collection(FREIGABEN_COLLECTION).where("akteId", "==", akteId).get();
    const jetzt = Date.now();
    let aktuell = null;
    snap.forEach((docSnap) => {
      const daten = docSnap.data();
      if (zeitstempelWert(daten.laeuftAb) > jetzt) {
        if (!aktuell || zeitstempelWert(daten.aktualisiertAm) > zeitstempelWert(aktuell.aktualisiertAm)) aktuell = { token: docSnap.id, ...daten };
      } else {
        docSnap.ref.delete().catch(() => {});
      }
    });
    return aktuell;
  }

  // Beim Löschen einer Akte/eines Patienten: zugehörige Links mit entfernen,
  // damit über einen alten Link keine gelöschten Daten erreichbar bleiben.
  async function loescheFreigabenFuerAkte(akteId) {
    try {
      const snap = await db.collection(FREIGABEN_COLLECTION).where("akteId", "==", akteId).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    } catch (fehler) {
      console.error("Zugriffslinks konnten nicht entfernt werden:", fehler);
    }
  }

  function zeigeLinkZustand() {
    const hat = !!linkDoc;
    el.akteLinkLeer.hidden = hat;
    el.akteLinkAktiv.hidden = !hat;
    el.btnAkteLinkErstellen.hidden = hat;
    el.btnAkteLinkKopieren.hidden = !hat;
    el.btnAkteLinkAktualisieren.hidden = !hat;
    el.btnAkteLinkLoeschen.hidden = !hat;
    if (!hat) return;

    el.akteLinkFeld.value = zugriffsUrl(linkDoc.token);
    const akte = akten.find((x) => x.id === linkAkteId);
    const veraltet = akte && zeitstempelWert(akte.bearbeitetAm) > zeitstempelWert(linkDoc.aktualisiertAm);
    el.akteLinkInfo.textContent =
      `Gültig bis ${formatDatumUhrzeit(linkDoc.laeuftAb)}. Erstellt von ${linkDoc.erstelltVon || "—"}, Stand der Kopie: ${formatDatumUhrzeit(linkDoc.aktualisiertAm)}.` +
      (veraltet ? " Die Akte wurde seitdem geändert - mit „Kopie aktualisieren“ übernimmst du die neue Fassung in den Link." : "");
  }

  async function oeffneAkteLinkModal(akteId) {
    const a = akten.find((x) => x.id === akteId);
    if (!a) return;
    linkAkteId = akteId;
    linkDoc = null;
    const d = akteDaten(a);
    el.akteLinkTitel.textContent = `Akte ${d.nummer} · ${d.patientName}`;
    el.akteLinkTage.textContent = String(ZUGRIFFSLINK_TAGE);
    versteckeFeldFehler(el.akteLinkError);
    [el.akteLinkLeer, el.akteLinkAktiv, el.btnAkteLinkErstellen, el.btnAkteLinkKopieren, el.btnAkteLinkAktualisieren, el.btnAkteLinkLoeschen].forEach(
      (e) => (e.hidden = true)
    );
    oeffneModal("modal-akte-link");
    try {
      const gefunden = await ladeZugriffsLink(akteId);
      if (linkAkteId !== akteId) return;
      linkDoc = gefunden;
      zeigeLinkZustand();
    } catch (fehler) {
      console.error(fehler);
      zeigeFeldFehler(el.akteLinkError, "Der Link-Status konnte nicht geladen werden. Bitte erneut versuchen.");
    }
  }

  if (el.btnAkteLink) {
    el.btnAkteLink.addEventListener("click", () => {
      if (offeneAkteDetailId) oeffneAkteLinkModal(offeneAkteDetailId);
    });
  }

  if (el.btnAkteLinkErstellen) {
    el.btnAkteLinkErstellen.addEventListener("click", async () => {
      versteckeFeldFehler(el.akteLinkError);
      const a = akten.find((x) => x.id === linkAkteId);
      if (!a) return;
      const token = erzeugeZugriffsToken();
      const daten = {
        akteId: a.id,
        patientId: a.patientId,
        daten: akteDaten(a),
        erstelltVon: aktuellerNutzer ? aktuellerNutzer.name : null,
        erstelltAm: firebase.firestore.FieldValue.serverTimestamp(),
        aktualisiertAm: firebase.firestore.Timestamp.now(),
        laeuftAb: gueltigBisTimestamp(),
      };
      try {
        await db.collection(FREIGABEN_COLLECTION).doc(token).set(daten);
        linkDoc = { token, ...daten, erstelltAm: firebase.firestore.Timestamp.now() };
        zeigeLinkZustand();
        zeigeToast("Zugriffslink erstellt.");
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.akteLinkError, "Der Link konnte nicht erstellt werden. Bitte erneut versuchen.");
      }
    });
  }

  if (el.btnAkteLinkKopieren) {
    el.btnAkteLinkKopieren.addEventListener("click", async () => {
      if (!linkDoc) return;
      zeigeToast((await kopiereText(zugriffsUrl(linkDoc.token))) ? "Link kopiert." : "Kopieren nicht möglich - Link bitte markieren und von Hand kopieren.");
    });
  }

  if (el.akteLinkFeld) {
    el.akteLinkFeld.addEventListener("focus", () => el.akteLinkFeld.select());
  }

  if (el.btnAkteLinkAktualisieren) {
    el.btnAkteLinkAktualisieren.addEventListener("click", async () => {
      versteckeFeldFehler(el.akteLinkError);
      const a = akten.find((x) => x.id === linkAkteId);
      if (!a || !linkDoc) return;
      const update = { daten: akteDaten(a), aktualisiertAm: firebase.firestore.Timestamp.now(), laeuftAb: gueltigBisTimestamp() };
      try {
        await db.collection(FREIGABEN_COLLECTION).doc(linkDoc.token).update(update);
        linkDoc = { ...linkDoc, ...update };
        zeigeLinkZustand();
        zeigeToast("Kopie aktualisiert, die Gültigkeit beginnt neu.");
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.akteLinkError, "Aktualisieren fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  }

  if (el.btnAkteLinkLoeschen) {
    el.btnAkteLinkLoeschen.addEventListener("click", () => {
      if (!linkDoc) return;
      const token = linkDoc.token;
      fordereLoeschungAn("Zugriffslink löschen", "Der Link funktioniert danach nicht mehr. Möchtest du ihn wirklich löschen?", async () => {
        await db.collection(FREIGABEN_COLLECTION).doc(token).delete();
        linkDoc = null;
        zeigeLinkZustand();
        zeigeToast("Zugriffslink gelöscht.");
      });
    });
  }
