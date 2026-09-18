import { chromium } from 'playwright';
const d = { verdict:'GREY', headline:'', statement:'A record was found.', idc:30, cov:40,
  asOf:'18 Sep 2026', reads:[], stats:[], bars:[], barFoot:'', claims:[], issues:[], gaps:[],
  unresolved:[], reviews:{checked:3,carrying:0,reports:0,state:'organic',note:'',rows:[]},
  ledger:[], retrieved:[], board:{}, live:false,
  name:'ACET (AMBIGUOUS IDENTIFIER)', domain:'',
  cats:{ C7:{ state:'RED', sum:'Reports across platforms', ev:[
    {t:'C',src:'Trustpilot',when:'18 Sep 2026',match:'unconnected',about:'an engineering firm of the same initials',find:'Reviews describe a late delivery.'},
    {t:'D',src:'Reddit',when:'18 Sep 2026',match:'unconnected',about:'a college association of the same initials',find:'Threads describe a dispute.'},
    {t:'C',src:'Sitejabber',when:'18 Sep 2026',match:'unconnected',about:'a shopfront of the same initials',find:'Reviews describe a refund refused.'}]}}
};
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:1280,height:1000}, deviceScaleFactor:2 });
await p.goto('file:///home/claude/kbys/build/4orm-iq/index.html?demo=1&debug=1');
await p.waitForTimeout(900);
await p.screenshot({ path:'/home/claude/out/shot-landing.png', clip:{x:0,y:120,width:1280,height:560} });
await p.evaluate(x => { window.__KBYS__.runCtx({stage:'BEFORE'}); window.__KBYS__.enter(x,''); }, d);
await p.waitForTimeout(700);
const box = await p.evaluate(() => {
  const a = document.getElementById('rpAsk');
  a.scrollIntoView({block:'center'});
  return new Promise(r => setTimeout(() => { const b = a.getBoundingClientRect();
    r({x:Math.max(0,b.x-40), y:Math.max(0,b.y-120), w:Math.min(1280,b.width+520), h:b.height+260}); }, 400));
});
await p.screenshot({ path:'/home/claude/out/shot-ask.png', clip:{x:box.x,y:box.y,width:box.w,height:box.h} });
await b.close();
console.log('shots written');
