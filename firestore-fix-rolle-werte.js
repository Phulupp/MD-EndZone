/* ============================================================================
   Einmaliges Korrektur-Skript — users.rolle: Anzeigename -> rangId
   ============================================================================
   KEIN Teil der App - wird von index.html NICHT geladen und läuft NIEMALS
   automatisch. Nur wenn ein Admin diese Datei manuell in die Browser-Konsole
   einfügt, passiert überhaupt etwas.

   AUSGANGSLAGE: "users.rolle" enthielt bisher einen Anzeigenamen (z. B.
   "Notarzt"). Seit der Umstellung auf die zentrale Rangverwaltung (Collection
   "raenge") soll "rolle" stattdessen direkt die stabile rangId enthalten
   (z. B. "notarzt") - SELBES Feld, kein neues "rolleId".

   WAS DIESES SKRIPT TUT:
   - Liest alle "users"-Dokumente.
   - Bestimmt für jedes Dokument anhand des heutigen "rolle"-Anzeigenamens
     (inkl. der beiden alten, nicht mehr vergebenen Namen "Praktikant" und
     "Ärztlicher Leiter") die passende rangId aus "raenge".
   - Gibt VOR dem Schreiben drei gut lesbare Tabellen aus: bereits korrekt
     (übersprungen), wird jetzt umgestellt, und NICHT eindeutig zuordenbar.
   - Benutzer, deren "rolle" nicht eindeutig zugeordnet werden kann (Tipp-
     fehler, unbekannter Wert, leeres Feld), werden NICHT verändert - keine
     stillen Änderungen. Diese Fälle danach einmal manuell über die neue
     Personalakte (Leitung) bzw. "Ränge & Rollen" (Admin) korrigieren.
   - Bereits umgestellte Benutzer (deren "rolle" schon einer bekannten
     rangId entspricht) werden übersprungen - das Skript ist bei Bedarf
     gefahrlos wiederholbar.

   AUSFÜHRUNG: Als Admin eingeloggt, Entwicklertools (F12) -> Reiter
   "Konsole" -> kompletten Dateiinhalt einfügen -> Enter.
   ============================================================================ */
(async () => {
  const NAME_ZU_RANGID = {
    "Azubi": "azubi",
    "Sanitätshelfer": "sanitaetshelfer",
    "Rettungssanitäter": "rettungssanitaeter",
    "Notfallsanitäter": "notfallsanitaeter",
    "Organisatorischer Leiter Rettungsdienst": "organisatorischer-leiter-rettungsdienst",
    "Medizinstudent": "medizinstudent",
    "Notarzt": "notarzt",
    "Leitender Notarzt": "leitender-notarzt",
    "Ärztlicher Leiter Rettungsdienst": "aerztlicher-leiter-rettungsdienst",
  };
  // Alte, nicht mehr vergebene Rangnamen, die dennoch bei Bestandsaccounts
  // stehen können - identisch zum früheren RANG_ALIAS in js/core/config.js.
  const ALTE_ALIAS = {
    "Praktikant": "Azubi",
    "Ärztlicher Leiter": "Ärztlicher Leiter Rettungsdienst",
  };

  const raengeSnap = await db.collection("raenge").get();
  const vorhandeneRangIds = raengeSnap.docs.map((d) => d.id);
  if (vorhandeneRangIds.length === 0) {
    console.error('Die Collection "raenge" ist leer oder nicht lesbar - bitte zuerst firestore-seed-raenge.js ausführen.');
    return;
  }

  const usersSnap = await db.collection("users").get();

  const bereitsOk = [];
  const geplant = [];
  const unklar = [];

  usersSnap.forEach((docSnap) => {
    const daten = docSnap.data();
    const uid = docSnap.id;
    const name = daten.username || "(ohne Namen)";
    const rolle = daten.rolle;

    if (typeof rolle === "string" && vorhandeneRangIds.includes(rolle)) {
      bereitsOk.push({ uid, name, rolle });
      return;
    }

    const normalisiert = ALTE_ALIAS[rolle] || rolle;
    const rangId = NAME_ZU_RANGID[normalisiert];

    if (!rangId) {
      unklar.push({ uid, name, rolle: rolle === undefined ? "(Feld fehlt)" : `"${rolle}"` });
      return;
    }

    geplant.push({ uid, name, alt: rolle, neu: rangId });
  });

  console.log(`Bereits eine gültige rangId (übersprungen): ${bereitsOk.length}`);
  if (bereitsOk.length) console.table(bereitsOk);

  console.log(`Wird jetzt umgestellt: ${geplant.length}`);
  if (geplant.length) console.table(geplant);

  console.log(`NICHT eindeutig zuordenbar - bleibt unverändert: ${unklar.length}`);
  if (unklar.length) console.table(unklar);
  if (unklar.length > 0) {
    console.warn(`${unklar.length} Benutzer wurden NICHT verändert. Bitte deren Rang danach einmal manuell in der Personalakte neu setzen.`);
  }

  if (geplant.length === 0) {
    console.log("Nichts zu tun - keine Schreibvorgänge nötig.");
    return;
  }

  const batch = db.batch();
  geplant.forEach(({ uid, neu }) => {
    batch.update(db.collection("users").doc(uid), { rolle: neu });
  });
  await batch.commit();
  console.log(`Fertig: ${geplant.length} Benutzer umgestellt.`);
})();
