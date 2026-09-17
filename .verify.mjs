import { spawn } from 'node:child_process';
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT=9377, url='https://icradp.github.io/qin-screwdriver/';
const ch=spawn(CHROME,['--headless=new','--user-data-dir='+process.cwd()+'/.chrome-profile',
  '--remote-debugging-port='+PORT,'--no-first-run','--enable-unsafe-swiftshader',
  '--use-angle=swiftshader','--no-sandbox','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let list=null;
for(let i=0;i<40;i++){const r=await fetch('http://127.0.0.1:'+PORT+'/json/list').catch(()=>null);
  if(r){list=await r.json();if(list.length)break;} await sleep(500);}
const page=list.find(t=>t.type==='page')||list[0];
const ws=new WebSocket(page.webSocketDebuggerUrl);let id=0;const pend=new Map();const errs=[];const reqs=[];
const send=(m,p)=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p||{}}));});
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);
 if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);return;}
 if(m.method==='Runtime.exceptionThrown')errs.push('EXC: '+(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text));
 if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')errs.push('LOG: '+m.params.entry.text);
 if(m.method==='Network.responseReceived'){const r=m.params.response; if(r.status>=400)errs.push('HTTP '+r.status+' '+r.url); if(/three/.test(r.url))reqs.push(r.status+' '+r.url.slice(0,64));}});
await new Promise(r=>ws.addEventListener('open',r));
await send('Runtime.enable');await send('Log.enable');await send('Page.enable');await send('Network.enable');
await send('Page.navigate',{url});
await sleep(22000);
const expr=`JSON.stringify({title:document.title,
 boot:document.getElementById('boot').classList.contains('hide'),
 fatal:getComputedStyle(document.getElementById('fatal')).display,
 canvas:(()=>{const c=document.getElementById('c');return c.width+'x'+c.height;})(),
 gl:(()=>{const c=document.getElementById('c');return !!(c.getContext('webgl2')||c.getContext('webgl'));})(),
 phase:document.getElementById('stName').textContent, count:document.getElementById('cnt').textContent,
 fps:document.getElementById('fps').textContent, bar:document.getElementById('bar').style.width,
 wp:document.getElementById('wp').textContent, screws:document.getElementById('sc').textContent})`;
const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});
console.log('LIVE PAGE >>>', r.result.value);
console.log('THREE.JS  >>>', reqs.length?reqs.join('\n              '):'(no three.js request seen)');
console.log('ERRORS    >>>', errs.length?errs.join('\n              '):'NONE');
ws.close();ch.kill('SIGKILL');process.exit(0);
