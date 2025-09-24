const fs = require('fs');
const os = require('os');
const path = require('path');
const OpenAI = require('openai');
const config = require('./config');

let client;
if (config.openAiApiKey) {
  client = new OpenAI({ apiKey: config.openAiApiKey });
}

async function transcribeAudio(buffer, filenameHint = 'audio.ogg') {
  if (!buffer) {
    return null;
  }

  if (!client) {
    console.warn('Kein OpenAI API-Schluessel gesetzt. Transkription wird uebersprungen.');
    return null;
  }

  const tempFile = path.join(os.tmpdir(), `${Date.now()}-${filenameHint}`);

  try {
    await fs.promises.writeFile(tempFile, buffer);
    const stream = fs.createReadStream(tempFile);

    const result = await client.audio.transcriptions.create({
      file: stream,
      model: config.whisperModel,
      response_format: 'text',
    });

    return typeof result === 'string' ? result.trim() : `${result}`.trim();
  } catch (error) {
    console.error('Transkription fehlgeschlagen:', error.message);
    return null;
  } finally {
    fs.promises.unlink(tempFile).catch(() => {});
  }
}

module.exports = {
  transcribeAudio,
};
