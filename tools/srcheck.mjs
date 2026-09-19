/* ===================== WHAT THE REGISTER CLEARS, AGAINST WHAT WE ASK

   SR-001 is the signed workbook. A register reaches a reader through it, and
   nothing else. The catalogue is what the engine holds. These two drift the
   moment a register is added in code, and the drift is silent: the run still
   asks the register, and every row in the operations log quietly counts it as
   out of scope. Nobody reads a column called sources_out_of_scope on a good
   day.

   So it is printed here, by name. This never fails a build. A register waiting
   on a signature is not a defect in the code and blocking a deploy on it would
   only teach somebody to sign without reading, which is the opposite of what
   the workbook is for. */
import { CATALOGUE, PENDING, TOTAL_SOURCES } from '../api/_catalogue.js';
import fs from 'fs';

const M = JSON.parse(fs.readFileSync(new URL('../api/_sr001.json', import.meta.url), 'utf8'));
const cleared = new Set(M.enabled || []);
const asked = CATALOGUE.filter(s => s.enabled);
const notCleared = asked.filter(s => !cleared.has(s.display_name));
const clearedNotHeld = [...cleared].filter(n => !CATALOGUE.some(s => s.display_name === n));

console.log('\nTHE WORKBOOK AGAINST THE CATALOGUE\n');
console.log('  SR-001 generated        ' + M.generated);
console.log('  names it clears         ' + cleared.size);
console.log('  registers we ask        ' + TOTAL_SOURCES);
console.log('  asked, not on SR-001    ' + notCleared.length
  + (notCleared.length ? '   counted out of scope on every run' : ''));
console.log('  on SR-001, not held     ' + clearedNotHeld.length
  + '   names the workbook clears that the catalogue has no row for');
console.log('  waiting on a signature  ' + PENDING.length + '   published, asked by nothing');

if (notCleared.length) {
  console.log('\n  Asked on every applicable run and not cleared by the workbook:');
  const byCat = {};
  notCleared.forEach(s => (byCat[s.category] = byCat[s.category] || []).push(s.display_name));
  Object.keys(byCat).sort().forEach(c => {
    console.log('    ' + c);
    byCat[c].forEach(n => console.log('      ' + n));
  });
  console.log('\n  These are not blocked: the run asks them and the log records them as out of');
  console.log('  scope. What they need is a revision of the workbook, which is a signature');
  console.log('  and not a commit.\n');
} else {
  console.log('\n  Every register the engine asks is cleared by the workbook.\n');
}
