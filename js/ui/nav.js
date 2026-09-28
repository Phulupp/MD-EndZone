"use strict";

  /* ------------------------------------------------------------------------
     7. Navigation (Sidebar)
     ------------------------------------------------------------------------ */
  // Views, die zusammen den Leitungsbereich bilden (siehe die
  // Leitungs-Reiterleiste "data-leitung-tab" in index.html) - alle drei
  // teilen sich EINEN Sidebar-Button ("Leitung", data-view="leitung-uebersicht").
  const LEITUNG_ANSICHTEN = ["leitung-uebersicht", "admin", "admin-log"];

  function zeigeAnsicht(view) {
    aktuelleAnsicht = view;
    el.views.forEach((section) => section.classList.toggle("view--active", section.id === `view-${view}`));

    document.querySelectorAll(".sidebar__item").forEach((btn) => {
      const meineAnsicht = btn.getAttribute("data-view");
      // "patient-detail" hat keinen eigenen Sidebar-Button - zählt zu
      // Patientenakten. "admin"/"admin-log" zählen zum Sidebar-Button
      // "Leitung" (data-view="leitung-uebersicht"), siehe LEITUNG_ANSICHTEN.
      btn.classList.toggle(
        "sidebar__item--active",
        meineAnsicht === view ||
          (view === "patient-detail" && meineAnsicht === "patientenakten") ||
          (meineAnsicht === "leitung-uebersicht" && LEITUNG_ANSICHTEN.includes(view))
      );
    });

    // Auf der Patientenseite trägt der Patient selbst die Überschrift (großer
    // Name im Kopf der Seite), Mitarbeiterliste und Leitstelle haben einen
    // eigenen Kopf - der allgemeine Seitentitel würde ihn doppeln.
    const seitenKopf = document.getElementById("page-header");
    if (seitenKopf) seitenKopf.hidden = ["patient-detail", "mitarbeiterliste", "startseite"].includes(view);

    const meta = VIEW_META[view] || { title: view, subtitle: "" };
    el.viewTitle.textContent = meta.title;
    el.viewSubtitle.textContent = meta.subtitle;

    // Für "X sieht diesen Patienten gerade an" (siehe js/ui/presence.js).
    if (typeof setzePraesenzPatient === "function") {
      setzePraesenzPatient(view === "patient-detail" ? offenerPatientId : null);
    }
    if (typeof aktualisiereAnwesenheit === "function") aktualisiereAnwesenheit();

    window.scrollTo({ top: 0 });
  }

  if (el.sidebarNav) {
    el.sidebarNav.addEventListener("click", (event) => {
      const btn = event.target.closest(".sidebar__item");
      if (!btn || btn.hidden) return;
      zeigeAnsicht(btn.getAttribute("data-view"));
    });
  }

  document.querySelectorAll("[data-quicklink]").forEach((btn) => {
    btn.addEventListener("click", () => zeigeAnsicht(btn.getAttribute("data-quicklink")));
  });

  // Leitungs-Reiterleiste (Übersicht/Personalakten/.../Aktivitäten) - dieselbe
  // Mechanik wie zuvor "data-admin-subview", nur umbenannt und auf alle
  // Leitungs-Unterseiten erweitert (siehe LEITUNG_ANSICHTEN oben).
  document.querySelectorAll("[data-leitung-tab]").forEach((btn) => {
    btn.addEventListener("click", () => zeigeAnsicht(btn.getAttribute("data-leitung-tab")));
  });

  /* ------------------------------------------------------------------------
     7b. Topbar-Uhr (rein clientseitig, keine Firestore-Daten)
     ------------------------------------------------------------------------ */
  function aktualisiereTopbarUhr() {
    if (!el.topbarDatum) return;
    const jetzt = new Date();
    const wochentag = jetzt.toLocaleDateString("de-DE", { weekday: "long" });
    const uhrzeit = `${String(jetzt.getHours()).padStart(2, "0")}:${String(jetzt.getMinutes()).padStart(2, "0")}`;
    el.topbarDatum.textContent = `${wochentag}, ${formatDatum(jetzt)} ${uhrzeit} Uhr`;
  }
  aktualisiereTopbarUhr();
  setInterval(aktualisiereTopbarUhr, 30 * 1000);

  // Kleine Popover (Online-Liste, Konto-Menü): immer nur eines offen, Klick
  // irgendwo sonst schließt sie.
  function schliesseSidebarPopover() {
    el.onlinePanel && el.onlinePanel.classList.remove("online-panel--visible");
    if (el.sidebarUserMenu) el.sidebarUserMenu.classList.remove("sidebar__user-menu--visible");
    if (el.sidebarUserBtn) el.sidebarUserBtn.setAttribute("aria-expanded", "false");
  }

  document.addEventListener("click", schliesseSidebarPopover);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") schliesseSidebarPopover();
  });

  if (el.onlineWidgetBtn) {
    el.onlineWidgetBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const warOffen = el.onlinePanel.classList.contains("online-panel--visible");
      schliesseSidebarPopover();
      el.onlinePanel.classList.toggle("online-panel--visible", !warOffen);
    });
  }

  if (el.sidebarUserBtn) {
    el.sidebarUserBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const warOffen = el.sidebarUserMenu.classList.contains("sidebar__user-menu--visible");
      schliesseSidebarPopover();
      el.sidebarUserMenu.classList.toggle("sidebar__user-menu--visible", !warOffen);
      el.sidebarUserBtn.setAttribute("aria-expanded", String(!warOffen));
    });
  }
