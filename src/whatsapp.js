const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  downloadContentFromMessage,
} = require('@adiwajshing/baileys');
const config = require('./config');

async function downloadMessageMedia(messageContent, messageType) {
  const stream = await downloadContentFromMessage(messageContent, messageType);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function startWhatsAppClient({ onMessage, onSocketReady } = {}) {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionFolder);
  const { version } = await fetchLatestBaileysVersion();

  const socket = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    browser: ['whatsapp-buttler', 'Chrome', '1.0.0'],
    logger: pino({ level: 'info' }),
  });

  if (typeof onSocketReady === 'function') {
    onSocketReady(socket);
  }

  socket.ev.on('messages.upsert', async (upsert) => {
    const { messages } = upsert;
    if (!messages || messages.length === 0) {
      return;
    }

    const message = messages[0];
    if (message.key.fromMe) {
      return;
    }

    if (typeof onMessage === 'function') {
      try {
        await onMessage(message, socket, downloadMessageMedia);
      } catch (error) {
        console.error('Fehler beim Verarbeiten einer Nachricht:', error);
      }
    }
  });

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.warn('[whatsapp] Verbindung geschlossen', statusCode, 'Reconnecting:', shouldReconnect);
      if (shouldReconnect) {
        startWhatsAppClient({ onMessage, onSocketReady }).catch((error) =>
          console.error('Reinitialisierung fehlgeschlagen', error)
        );
      }
    } else if (connection === 'open') {
      console.log('[whatsapp] Verbindung aufgebaut');
    }
  });

  return socket;
}

module.exports = {
  startWhatsAppClient,
};
