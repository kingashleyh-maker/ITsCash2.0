// Optional Windows Edge smoke check. No npm dependencies required (Node 22+).
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const serverPort=8874,debugPort=9374;
const profile=await mkdtemp(path.join(tmpdir(),'itscash-qa-'));
const server=spawn('python',['-m','http.server',String(serverPort),'--bind','127.0.0.1','--directory',path.dirname(root)],{windowsHide:true,stdio:'ignore'});
const browser=spawn(process.env.EDGE_PATH||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--inprivate','--disable-extensions','--disable-features=msImplicitSignin,msEdgeSyncService',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;const errors=[],failures=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try{
 let targets;for(let i=0;i<100;i++){try{targets=await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();break;}catch{await delay(100);}}
 if(!targets)throw Error('Edge debugging endpoint did not start.');
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);else if(m.method==='Network.loadingFailed')failures.push(m.params.errorText);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout: '+method+' '+JSON.stringify(params).slice(0,200)));},10000);pending.set(n,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id:n,method,params}));});
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const wait=async expression=>{for(let i=0;i<100;i++){try{if(await evaluate(expression))return;}catch{}await delay(50);}throw Error(`Timed out: ${expression}`);};
 const base=`http://127.0.0.1:${serverPort}/ITsCashVanilla/`;
 const nav=async route=>{await send('Page.navigate',{url:base+route});await wait('document.readyState === "complete" && document.querySelector(".login-shell,.auth-card,#page-content")');await delay(100);assert.equal(await evaluate('!!document.querySelector(".inline-error")'),false);};
 const click=async text=>{await evaluate(`(()=>{const el=[...document.querySelectorAll('button,a')].find(x=>x.textContent.trim()===${JSON.stringify(text)});if(!el)throw Error('Missing control: '+${JSON.stringify(text)});el.click();})()`);await delay(100);};
 const fill=async values=>{await evaluate(`(()=>{for(const [name,value] of Object.entries(${JSON.stringify(values)})){const el=document.querySelector('dialog[open] [name="'+name+'"]')||document.querySelector('[name="'+name+'"]');if(!el)throw Error('Missing input '+name);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));}})()`);};
 const submit=async()=>{await evaluate('(document.querySelector("dialog[open] form")||document.querySelector("form")).requestSubmit()');await delay(200);};
 const login=async r=>{await nav(`${r}/pages/login.html`);if(await evaluate('!!document.querySelector("#page-content")')){await evaluate('sessionStorage.removeItem("itscash_vanilla_actor")');await nav(`${r}/pages/login.html`);}await fill({username:r,password:r[0].toUpperCase()+r.slice(1)+'123!'});await submit();await wait('!!document.querySelector("#page-content")');};
 await nav('index.html');assert.equal(await evaluate('document.querySelectorAll(".role-card").length'),3);console.log('PASS role selection and subfolder paths');
 await nav('student/pages/store.html');
 for(const width of [1440,1024,768,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await delay(100);
  assert.equal(await evaluate('(()=>{const card=document.querySelector(".catalog-sidebar").getBoundingClientRect();return [...document.querySelectorAll(".catalog-sidebar select")].every(el=>{const r=el.getBoundingClientRect();return r.left>=card.left&&r.right<=card.right;});})()'),true,`Sidebar dropdown overflow at ${width}px`);
 }
 console.log('PASS catalog sidebar dropdowns stay inside their card at desktop, tablet, and mobile widths');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await login('proware');await click('Edit stock & price');await fill({'stock-M':'12','stock-Unassigned':'0',price:'720.00'});
 // Native confirmation dialogs are accepted through CDP for the test.
 await evaluate('window.confirm=()=>true');await submit();assert.equal(await evaluate('document.querySelectorAll("dialog[open]").length'),0);console.log('PASS Proware sign-in and stock update');
 await login('student');await nav('student/pages/store.html');await evaluate('document.querySelector(".product-bottom button").click()');await fill({size:'M',qty:'2'});await submit();assert.equal(await evaluate('document.querySelector(".store-cart-link .cart-count").textContent'),'2');await evaluate('document.querySelector(".store-cart-link").click()');await wait('location.pathname.endsWith("cart.html") && !!document.querySelector(".cart-item")');assert.ok((await evaluate('document.body.innerText')).includes('1,440.00'));
 await click('Checkout ticket');await evaluate('window.confirm=()=>true');await submit();await wait('location.pathname.endsWith("orders.html") && !!document.querySelector("#page-content")');assert.ok((await evaluate('document.body.innerText')).includes('Awaiting Payment'));console.log('PASS Student catalog, size selection, cart, checkout, orders');
 await login('cashier');await nav('cashier/pages/tickets.html');await click('Open ticket');await click('Acknowledge ticket');await fill({note:'Browser smoke check'});await submit();await click('Record payment');await fill({received:'1500'});await submit();await click('View receipt');await wait('!!document.querySelector(".receipt-qr[src]")');assert.ok((await evaluate('document.querySelector("dialog").innerText')).includes('60.00'));await evaluate('document.querySelector("dialog[open] .dialog-head button").click()');console.log('PASS Cashier acknowledgment, notes, cash payment, change and QR receipt');
 await nav('cashier/pages/tuition.html');await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Add assessment")).click()');const studentId=await evaluate('[...document.querySelector("[name=studentId]").options].find(o=>o.value).value');await fill({studentId,tuition:'1000',misc:'100',plan:'Installment',dueDate:'2026-11-30'});await submit();assert.ok((await evaluate('document.body.innerText')).includes('1,100.00'));console.log('PASS tuition assessment creation');
 await login('proware');await nav('proware/pages/orders.html');await evaluate('window.confirm=()=>true');await click('Ready for Pickup');await click('Mark Claimed');assert.ok((await evaluate('document.body.innerText')).includes('Claimed'));console.log('PASS paid pickup preparation and handover');
 await login('student');await nav('student/pages/tuition.html');await click('Pay / cashier ticket');await fill({method:'GCash',option:'Installment',amount:'100',reference:'BROWSER-QA-001'});await submit();await click('Simulate successful');await click('View receipt');await evaluate('document.querySelector("dialog[open] .dialog-head button").click()');console.log('PASS Student simulated digital installment payment');
 for(const [r,pages] of Object.entries({student:['overview','tuition','store','cart','orders','history','notices','profile'],cashier:['overview','tickets','tuition','orders','history','notices'],proware:['overview','inventory','orders']})){
  await login(r);for(const page of pages){await nav(`${r}/pages/${page}.html`);assert.ok((await evaluate('document.querySelector("#page-content").innerText.length'))>10,`${r}/${page}`);const broken=await evaluate('[...document.images].filter(i=>i.src&&!i.complete||i.src&&i.complete&&i.naturalWidth===0).map(i=>i.src)');assert.deepEqual(broken,[]);}
 }
 console.log('PASS all role screens and images');
 await login('cashier');await nav('cashier/pages/notices.html');const number=await evaluate('document.querySelector("[name=studentNumber]").value');await fill({studentNumber:number,title:'Pickup reminder',text:'Browser notification check'});await submit();
 await login('student');await nav('student/pages/notices.html');assert.ok((await evaluate('document.body.innerText')).includes('Browser notification check'));await click('Mark all as read');
 await nav('student/pages/profile.html');await evaluate('window.confirm=()=>true');await fill({name:'Student Profile Updated'});await submit();await nav('student/pages/profile.html');assert.equal(await evaluate('document.querySelector("[name=name]").value'),'Student Profile Updated');console.log('PASS notifications, read status, profile editing and persistence');
 await evaluate('sessionStorage.removeItem("itscash_vanilla_actor")');await nav('student/pages/register.html');await evaluate('window.confirm=()=>true');await fill({username:'registered.student',password:'Registered123!',confirm:'Registered123!',studentNumber:'QA-2026',name:'Registered Student',email:'registered@example.com',phone:'09123456789',course:'BSIT',year:'1'});await submit();await wait('location.pathname.endsWith("overview.html") && !!document.querySelector("#page-content")');assert.ok((await evaluate('document.body.innerText')).includes('Registered Student'));console.log('PASS Student registration');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 for(const [r,pages] of Object.entries({student:['overview','store','cart','profile'],cashier:['overview','tickets','tuition'],proware:['overview','inventory','orders']})){await login(r);for(const p of pages){await nav(`${r}/pages/${p}.html`);await delay(50);assert.equal(await evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth'),true,`${r}/${p} mobile overflow`);}}
 console.log('PASS mobile layouts across all three roles');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await nav('index.html');const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const screenshot=path.join(profile,'role-selection.png');await writeFile(screenshot,Buffer.from(shot.data,'base64'));console.log('Screenshot: '+screenshot);
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);console.log('PASS no browser exceptions or failed network requests');
}catch(error){if(ws?.readyState===1){try{let n=99999;ws.send(JSON.stringify({id:n,method:'Runtime.evaluate',params:{expression:'document.body.innerText',returnByValue:true}}));await delay(100);}catch{}}console.error(error);process.exitCode=1;
}finally{if(ws?.readyState===1){ws.send(JSON.stringify({id:99998,method:'Browser.close'}));await delay(200);}ws?.close();browser.kill();server.kill();}
