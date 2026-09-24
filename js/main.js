"use strict";

  /* ------------------------------------------------------------------------
     21. Start / Stop der App (reagiert auf js/auth.js-Events)
     ------------------------------------------------------------------------ */
  // Rang-Anzeige in der Sidebar-Identität setzen - Name/Avatar-Farbe (siehe
  // RANG_AKZENTE in js/core/config.js) UND ein Rang-Stufen-Balken, der die
  // Position innerhalb der MD-Hierarchie zeigt (ein Segment pro Rang in
  // BENUTZER_RAENGE, gefüllt bis zur eigenen Stufe) - die beiden
  // Spitzenränge (RANG_AKZENTRING) bekommen zusätzlich einen leuchtenden
  // Akzentring um den Avatar.
  function aktualisiereSidebarRang(gespeicherterRang) {
    // Alte, umbenannte Ränge werden für die Anzeige auf den neuen Namen
    // abgebildet (siehe RANG_ALIAS in js/core/config.js).
    const rolle = normalisiereRang(gespeicherterRang);
    el.sidebarUserRole.textContent = rolle;
    const farbe = RANG_AKZENTE[rolle] || RANG_AKZENT_STANDARD;
    el.sidebarUserRole.style.color = farbe;
    el.sidebarUserAvatar.style.setProperty("--rang-farbe", farbe);
    el.sidebarUserAvatar.classList.toggle("sidebar__user-avatar--akzent", RANG_AKZENTRING.includes(rolle));

    if (el.sidebarRangStufen) {
      const stufe = BENUTZER_RAENGE.indexOf(rolle) + 1;
      el.sidebarRangStufen.innerHTML = BENUTZER_RAENGE.map((_, i) => {
        const aktiv = i < stufe;
        return `<span class="sidebar__rang-stufe" style="${aktiv ? `background:${farbe};` : ""}"></span>`;
      }).join("");
    }
  }

  function starteApp(detail) {
    aktuellerNutzer = { uid: detail.uid, name: detail.username, rolle: detail.rolle, admin: !!detail.isAdmin };

    el.sidebarUserAvatar.textContent = initialenAvatar(aktuellerNutzer.name);
    el.sidebarUserName.textContent = aktuellerNutzer.name;
    aktualisiereSidebarRang(aktuellerNutzer.rolle);

    el.navAdminToggle.hidden = !istAdmin();
    if (!istAdmin()) el.navAdminBadge.hidden = true;

    ladeThema();
    starteHeartbeat();
    startePatientenListener();
    starteAktenListener();
    starteGutachtenListener();
    starteLeitfaedenListener();
    starteTermineListener();
    starteMitarbeiterListener();
    starteDienstListener();
    if (istAdmin()) starteBenutzerverwaltung();

    zeigeAnsicht(ladeStartseite());

    pruefeVersion();
    clearInterval(versionCheckTimer);
    versionCheckTimer = setInterval(pruefeVersion, 5 * 60 * 1000);
  }

  function aktualisiereNutzerProfil(detail) {
    if (!aktuellerNutzer) return;
    const warAdmin = istAdmin();
    aktuellerNutzer.rolle = detail.rolle;
    aktuellerNutzer.admin = !!detail.isAdmin;
    aktualisiereSidebarRang(aktuellerNutzer.rolle);
    el.navAdminToggle.hidden = !istAdmin();
    if (!warAdmin && istAdmin()) starteBenutzerverwaltung();
    if (warAdmin && !istAdmin()) {
      stoppeBenutzerverwaltung();
      if (aktuelleAnsicht === "admin" || aktuelleAnsicht === "admin-log") zeigeAnsicht("startseite");
    }
    renderBeispiele();
    renderMitarbeiter();
    renderLeitstelle();
    aktualisiereAdminSteuerung();
  }

  function stoppeApp() {
    aktuellerNutzer = null;
    wendeThemaAn("dunkel");
    [unsubPatienten, unsubAkten, unsubGutachten, unsubLeitfaeden, unsubTermine, unsubMitarbeiter, unsubDienst].forEach((unsub) => unsub && unsub());
    unsubPatienten = unsubAkten = unsubGutachten = unsubLeitfaeden = unsubTermine = unsubMitarbeiter = unsubDienst = null;
    stoppeBenutzerverwaltung();
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
  }

  window.addEventListener("md:auth-approved", (event) => starteApp(event.detail));
  window.addEventListener("md:auth-profile-updated", (event) => aktualisiereNutzerProfil(event.detail));
  window.addEventListener("md:auth-signed-out", stoppeApp);
