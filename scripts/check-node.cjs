// Runs before npm scripts. Written in old-style JS so it works on any Node version
// and prints a clear message instead of "node: bad option".
var required = [22, 12];
var parts = process.versions.node.split('.').map(Number);
if (parts[0] < required[0] || (parts[0] === required[0] && parts[1] < required[1])) {
  console.error('\n  emQube PMS needs Node.js ' + required.join('.') + ' or newer (you have ' + process.version + ').');
  console.error('  Run:  nvm use 24.15.0   (then check with: node -v)\n');
  process.exit(1);
}
