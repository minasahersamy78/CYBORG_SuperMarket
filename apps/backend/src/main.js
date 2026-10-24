const { start } = require('./standalone-server');

const PORT = process.env.APP_PORT || 3000;
start(PORT);
