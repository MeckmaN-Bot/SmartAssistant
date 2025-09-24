const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const projectRoot = path.join(__dirname, '..');
const defaultDbPath = path.join(projectRoot, 'data', 'storage.sqlite');
const defaultSessionFolder = path.join(projectRoot, 'baileys_auth');

if (!fs.existsSync(defaultSessionFolder)) {
  fs.mkdirSync(defaultSessionFolder, { recursive: true });
}

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  dbPath: process.env.DB_PATH || defaultDbPath,
  sessionFolder: process.env.SESSION_FOLDER || defaultSessionFolder,
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  whisperModel: process.env.WHISPER_MODEL || 'whisper-1',
  textModel: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
  allowedGroupName: (process.env.ALLOWED_GROUP_NAME || 'SmartAssistant').trim(),
  reminderCheckCron: process.env.REMINDER_CRON || '*/1 * * * *',
};
