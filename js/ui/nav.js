"use strict";

  /* ------------------------------------------------------------------------
     7. Navigation (Sidebar)
     ------------------------------------------------------------------------ */
  function zeigeAnsicht(view) {
    aktuelleAnsicht = view;
    el.views.forEach((section) => section.classList.toggle("view--active", section.id === `view-${view}`));

    document.querySelectorAll(".sidebar__item").forEach((btn) => {
      const meineAnsicht = btn.getAttribute("data-view");
      // "admin-log" und "patient-detail" haben keinen eigenen Sidebar-Button -
      // sie zählen zum Bereich Verwaltung bzw. Patientenakten.
      btn.classList.toggle(
        "sidebar__item--active",
        meineAnsicht === view ||
          (view === "admin-log" && meineAnsicht === "admin") ||
          (view === "patient-detail" && meineAnsicht === "patientenakten")
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

  document.querySelectorAll("[data-admin-subview]").forEach((btn) => {
    btn.addEventListener("click", () => zeigeAnsicht(btn.getAttribute("data-admin-subview")));
  });

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
