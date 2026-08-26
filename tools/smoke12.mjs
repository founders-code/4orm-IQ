/* The console side of the expansion: routing, the graph, the chronology. */
import fs from 'fs'; import { JSDOM } from 'jsdom';
const P='/home/claude/kbys/build/4orm-iq/index.html';
const html=fs.readFileSync(P,'utf8');
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://4ormiq.com/?debug=1',
 beforeParse(w){ w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.scrollTo=()=>{}; w.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),0);
  w.addEventListener('error',e=>errs.push('window.error: '+(e.error?.stack||e.message)));}});
const {window}=dom, doc=window.document;
window.console.error=(...a)=>errs.push('console.error: '+a.join(' '));
window.Element.prototype.scrollTo=function(){};
await new Promise(r=>setTimeout(r,900));

console.log('board generated from the catalogue:', html.includes('GENERATED:SOURCES'));
console.log('no register count typed into the header:', !/Registers <b>\d+<\/b>/.test(html));
console.log('board size:', window.TOTAL_SOURCES ?? 'n/a');

window.__KBYS__.check('atlanticglobalwealth.com');
setTimeout(()=>doc.getElementById('waitOk').click(),300);
await new Promise(r=>setTimeout(r,6500));
const d=window.__KBYS__.current();
console.log('\nspecimen loaded:', !!d, '| verdict:', d && d.verdict);
console.log('header source count:', doc.getElementById('keySourcesN').textContent);
console.log('board caption:', doc.getElementById('boardSub').textContent.slice(0,60));

const rail=doc.getElementById('sbRight');
console.log('\nrail cards:', rail.children.length);
[...rail.children].forEach(c=>console.log('  '+c.querySelector('.n').textContent+' = '+c.querySelector('.v').textContent));

const gi=[...rail.children].findIndex(c=>/Operator graph/i.test(c.querySelector('.n').textContent));
rail.children[gi].click(); await new Promise(r=>setTimeout(r,60));
let b=doc.getElementById('infoBody').textContent;
console.log('\noperator graph modal:');
['A shared identifier is a fact','Seen before, on something a regulator warned about',
 'independent connection','we found and did not count','never proves who owns an address']
 .forEach(t=>console.log((b.includes(t)?'  found  ':'  MISSING')+'  '+t));
console.log('  cloudflare not counted:', /ns1\.cloudflare\.com/.test(b) && b.indexOf('Not counted')>-1);
// every mention of a shared operator must be a denial, never an assertion
const claims=[...b.matchAll(/[^.]*\b(run by the same|same operator|operated by the same)\b[^.]*\./g)].map(m=>m[0].trim());
const affirmative=claims.filter(c=>!/\bnot\b|\bnever\b|\bnothing\b|\bno one\b/i.test(c));
console.log('  mentions of a shared operator:', claims.length, '| affirmative claims:', affirmative.length);
affirmative.forEach(c=>console.log('    AFFIRMATIVE: '+c.slice(0,120)));
doc.getElementById('infoClose').click(); await new Promise(r=>setTimeout(r,30));

// check 10 opens the chronology
const tiles=doc.querySelectorAll('#tiles .tile');
tiles[9].click(); await new Promise(r=>setTimeout(r,60));
b=doc.getElementById('infoBody').innerHTML;
console.log('\ncheck 10 offers the comparison:', b.includes('openChrono'));
doc.getElementById('openChrono').click(); await new Promise(r=>setTimeout(r,60));
b=doc.getElementById('infoBody').textContent;
console.log('chronology modal:');
['The test is not whether the claim is older than the domain','Dated claims they make',
 'What the records carry','requires explanation']
 .forEach(t=>console.log((b.includes(t)?'  found  ':'  MISSING')+'  '+t));
console.log('  never says they lied:', !/\blied\b|\bliar\b|did not exist\b/i.test(b));
doc.getElementById('infoClose').click(); await new Promise(r=>setTimeout(r,30));

// check 9 offers the graph
tiles[8].click(); await new Promise(r=>setTimeout(r,60));
console.log('\ncheck 9 offers the graph:', doc.getElementById('infoBody').innerHTML.includes('openGraph'));
doc.getElementById('infoClose').click();

const audit=window.__KBYS__.buildAudit(d);
const ab=doc.getElementById('arBody').textContent;
console.log('\naudit carries the graph:', ab.includes('The operator graph'));
console.log('audit carries the chronology:', ab.includes('against what the records carry'));
console.log('audit keeps the fact/conclusion line:', ab.includes('A shared identifier is a fact'));

console.log('\n--- errors: '+errs.length+' ---'); errs.forEach(e=>console.log('  '+e.slice(0,200)));
dom.window.close(); process.exit(0);
