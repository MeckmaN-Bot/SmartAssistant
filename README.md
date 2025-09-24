# WhatsApp Buttler Bot

Leichtgewichtiger WhatsApp-Bot auf Basis von [Baileys](https://github.com/adiwajshing/Baileys), optimiert fuer Ressourcen-schonendes Hosting (z. B. Replit, Render, Railway).

## Features
- Empfaengt Textnachrichten und speichert sie in SQLite (`messages` Tabelle)
- Verarbeitet Sprachnachrichten, laedt sie herunter und transkribiert sie via OpenAI Whisper (Fallback: keine Transkription ohne API-Key)
- Erkennung von Erinnerungen mit natuerlicher Sprache (Chrono-Parser, Deutsch & Englisch)
- Persistente Speicherung der Erinnerungen in der Tabelle `reminders`
- Zyklische Pruefung via `node-cron` und Rueckmeldung zur faelligen Zeit per WhatsApp
- Einfache KI-Antworten per OpenAI Responses API oder Fallback-Logik
- Slash-Befehle `/list` und `/clear`
- Reagiert ausschliesslich in der konfigurierten WhatsApp-Gruppe (`ALLOWED_GROUP_NAME`, Standard "SmartAssistant")
- Minimaler Express-Server (`/ping`) fuer Uptime-Dienste

## Struktur
```
src/
+- index.js            # Einstiegspunkt, orchestriert alle Module
+- ai.js               # KI-Integration
+- config.js           # Konfiguration und ENV-Lade-Logik
+- database.js         # SQLite Helper
+- reminders.js        # Reminder-Erkennung und Serialisierung
+- speech.js           # Whisper-Anbindung
+- whatsapp.js         # Baileys-Verbindung
+- server.js           # Mini-Express-Server (Keep-Alive)
```

## Setup
1. Abhaengigkeiten installieren:
   ```bash
   npm install
   ```
2. `.env` auf Basis von `.env.example` anlegen und Werte fuellen (optional, aber empfohlen):
   ```bash
   cp .env.example .env
   ```
3. Optional: `OPENAI_API_KEY` fuer KI/Whisper setzen und `ALLOWED_GROUP_NAME` auf den exakten Gruppennamen setzen (Standard: SmartAssistant).

## Starten
```bash
npm start
```

Beim ersten Start wird ein QR-Code im Terminal angezeigt. Mit der gewünschten WhatsApp-Nummer scannen.

## Hosting-Hinweise
- Auf Replit/Render sicherstellen, dass `node src/index.js` als Startkommando gesetzt ist.
- Port aus `PORT`-Variable nutzen (bei Replit z. B. 3000). UptimeRobot kann die `/ping`-Route abfragen.
- Die Baileys-Creds werden im Ordner `baileys_auth/` persistiert. Bei stateless Deployments (z. B. Replit) ggf. alternativen Storage einplanen.

## Datenbank
- SQLite-Datei standardmaessig unter `data/storage.sqlite`
- Tabellenstruktur:
  - `messages(id INTEGER PRIMARY KEY, sender TEXT, text TEXT, timestamp INTEGER, type TEXT)`
  - `reminders(id INTEGER PRIMARY KEY, text TEXT, due_date TEXT, notified INTEGER)`
- Der `text`-Wert in `reminders` enthaelt ein JSON-Payload mit `reminderText`, `chatId` und `senderName`.

## Tests & Entwicklung
- Syntax-Check: `node --check src/index.js`
- Logs erscheinen in der Konsole (`console.log` / `console.error`).

## Bekannte Einschraenkungen
- Ohne OpenAI-Key gibt es keine Spracherkennung, AI-Antworten sind einfache Fallbacks.
- Chrono-Parser deckt haeufige deutsche/englische Formulierungen ab, exotische Saetze koennen fehlschlagen.
- Reminder werden einmal pro Minute geprueft (`REMINDER_CRON`).


