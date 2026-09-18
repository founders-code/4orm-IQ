/* THE HOUSE LANGUAGE PASS.
   Reads every word a consumer can actually see on the page: the markup with
   script and style removed, plus every string literal the script writes into
   the page. Reports what the house standard forbids. This is a reading tool,
   not a gate; verify.mjs holds the gates. */
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const markup = html
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&middot;/g, '.')
  .replace(/\s+/g, ' ');

const script = (html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || []).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');
/* Only strings long enough to be a sentence a reader sees. */
const strings = (script.match(/"[^"\\\n]{18,}"|'[^'\\\n]{18,}'/g) || [])
  .map(s => s.slice(1, -1))
  .filter(s => !/^[a-z-]+$/.test(s) && !/[{}<>]=|function|var |querySelector/.test(s))
  .filter(s => / [a-z]/.test(s));

const corpus = markup + '\n' + strings.join('\n');

const BAD = [
  [/[—–]/g, 'an em dash or en dash'],
  [/\bA\.?I\.?\b(?! )/g, 'a reference to AI'],
  [/\bartificial intelligence\b/gi, 'a reference to AI'],
  [/\bthe problem\b/gi, 'say the challenge'],
  [/\breally\b/gi, 'banned word'],
  [/\bclearly\b/gi, 'banned word'],
  [/\bquietly\b/gi, 'banned word'],
  [/\bsubstantially\b/gi, 'banned word'],
  [/\bgenuinely\b/gi, 'banned word'],
  [/\bhonestly\b/gi, 'banned word'],
  [/\bstraightforward\b/gi, 'banned word'],
  [/\bdelve\b/gi, 'banned word'],
  [/\bleverage\b/gi, 'banned word'],
  [/\brobust\b/gi, 'banned word'],
  [/\bseamless\w*\b/gi, 'banned word'],
  [/\bcrucial\b/gi, 'banned word'],
  [/\bvital\b/gi, 'banned word'],
  [/\bpivotal\b/gi, 'banned word'],
  [/\bcomprehensive\b/gi, 'banned word'],
  [/\bholistic\b/gi, 'banned word'],
  [/\bunderscore\b/gi, 'banned word'],
  [/\btestament\b/gi, 'banned word'],
  [/\bcutting edge\b/gi, 'banned word'],
  [/\bindustry leading\b/gi, 'banned word'],
  [/\bgame changer\b/gi, 'banned phrase'],
  [/\bnot just\b/gi, 'banned construction'],
  [/\bin today's\b/gi, 'banned construction'],
  [/\bin an era of\b/gi, 'banned construction'],
  [/\brapidly evolving\b/gi, 'banned construction'],
  [/\bwhen it comes to\b/gi, 'banned construction'],
  [/\bplays a key role\b/gi, 'banned construction'],
  [/\bat the end of the day\b/gi, 'banned construction'],
  [/\blet's dive in\b/gi, 'banned construction'],
  [/\bin conclusion\b/gi, 'banned construction'],
  [/(^|[.!?]\s)(Moreover|Furthermore|Additionally|Notably),/g, 'a banned sentence opener'],
];

let n = 0;
for (const [re, why] of BAD) {
  const hits = corpus.match(re);
  if (!hits) continue;
  n += hits.length;
  const uniq = [...new Set(hits.map(h => String(h).trim()))].slice(0, 6);
  console.log('  ' + why + ' x' + hits.length + '  ' + uniq.join(' | '));
}

/* Sentence length, on the markup only: that is the prose a reader meets. */
const sents = markup.split(/(?<=[.!?])\s+/).filter(s => /[a-z]{4}/.test(s) && s.length > 12);
const long = sents.filter(s => s.trim().split(/\s+/).length > 28);
console.log('\n  sentences ' + sents.length + ', over 28 words ' + long.length);
for (const s of long.slice(0, 12)) console.log('    ' + s.trim().slice(0, 150));

console.log('\n' + (n ? 'house language: ' + n + ' to look at' : 'house language: clean'));
