import { chromium } from 'playwright';
const U='file:///home/claude/kbys/proto/flow.html';
const errs=[], fails=[];
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:1440,height:960},deviceScaleFactor:2});
p.on('pageerror',e=>errs.push(String(e)));
p.on('console',m=>{ if(m.type()==='error' && !/ERR_TUNNEL|fonts\.g/.test(m.text())) errs.push('console: '+m.text()); });
await p.goto(U); await p.waitForTimeout(900);

// the logo must never be redrawn: the mark is an image, never type
const drawn = await p.evaluate(()=>{
  const bad=[];
  document.querySelectorAll('.mark,.rpmark').forEach(e=>{ if(e.tagName!=='IMG') bad.push(e.className); });
  if(/>4<\/i>orm|<i>4<\/i>/.test(document.documentElement.innerHTML)) bad.push('wordmark rebuilt in markup');
  return bad;
});
if(drawn.length) fails.push('THE LOGO IS BEING RECREATED: '+drawn.join(', '));

await p.fill('#q','goliathventuresinc.com');
await p.click('#goBtn'); await p.waitForTimeout(2200);
await p.screenshot({path:'/tmp/p-ask1.png'});
if(await p.$('#chat[hidden]')) fails.push('the chat never opened');
/* Measure whether it is on screen, not whether an attribute is set. The
   attribute loses to a class display rule, which is how a "hidden" element
   stays visible while the code reads correctly. */
const stillUp = await p.evaluate(()=>['barForm','foot'].filter(id=>{
  const e=document.getElementById(id); if(!e) return false;
  return e.getBoundingClientRect().height > 0;
}));
if(stillUp.length) fails.push('hidden but still on screen: '+stillUp.join(', '));
const skip = await p.evaluate(()=>/skip/i.test(document.getElementById('chat').textContent));
if(skip) fails.push('the chat offers a skip');
const pick = async (label)=>{
  const b = p.locator('.pill', {hasText: label}).first();
  await b.waitFor({timeout:6000}); await b.click();
};
await pick('A vehicle'); await p.waitForTimeout(1400);
await p.screenshot({path:'/tmp/p-ask2.png'});
const ch = await p.evaluate(()=>/buying from/i.test(document.getElementById('chat').textContent));
if(!ch) fails.push('the vehicle follow-up did not appear');
await pick('A dealership'); await p.waitForTimeout(1400);
await pick('I already sent money'); await p.waitForTimeout(3600);
await p.screenshot({path:'/tmp/p-wait.png'});
await p.waitForTimeout(4200);
await p.screenshot({path:'/tmp/p-wait2.png'});

// jump to report and map
await p.click('.devbar button[data-go="rp"]'); await p.waitForTimeout(500);
const eb=await p.textContent('#rpEbT'); if(!eb || !eb.trim()) fails.push('the report verdict line is empty');
const tt=await p.textContent('#rpTonT'); if(!tt || !tt.trim()) fails.push('the report delivery card is empty');
await p.click('.rpsw button[data-s="SENT"]'); await p.waitForTimeout(250);
const t2=await p.textContent('#rpTonT'); if(!/bank/i.test(t2)) fails.push('already-sent plus an official finding does not lead with the bank');
const hidden=await p.getAttribute('#rpActA','hidden'); if(hidden!==null) fails.push('the bank control is hidden when it should be offered');
await p.click('.rpsw button[data-s="DILIGENCE"]'); await p.waitForTimeout(250);
const t3=await p.textContent('#rpTonT'); if(/tonight/i.test(t3)) fails.push('the homework case still says tonight');
const h3=await p.getAttribute('#rpActA','hidden'); if(h3===null) fails.push('the bank control is offered while somebody is doing homework');
await p.screenshot({path:'/tmp/p-rp-sent.png',fullPage:true});
await p.click('.rpsw button[data-s="BEFORE"]'); await p.waitForTimeout(250);
await p.screenshot({path:'/tmp/p-rp.png',fullPage:true});
await p.click('.devbar button[data-go="map"]'); await p.waitForTimeout(500);
await p.screenshot({path:'/tmp/p-map.png',fullPage:true});

for(const w of [1440,1280,900,620,390]){
  await p.setViewportSize({width:w,height:900});
  await p.waitForTimeout(220);
  const o=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  if(o>1) fails.push('sideways scroll at '+w+'px by '+o+'px');
}
if(errs.length) fails.push('errors: '+errs.slice(0,3).join(' | '));
await b.close();
console.log(fails.length?'FAILED':'PASSED');
fails.forEach(f=>console.log('  '+f));
