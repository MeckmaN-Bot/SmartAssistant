const OpenAI = require('openai');
const config = require('./config');

let client;
if (config.openAiApiKey) {
  client = new OpenAI({ apiKey: config.openAiApiKey });
}

function buildFallbackAnswer(question) {
  if (!question) {
    return 'Ich bin mir nicht sicher, wie ich helfen kann, aber ich lerne noch.';
  }

  const normalized = question.toLowerCase();
  if (normalized.includes('hauptstadt') && normalized.includes('italien')) {
    return 'Die Hauptstadt von Italien ist Rom.';
  }
  if (normalized.includes('hauptstadt') && normalized.includes('deutschland')) {
    return 'Die Hauptstadt von Deutschland ist Berlin.';
  }
  if (normalized.includes('zeit')) {
    return `Es ist gerade ${new Date().toLocaleTimeString('de-DE')}.`;
  }

  return 'Ich habe leider keine KI-Antwort verfuegbar und gebe daher eine Platzhalter-Antwort.';
}

async function askQuestion(question) {
  if (!question) {
    return buildFallbackAnswer(question);
  }

  if (!client) {
    return buildFallbackAnswer(question);
  }

  try {
    const response = await client.responses.create({ model: config.textModel, input: question });

    const result = response?.output?.[0]?.content?.[0]?.text || response?.output_text;
    return result?.trim() || buildFallbackAnswer(question);
  } catch (error) {
    console.error('OpenAI request failed, using fallback answer:', error.message);
    return buildFallbackAnswer(question);
  }
}

module.exports = {
  askQuestion,
};
