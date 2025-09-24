const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const config = require('./config');

let dbInstance;

function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = config.dbPath;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  dbInstance = new sqlite3.Database(dbPath);
  return dbInstance;
}

function run(query, params = []) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    db.run(query, params, function onResult(err) {
      if (err) {
        return reject(err);
      }
      resolve(this);
    });
  });
}

function all(query, params = []) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
}

async function initDatabase() {
  await run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT,
    text TEXT,
    timestamp INTEGER,
    type TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT,
    due_date TEXT,
    notified INTEGER DEFAULT 0
  )`);
}

async function saveMessage({ sender, text, timestamp, type }) {
  const result = await run(
    'INSERT INTO messages (sender, text, timestamp, type) VALUES (?, ?, ?, ?)',
    [sender, text, timestamp, type]
  );
  return result.lastID;
}

async function saveReminder({ text, dueDate }) {
  const result = await run(
    'INSERT INTO reminders (text, due_date, notified) VALUES (?, ?, 0)',
    [text, dueDate]
  );
  return result.lastID;
}

async function listOpenReminders() {
  return all('SELECT * FROM reminders WHERE notified = 0 ORDER BY datetime(due_date) ASC');
}

async function listAllMessages(limit = 100) {
  return all('SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?', [limit]);
}

async function getDueReminders(referenceDate = new Date()) {
  const iso = new Date(referenceDate).toISOString();
  return all(
    'SELECT * FROM reminders WHERE notified = 0 AND datetime(due_date) <= datetime(?) ORDER BY datetime(due_date) ASC',
    [iso]
  );
}

async function markReminderNotified(id) {
  await run('UPDATE reminders SET notified = 1 WHERE id = ?', [id]);
}

async function clearDatabase() {
  await run('DELETE FROM reminders');
  await run('DELETE FROM messages');
}

async function updateMessageText(id, text) {
  await run('UPDATE messages SET text = ? WHERE id = ?', [text, id]);
}

module.exports = {
  initDatabase,
  saveMessage,
  saveReminder,
  listOpenReminders,
  listAllMessages,
  getDueReminders,
  markReminderNotified,
  clearDatabase,
  updateMessageText,
};
