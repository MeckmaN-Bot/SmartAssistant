const express = require('express');
const config = require('./config');

function startHttpServer() {
  const app = express();

  app.get('/ping', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const server = app.listen(config.port, () => {
    console.log(`[server] Express server laeuft auf Port ${config.port}`);
  });

  return server;
}

module.exports = {
  startHttpServer,
};
