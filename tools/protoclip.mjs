/* OUT OF SERVICE. This drives a prototype that is not in this repo:
   /home/claude/kbys/proto/flow.html, on one machine. It is kept because
   whoever still has that prototype can still run it, and deleting a check
   is how coverage disappears quietly. It is NOT in npm test: it was, and a
   hard exit there meant npm test could not pass on a clean clone. Point it
   at a page in this repo or retire it; do not leave it skipping silently. */
import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:1440,height:960}});
await p.goto('file:///home/claude/kbys/proto/flow.html');
await p.waitForTimeout(700);
await p.click('.devbar button[data-go="wait"]'); await p.waitForTimeout(900);
const out=await p.evaluate(()=>{
  const svg=document.getElementById('svg');
  const vb=svg.viewBox.baseVal;
  const bad=[];
  svg.querySelectorAll('text.nlab').forEach(t=>{
    const bb=t.getBBox();
    if(bb.x<vb.x-1||bb.y<vb.y-1||bb.x+bb.width>vb.x+vb.width+1||bb.y+bb.height>vb.y+vb.height+1)
      bad.push(t.textContent);
  });
  return {vb:[vb.x,vb.y,vb.width,vb.height], bad, n:svg.querySelectorAll('text.nlab').length};
});
console.log('labels:',out.n,'viewBox:',out.vb.join(' '));
console.log(out.bad.length? 'CLIPPED: '+out.bad.join(', ') : 'no label leaves the viewBox');
await b.close();
process.exit(out.bad.length?1:0);
