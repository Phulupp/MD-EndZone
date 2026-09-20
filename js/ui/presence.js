"use strict";

  /* ------------------------------------------------------------------------
     8. Presence / Online-Anzeige
     ------------------------------------------------------------------------ */
  function erzeugeSessionId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  // Wo im MD-Bereich ist dieser Browser-Tab gerade? Wird mit dem Heartbeat
  // mitgeschrieben, damit andere sehen "X sieht diesen Patienten gerade an" /
  // "X bearbeitet diese Akte gerade" (siehe aktualisiereAnwesenheit in
  // js/views/patientenakten.js). praesenzListe enthält ALLE aktiven Sessions
  // (auch die eigene, mehrere je Person), aktive nur die eindeutigen Namen für
  // die Online-Anzeige.
  let praesenzPatientId = null;
  let praesenzAkteId = null;
  let praesenzListe = [];

  function schreibePraesenz() {
    if (!db || !aktuellerNutzer || !sessionId) return;
    db.collection(PRESENCE_COLLECTION)
      .doc(sessionId)
      .set({
        uid: aktuellerNutzer.uid,
        name: aktuellerNutzer.name,
        patientId: praesenzPatientId,
        akteId: praesenzAkteId,
        letztesUpdate: firebase.firestore.FieldValue.serverTimestamp(),
      })
      .catch(() => {});
  }

  function setzePraesenzPatient(patientId) {
    const neu = patientId || null;
    if (neu === praesenzPatientId) return;
    praesenzPatientId = neu;
    schreibePraesenz();
  }

  function setzePraesenzAkte(akteId) {
    const neu = akteId || null;
    if (neu === praesenzAkteId) return;
    praesenzAkteId = neu;
    schreibePraesenz();
  }

  function starteHeartbeat() {
    if (!db || !aktuellerNutzer) return;
    sessionId = sessionId || erzeugeSessionId();
    schreibePraesenz();
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(schreibePraesenz, HEARTBEAT_INTERVALL_MS);

    if (unsubPresence) unsubPresence();
    unsubPresence = db.collection(PRESENCE_COLLECTION).onSnapshot(
      (snap) => {
        const jetzt = Date.now();
        const aktive = [];
        const sessions = [];
        const gesehen = new Set();
        snap.forEach((docSnap) => {
          const daten = docSnap.data();
          if (!daten.letztesUpdate) return;
          const zeit = daten.letztesUpdate.toMillis ? daten.letztesUpdate.toMillis() : 0;
          if (jetzt - zeit > ONLINE_SCHWELLE_MS) return;
          sessions.push({ uid: daten.uid, name: daten.name || "Unbekannt", patientId: daten.patientId || null, akteId: daten.akteId || null });
          if (gesehen.has(daten.uid)) return;
          gesehen.add(daten.uid);
          aktive.push(daten.name || "Unbekannt");
        });
        praesenzListe = sessions;
        if (typeof aktualisiereAnwesenheit === "function") aktualisiereAnwesenheit();
        el.onlineCount.textContent = String(aktive.length);
        el.onlinePanelList.innerHTML =
          aktive.length === 0
            ? '<p class="online-panel__empty">Niemand sonst online.</p>'
            : aktive.map((name) => `<div class="online-panel__person">${escapeHtml(name)}</div>`).join("");
      },
      () => {}
    );
  }

  function stoppeHeartbeat() {
    clearInterval(heartbeatTimer);
    clearInterval(onlineRecomputeTimer);
    if (unsubPresence) {
      unsubPresence();
      unsubPresence = null;
    }
    if (sessionId && db) {
      db.collection(PRESENCE_COLLECTION).doc(sessionId).delete().catch(() => {});
    }
    praesenzPatientId = null;
    praesenzAkteId = null;
    praesenzListe = [];
  }

  // Best effort beim Schließen des Tabs, damit die Anzeige nicht bis zum
  // Ablauf der Online-Schwelle stehen bleibt.
  window.addEventListener("pagehide", () => {
    if (sessionId && db && aktuellerNutzer) db.collection(PRESENCE_COLLECTION).doc(sessionId).delete().catch(() => {});
  });

