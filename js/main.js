"use strict";

  /* ------------------------------------------------------------------------
     21. Start / Stop der App (reagiert auf js/auth.js-Events)
     ------------------------------------------------------------------------ */
  // Rang-Anzeige in der Sidebar-Identität setzen - Name/Avatar-Farbe (siehe
  // js/core/raenge.js) UND ein Rang-Stufen-Balken, der die Position
  // innerhalb der MD-Hierarchie zeigt (ein Segment je geladenem Rang,
  // gefüllt bis zur eigenen Stufe) - Ränge mit "akzentring:true" bekommen
  // zusätzlich einen leuchtenden Akzentring um den Avatar.
  function aktualisiereSidebarRang(rangId) {
    const name = rangName(rangId);
    el.sidebarUserRole.textContent = name;
    const farbe = rangFarbe(rangId);
    el.sidebarUserRole.style.color = farbe;
    el.sidebarUserAvatar.style.setProperty("--rang-farbe", farbe);
    el.sidebarUserAvatar.classList.toggle("sidebar__user-avatar--akzent", rangAkzentring(rangId));

    if (el.sidebarRangStufen) {
      const stufe = raenge.findIndex((r) => r.rangId === rangId) + 1;
      el.sidebarRangStufen.innerHTML = raenge.map((_, i) => {
        const aktiv = i < stufe;
        return `<span class="sidebar__rang-stufe" style="${aktiv ? `background:${farbe};` : ""}"></span>`;
      }).join("");
    }
  }

  function starteApp(detail) {
    aktuellerNutzer = { uid: detail.uid, name: detail.username, rolle: detail.rolle, admin: !!detail.isAdmin, leitung: !!detail.isLeitung };

    el.sidebarUserAvatar.textContent = initialenAvatar(aktuellerNutzer.name);
    el.sidebarUserName.textContent = aktuellerNutzer.name;
    aktualisiereSidebarRang(aktuellerNutzer.rolle);

    // Zwei GETRENNTE geschützte Bereiche mit je eigener Sichtbarkeit - siehe
    // die Kommentare bei den Buttons in index.html.
    el.navLeitungToggle.hidden = !(istAdmin() || istLeitung());
    el.navAdminToggle.hidden = !istAdmin();
    if (!istAdmin()) el.navAdminBadge.hidden = true;

    ladeThema();
    starteHeartbeat();
    // Ränge: für jeden freigegebenen Nutzer, nicht nur Admin/Leitung (siehe
    // js/core/raenge.js).
    starteRaengeListener();
    startePatientenListener();
    starteAktenListener();
    starteGutachtenListener();
    starteLeitfaedenListener();
    starteTermineListener();
    starteMitarbeiterListener();
    starteDienstListener();
    starteLeitstelleInfoListener();
    // benutzerListe wird von Verwaltung UND Leitung-Personal gebraucht.
    if (istAdmin() || istLeitung()) starteBenutzerverwaltung();
    // adminLog bleibt strikt admin-exklusiv.
    if (istAdmin()) starteAdminLog();
    // personalnotizen/ranghistorie: dieselbe Sichtbarkeit wie Leitung.
    if (istAdmin() || istLeitung()) starteLeitungPersonalListener();

    zeigeAnsicht(ladeStartseite());

    pruefeVersion();
    clearInterval(versionCheckTimer);
    versionCheckTimer = setInterval(pruefeVersion, 5 * 60 * 1000);
  }

  function aktualisiereNutzerProfil(detail) {
    if (!aktuellerNutzer) return;
    const warAdmin = istAdmin();
    const warLeitung = istLeitung();
    const hatteZugriffAufPersonal = warAdmin || warLeitung;
    aktuellerNutzer.rolle = detail.rolle;
    aktuellerNutzer.admin = !!detail.isAdmin;
    aktuellerNutzer.leitung = !!detail.isLeitung;
    aktualisiereSidebarRang(aktuellerNutzer.rolle);

    el.navLeitungToggle.hidden = !(istAdmin() || istLeitung());
    el.navAdminToggle.hidden = !istAdmin();

    const brauchtZugriffAufPersonal = istAdmin() || istLeitung();
    if (brauchtZugriffAufPersonal && !hatteZugriffAufPersonal) {
      starteBenutzerverwaltung();
      starteLeitungPersonalListener();
    }
    if (!brauchtZugriffAufPersonal && hatteZugriffAufPersonal) {
      stoppeBenutzerverwaltung();
      stoppeLeitungPersonalListener();
    }

    if (!warAdmin && istAdmin()) starteAdminLog();
    if (warAdmin && !istAdmin()) stoppeAdminLog();

    // Wer Adminrechte verliert, fliegt aus der Verwaltung; wer BEIDE Rechte
    // verliert, fliegt zusätzlich aus dem gesamten Leitungsbereich.
    if (warAdmin && !istAdmin() && ["admin-uebersicht", "admin", "admin-raenge", "admin-system", "admin-log"].includes(aktuelleAnsicht)) zeigeAnsicht("startseite");
    if (hatteZugriffAufPersonal && !brauchtZugriffAufPersonal && ["leitung-uebersicht", "leitung-personal", "leitung-personalakte"].includes(aktuelleAnsicht)) {
      zeigeAnsicht("startseite");
    }

    renderBeispiele();
    renderMitarbeiter();
    renderLeitstelle();
    aktualisiereAdminSteuerung();
  }

  function stoppeApp() {
    aktuellerNutzer = null;
    wendeThemaAn("dunkel");
    [
      unsubPatienten,
      unsubAkten,
      unsubGutachten,
      unsubLeitfaeden,
      unsubTermine,
      unsubMitarbeiter,
      unsubDienst,
      unsubLeitstelleInfo,
    ].forEach((unsub) => unsub && unsub());
    unsubPatienten = unsubAkten = unsubGutachten = unsubLeitfaeden = unsubTermine = unsubMitarbeiter = unsubDienst = unsubLeitstelleInfo = null;
    stoppeRaengeListener();
    stoppeBenutzerverwaltung();
    stoppeAdminLog();
    stoppeLeitungPersonalListener();
    stoppeHeartbeat();
    clearInterval(versionCheckTimer);
    patienten = [];
    akten = [];
    gutachten = [];
    bearbeitetesGutachtenId = null;
    offenesGutachtenId = null;
    gewaehltesGutachtenErgebnis = "";
    leitfaeden = [];
    leitfadenKategorien = [];
    termine = [];
    mitarbeiter = [];
    dienstStatus = {};
    leitstelleInfo = { text: "", von: "", am: null };
    leitstelleInfoBearbeiten = false;
    mitarbeiterMeta = { von: "", am: null };
    mitarbeiterBearbeiten = false;
    mitarbeiterEntwurf = [];
    maBasisStempel = 0;
    maSpeichertGerade = false;
    beispieleKategorieId = null;
    beispieleBeispielId = null;
    bearbeiteteAkteId = null;
    offenerPatientId = null;
    offeneAkteDetailId = null;
    offenerPatientGesehen = false;
    profilBasisStempel = 0;
    profilGeaendert = false;
    akteBasisStempel = 0;
    benutzerListe = [];
    adminLogEintraege = [];
    personalnotizen = [];
    ranghistorie = [];
    offenerPersonalUid = null;
  }

  window.addEventListener("md:auth-approved", (event) => starteApp(event.detail));
  window.addEventListener("md:auth-profile-updated", (event) => aktualisiereNutzerProfil(event.detail));
  window.addEventListener("md:auth-signed-out", stoppeApp);
