#!/usr/bin/env node
/**
 * Cyborg Supermarket - Unified Ecosystem Launcher
 * Starts Backend REST API, Admin Dashboard, Customer Web Storefront, and Python Voice AI.
 */

const { spawn } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const processes = [
  {
    name: 'Backend REST API',
    cmd: 'node',
    args: ['backend/src/standalone-server.js'],
    port: 3000,
    color: '\x1b[32m' // green
  },
  {
    name: 'Admin Dashboard',
    cmd: 'node',
    args: ['admin-dashboard/server.js'],
    port: 3001,
    color: '\x1b[36m' // cyan
  },
  {
    name: 'Customer Web Storefront',
    cmd: 'node',
    args: ['customer-website/server.js'],
    port: 3002,
    color: '\x1b[35m' // magenta
  }
];

// Check if Python Voice AI should be launched
if (process.argv.includes('--with-voice')) {
  const fs = require('fs');
  let pyCmd = 'python3';
  if (fs.existsSync('/home/mahmoud/miniconda3/bin/python3')) {
    pyCmd = '/home/mahmoud/miniconda3/bin/python3';
  } else if (fs.existsSync('/home/mahmoud/anaconda3/bin/python3')) {
    pyCmd = '/home/mahmoud/anaconda3/bin/python3';
  }

  processes.push({
    name: 'Python Voice AI Agent',
    cmd: pyCmd,
    args: ['features/VOICE/VOICE/app.py'],
    port: 5000,
    color: '\x1b[33m' // yellow
  });
}

console.log('\x1b[1m\x1b[34m================================================================');
console.log('⚡ CYBORG SUPERMARKET — LAUNCHING COMPLETE SYSTEM');
console.log('================================================================\x1b[0m\n');

const activeChildren = [];

processes.forEach(p => {
  console.log(`${p.color}[STARTING] ${p.name} on port ${p.port}...\x1b[0m`);
  const child = spawn(p.cmd, p.args, {
    cwd: ROOT_DIR,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(p.port) }
  });

  child.stdout.on('data', data => {
    process.stdout.write(`${p.color}[${p.name}] ${data.toString()}\x1b[0m`);
  });

  child.stderr.on('data', data => {
    process.stderr.write(`${p.color}[${p.name} ERROR] ${data.toString()}\x1b[0m`);
  });

  child.on('exit', code => {
    console.log(`${p.color}[${p.name}] Exited with code ${code}\x1b[0m`);
  });

  activeChildren.push(child);
});

console.log('\n\x1b[1m\x1b[32m✔ All services initialized!\x1b[0m');
console.log('  • Backend REST API:        \x1b[4mhttp://localhost:3000\x1b[0m (Health: /health, Docs: /api/v1/docs)');
console.log('  • Admin Operations HQ:     \x1b[4mhttp://localhost:3001\x1b[0m');
console.log('  • Customer Web Storefront: \x1b[4mhttp://localhost:3002\x1b[0m');
if (process.argv.includes('--with-voice')) {
  console.log('  • Python Voice AI Service: \x1b[4mhttp://localhost:5000\x1b[0m');
}
console.log('\nPress Ctrl+C to stop all services.\n');

function shutdown() {
  console.log('\n\x1b[33m[SHUTDOWN] Stopping all services gracefully...\x1b[0m');
  activeChildren.forEach(c => {
    try { c.kill('SIGTERM'); } catch (_) {}
  });
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
