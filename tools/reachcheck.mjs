/* ===================================================== CAN WE ACTUALLY ASK IT
   The board read nought of a hundred and twenty one registers reached on a
   finished run. Half the reason was a counter that only wrote the registers it
   had already lit. The other half was this: the host map was hand written, the
   catalogue already carried every register's host, and the two had drifted. Ten
   enabled registers, among them ACRA, both MAS registers, the Hong Kong and
   New Zealand company offices, NMLS, RECO, FSRA and the Quebec registraire,
   sat in the catalogue with a real domain and in no line of the map. A page
   from any of them came back and lit nothing. They could never be counted as
   reached however well the sweep ran, and nothing said so.

   A register we publish and cannot ask is worse than one we never listed: the
   catalogue is the promise, and the board counts against it. So every enabled
   register has to be one of three things, and has to say which:

     reachable   a host maps to it, so a page from it lights it
     unmapped    fetchable in principle, not mapped yet, with the reason
                 written down and a name on it

   Connectors are not in this check at all. A connector is something we run over
   what the run already holds rather than a place we send a question, so it
   cannot be unreachable and it does not belong in a coverage denominator. It
   was in both, and that is what made a category error read as a thirteen point
   coverage hole.

   Anything else fails this check.                                            */
import { unreachableRegisters } from '../api/_registers.js';
import { CATALOGUE, ASKABLE, COMPUTED } from '../api/_catalogue.js';

const by = Object.fromEntries(CATALOGUE.map(s => [s.display_name, s]));
const un = unreachableRegisters();
const unmapped = un.filter(x => by[x.display_name] && by[x.display_name].unmapped);
const silent   = un.filter(x => !(by[x.display_name] && by[x.display_name].unmapped));
const reach    = ASKABLE.length - un.length;

console.log('\nCAN WE ACTUALLY ASK IT\n');
console.log('  registers we ask       ' + String(ASKABLE.length).padStart(4));
console.log('  a host maps to it      ' + String(reach).padStart(4)
  + '   ' + Math.round(100 * reach / ASKABLE.length) + ' per cent of them');
console.log('  fetchable, not mapped  ' + String(unmapped.length).padStart(4));
console.log('');
console.log('  checks we compute      ' + String(COMPUTED.length).padStart(4)
  + '   counted apart, because a connector is not a register');

if (unmapped.length) {
  console.log('\n  Declared gaps. Each one is a register we publish and cannot ask:');
  unmapped.forEach(x => {
    console.log('    ' + x.display_name);
    console.log('      ' + by[x.display_name].unmapped);
  });
}

if (silent.length) {
  console.log('\nFAILED');
  silent.forEach(x => console.log('  ' + (x.domain ? x.domain + '  ' : '') + x.display_name
    + '  is in the catalogue and no host can ever light it, and it does not say why'));
  console.log('\nEither map a host to it, mark it derived if it is computed rather than');
  console.log('fetched, or declare it unmapped with the reason written beside it. A');
  console.log('register we publish and cannot ask is a promise the board counts against.\n');
  process.exit(1);
}

/* The coverage ceiling is a real number and it should be said out loud rather
   than discovered from a gauge. */
const ceiling = Math.round(100 * reach / ASKABLE.length);
console.log('\n  The most this product can report reached is ' + ceiling + ' per cent of the'
  + '\n  registers it asks, because ' + unmapped.length + ' of them are still one row'
  + '\n  standing for a class of bodies with no single host.\n');
console.log('PASSED  every register we publish is either askable or says why not\n');
