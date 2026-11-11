'use strict';
// Reads keys from the environment or the local .env file (never committed).
const fs = require('fs');
const path = require('path');

let cache = null;
function fileVars() {
  if (cache) return cache;
  cache = {};
  try {
    const txt = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && m[2]) cache[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  } catch { /* no .env */ }
  return cache;
}

function env(name, fallback = null) {
  const v = process.env[name] || fileVars()[name];
  return v ? v.trim() : fallback;
}

module.exports = { env };
