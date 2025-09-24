const cron = require('node-cron');
const config = require('./config');
const database = require('./database');
const { startHttpServer } = require('./server');
const { startWhatsAppClient } = require('./whatsapp');
const { transcribeAudio } = require('./speech');
const { askQuestion } = require('./ai');
const {
  createReminder,
  listPendingReminders,
  getDueReminderPayloads,
} = require('./reminders');

let activeSocket = null;
const groupNameCache = new Map();

function setActiveSocket(socket) {
  activeSocket = socket;
}

function getTimestampMs(message) {
  const ts = message.messageTimestamp;
  if (!ts) {
    return Date.now();
  }
  if (typeof ts === 'object' && typeof ts.toNumber === 'function') {
    return ts.toNumber() * 1000;
  }
  const numericTs = Number(ts);
  if (!Number.isFinite(numericTs)) {
    return Date.now();
  }
  return numericTs * 1000;
}

function extractTextFromMessage(messageContent) {
  if (messageContent.conversation) {
    return messageContent.conversation;
  }
  if (messageContent.extendedTextMessage?.text) {
    return messageContent.extendedTextMessage.text;
  }
  if (messageContent.ephemeralMessage?.message) {
    return extractTextFromMessage(messageContent.ephemeralMessage.message);
  }
  return '';
}

function isQuestion(text) {
  if (!text) {
    return false;
  }
  const normalized = text.trim().toLowerCase();
  return normalized.includes('?') || normalized.startsWith('was ') || normalized.startsWith('wie ');
}

function normalizeGroupName(name = '') {
  return name.trim();
}

async function resolveGroupName(chatId, socket) {
  if (!chatId?.endsWith('@g.us') || !socket) {
    return '';
  }

  if (groupNameCache.has(chatId)) {
    return groupNameCache.get(chatId);
  }

  try {
    const metadata = await socket.groupMetadata(chatId);
    const subject = metadata?.subject || '';
    groupNameCache.set(chatId, subject);
    return subject;
  } catch (error) {
    console.error('Konnte Gruppeninformationen nicht laden:', error.message);
    groupNameCache.set(chatId, '');
    return '';
  }
}

async function isAllowedChat(chatId, socket) {
  const allowedGroupName = normalizeGroupName(config.allowedGroupName);
  if (!allowedGroupName || !chatId) {
    return false;
  }

  if (!chatId.endsWith('@g.us')) {
    return false;
  }

  const groupName = normalizeGroupName(await resolveGroupName(chatId, socket));
  return groupName === allowedGroupName;
}

async function handleCommand(chatId, text, socket) {
  const normalized = text.trim().toLowerCase();
  if (normalized === '/list') {
    const reminders = await listPendingReminders();
    if (reminders.length === 0) {
      await socket.sendMessage(chatId, { text: 'Es sind keine Erinnerungen offen.' });
      return true;
    }

    const lines = reminders.map((reminder) => {
      const due = new Date(reminder.dueDate);
      const formatted = due.toLocaleString('de-DE');
      return `#${reminder.id} - ${reminder.reminderText} (faellig am ${formatted})`;
    });

    await socket.sendMessage(chatId, { text: lines.join('\n') });
    return true;
  }

  if (normalized === '/clear') {
    await database.clearDatabase();
    await socket.sendMessage(chatId, { text: 'Alle Nachrichten und Erinnerungen wurden geloescht.' });
    return true;
  }

  return false;
}

async function tryCreateReminder({ messageText, chatId, senderName }, socket) {
  const reminder = await createReminder({ messageText, chatId, senderName });
  if (!reminder) {
    return null;
  }

  const dueDate = new Date(reminder.dueDate).toLocaleString('de-DE');
  const response = senderName
    ? `Okay ${senderName}, ich erinnere dich an "${reminder.reminderText}" am ${dueDate}.`
    : `Erinnerung gespeichert: "${reminder.reminderText}" am ${dueDate}.`;

  await socket.sendMessage(chatId, { text: response });
  return reminder;
}

async function handleIncomingMessage(message, socket, downloadMedia) {
  const messageContent = message.message || {};
  const messageType = Object.keys(messageContent)[0];
  const chatId = message.key?.remoteJid;
  const senderName = message.pushName || 'Unbekannt';
  const timestampMs = getTimestampMs(message);

  if (!messageType || !chatId) {
    return;
  }

  const allowed = await isAllowedChat(chatId, socket);
  if (!allowed) {
    return;
  }

  let storedText = '';
  let storedType = messageType;

  if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
    storedText = extractTextFromMessage(messageContent);
    storedType = 'text';
  } else if (messageType === 'audioMessage') {
    storedText = '[Sprachnachricht]';
    storedType = 'audio';
  }

  const messageId = await database.saveMessage({
    sender: chatId,
    text: storedText,
    timestamp: timestampMs,
    type: storedType,
  });

  if (messageType === 'audioMessage') {
    const audio = messageContent.audioMessage;
    try {
      const buffer = await downloadMedia(audio, 'audioMessage');
      const filename = `voice-${messageId}.ogg`;
      const transcription = await transcribeAudio(buffer, filename);
      if (transcription) {
        await database.updateMessageText(messageId, transcription);
        await socket.sendMessage(chatId, { text: `Transkription: ${transcription}` });
        await tryCreateReminder({ messageText: transcription, chatId, senderName }, socket);
        if (isQuestion(transcription)) {
          const answer = await askQuestion(transcription);
          await socket.sendMessage(chatId, { text: answer });
        }
      }
    } catch (error) {
      console.error('Fehler beim Verarbeiten der Sprachnachricht:', error.message);
    }
    return;
  }

  if (!storedText) {
    return;
  }

  const commandHandled = await handleCommand(chatId, storedText, socket);
  if (commandHandled) {
    return;
  }

  await tryCreateReminder({ messageText: storedText, chatId, senderName }, socket);

  if (isQuestion(storedText)) {
    const answer = await askQuestion(storedText);
    await socket.sendMessage(chatId, { text: answer });
  }
}

function scheduleReminderDispatcher() {
  cron.schedule(config.reminderCheckCron, async () => {
    if (!activeSocket) {
      return;
    }

    try {
      const dueReminders = await getDueReminderPayloads(new Date());
      for (const reminder of dueReminders) {
        if (!reminder.chatId) {
          console.warn('Kann Erinnerung nicht senden, Chat-ID fehlt:', reminder.id);
          await database.markReminderNotified(reminder.id);
          continue;
        }

        const allowed = await isAllowedChat(reminder.chatId, activeSocket);
        if (!allowed) {
          console.warn('Erinnerung ignoriert, Gruppe nicht freigegeben:', reminder.id);
          await database.markReminderNotified(reminder.id);
          continue;
        }

        const message = `Erinnerung: ${reminder.reminderText} (faellig jetzt)`;
        await activeSocket.sendMessage(reminder.chatId, { text: message });
        await database.markReminderNotified(reminder.id);
      }
    } catch (error) {
      console.error('Fehler beim Pruefen der Erinnerungen:', error.message);
    }
  });
}

async function bootstrap() {
  await database.initDatabase();
  startHttpServer();
  scheduleReminderDispatcher();

  await startWhatsAppClient({
    onMessage: handleIncomingMessage,
    onSocketReady: setActiveSocket,
  });
}

bootstrap().catch((error) => {
  console.error('Fataler Fehler beim Start des Bots:', error);
  process.exit(1);
});
