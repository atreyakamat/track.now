const fs = require('fs');
const path = require('path');

const oldTables = ['profiles', 'tracks', 'plans', 'execution_items', 'item_schedules', 'item_completions'];
let violations = 0;

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
    } else if (/\.(ts|tsx)$/.test(f)) {
      const c = fs.readFileSync(full, 'utf8');
      const lines = c.split('\n');
      lines.forEach((l, i) => {
        for (const t of oldTables) {
          const regex = new RegExp(`from\\(['"]${t}['"]\\)`);
          if (regex.test(l)) {
            console.log(`VIOLATION: ${full}:${i + 1}: ${l.trim()}`);
            violations++;
          }
        }
      });
    }
  }
}

const targetDirs = ['apps/app/src', 'apps/landing/src'].filter((d) => fs.existsSync(d));
targetDirs.forEach((dir) => walk(dir));
if (violations === 0) {
  console.log('ALL CLEAR: Zero references to old table names in supabase.from() calls in workspaces.');
} else {
  console.error(`Found ${violations} violations!`);
  process.exit(1);
}
