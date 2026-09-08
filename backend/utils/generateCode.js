// Generates short, human-readable, mostly-unique reference codes like
// INV-20260904-4821 or PO-20260904-0193. Good enough for a small/medium shop;
// swap for a DB sequence table if you need strict uniqueness guarantees.
function generateCode(prefix) {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${y}${m}${d}-${rand}`;
}

module.exports = generateCode;
