const chrono = require('chrono-node');
const database = require('./database');

function getChronoParser() {
  if (chrono.de) {
    return chrono.de.casual; // includes relative phrases like "morgen"
  }
  return chrono; // fallback to default english parser
}

function extractReminderDetails(text, referenceDate = new Date()) {
  if (!text) {
    return null;
  }

  const parser = getChronoParser();
  const results = parser.parse(text, referenceDate, { forwardDate: true });
  if (!results || results.length === 0) {
    return null;
  }

  const matched = results[0];
  const start = matched.start?.date();
  if (!start) {
    return null;
  }

  const matchedText = matched.text || '';
  let reminderText = text.replace(matchedText, '').trim();
  if (!reminderText) {
    reminderText = text.trim();
  }

  return {
    dueDate: start,
    reminderText,
  };
}

function serializeReminderPayload({ reminderText, chatId, senderName }) {
  return JSON.stringify({ reminderText, chatId, senderName });
}

function parseReminderPayload(payload = '') {
  try {
    const parsed = JSON.parse(payload);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (error) {
    // ignore parsing errors and fall back to plain text handling
  }
  return { reminderText: payload, chatId: null, senderName: null };
}

async function createReminder({ messageText, chatId, senderName }) {
  const details = extractReminderDetails(messageText);
  if (!details) {
    return null;
  }

  const dueDate = details.dueDate.toISOString();
  const payload = serializeReminderPayload({
    reminderText: details.reminderText,
    chatId,
    senderName,
  });

  const reminderId = await database.saveReminder({
    text: payload,
    dueDate,
  });

  return {
    id: reminderId,
    dueDate,
    reminderText: details.reminderText,
    chatId,
    senderName,
  };
}

async function listPendingReminders() {
  const rows = await database.listOpenReminders();
  return rows.map((row) => {
    const payload = parseReminderPayload(row.text);
    return {
      id: row.id,
      dueDate: row.due_date,
      notified: row.notified,
      reminderText: payload.reminderText || row.text,
      chatId: payload.chatId,
      senderName: payload.senderName,
    };
  });
}

async function getDueReminderPayloads(referenceDate = new Date()) {
  const rows = await database.getDueReminders(referenceDate);
  return rows.map((row) => {
    const payload = parseReminderPayload(row.text);
    return {
      id: row.id,
      dueDate: row.due_date,
      notified: row.notified,
      reminderText: payload.reminderText || row.text,
      chatId: payload.chatId,
      senderName: payload.senderName,
    };
  });
}

module.exports = {
  extractReminderDetails,
  createReminder,
  listPendingReminders,
  getDueReminderPayloads,
};
