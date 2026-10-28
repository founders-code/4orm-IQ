import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const errs=[]; const pg=await (await b.newContext({deviceScaleFactor:2})).newPage();
pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
pg.on('console',m=>{if(m.type()==='error'&&!/api\/stats|ERR_|CORS|Failed to load/.test(m.text()))errs.push(m.text());});
async function run(file,q){
  await pg.goto('file://'+file);
  await pg.setViewportSize({width:1440,height:1050}); await pg.waitForTimeout(400);
  await pg.fill('#kbInput',q); await pg.click('#kbGo');
  for(let i=0;i<18;i++){ if(await pg.evaluate(()=>document.body.dataset.stage)==='report') break;
    const n=await pg.$('#eduNext'); if(n){try{await n.click({timeout:250});}catch(e){}}
    const k=await pg.$('#waitOk'); if(k){try{await k.click({timeout:250});}catch(e){}}
    await pg.waitForTimeout(450); }
  await pg.waitForFunction(()=>document.body.dataset.stage==='report',{timeout:20000});
  await pg.waitForTimeout(800);
}
const grab=()=>pg.evaluate(()=>({
  door:document.getElementById('rpAlreadyT').textContent,
  doorX:document.getElementById('rpAlreadyX').textContent.slice(0,60),
  tone:document.getElementById('rpAlready').getAttribute('data-c'),
  twoWays:getComputedStyle(document.getElementById('rpTwoWays')).display!=='none'}));
await run('/tmp/idx-sk.html','shakepay.com');
console.log('REGISTERED  ', JSON.stringify(await grab(),null,1));
await pg.click('#rpAlreadyBtn'); await pg.waitForTimeout(800);
console.log('  behind it :', await pg.evaluate(()=>document.getElementById('rpClockT').textContent));
console.log('  windows   :', await pg.evaluate(()=>getComputedStyle(document.getElementById('rpWindows')).display));
await pg.evaluate(()=>document.getElementById('rpTwoWays').scrollIntoView());
await pg.waitForTimeout(600);
await pg.screenshot({path:'/tmp/tw1.png',clip:{x:0,y:0,width:1440,height:900}});
await pg.evaluate(()=>window.scrollTo(0,0)); await pg.waitForTimeout(400);
await pg.screenshot({path:'/tmp/tw0.png',clip:{x:0,y:0,width:1440,height:1050}});

await run('/home/claude/kbys/build/4orm-iq/index.html','investhelm.com');
console.log('FRAUD       ', JSON.stringify(await grab(),null,1));
await pg.click('#rpToSources'); await pg.waitForTimeout(500);
console.log('sources rows:', await pg.evaluate(()=>document.querySelectorAll('#rpWhySoft .rp-row').length));
await pg.evaluate(()=>document.getElementById('rpWhySoft').scrollIntoView());
await pg.waitForTimeout(500);
await pg.screenshot({path:'/tmp/tw2.png',clip:{x:0,y:0,width:1440,height:1000}});
console.log('ERRORS',errs.length,errs.slice(0,3));
await b.close();
