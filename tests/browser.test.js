// Actual browser interactions against a local server, including a GitHub Pages subpath.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const playwright = require('playwright');
const root = path.resolve(__dirname, '..');
const prefix = '/rf_lab_reference/';
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server = http.createServer((req,res) => {
  const url = new URL(req.url,'http://localhost');
  if (!url.pathname.startsWith(prefix)) { res.writeHead(404); return res.end(); }
  const file = path.resolve(root, decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html');
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file,(err,data) => { res.writeHead(err ? 404 : 200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'}); res.end(err ? 'Not found' : data); });
});
const near = (a,b,tol=1e-7) => assert.ok(Number.isFinite(a) && Math.abs(a-b)<tol,`${a} != ${b}`);
let checks=0;
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}${prefix}`;
  const browsers=(process.env.BROWSERS || 'chromium').split(',');
  try {
    for(const browserName of browsers) {
      const browser=await playwright[browserName].launch({headless:true});
      try {
        const context=await browser.newContext({viewport:{width:1280,height:900}});
        await context.addInitScript(() => {
          Object.defineProperty(navigator, 'clipboard', {configurable:true,value:{writeText: async text => { window.copiedText = text; }}});
        });
        await context.route(/fonts\.(googleapis|gstatic)\.com/, route=>route.abort());
        const page=await context.newPage(), errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        const go=async file=>{await page.goto(base+file); await page.locator('#calculation-text').waitFor({state:'attached'});};
        const num=async id=>Number(await page.locator('#'+id).inputValue());
        const fill=async(id,v)=>page.locator('#'+id).fill(String(v));
        const check=async(name,fn)=>{await fn(); checks++; console.log(`${browserName}: ${name}`);};
        const valid=()=>page.evaluate(()=>window.Bench.valid);
        await check('VOPP drive, units, zero voltage, invalid impedance, and driver restoration',async()=>{
          await go(''); near(await num('vopp'),.63246,1e-5);
          await page.locator('#btn-diff').click(); near(await num('vopp'),1.26491,1e-5);
          await page.locator('#vopp-unit').selectOption('mV'); near(await num('vopp'),1264.911,1e-3);
          await fill('vopp',1000); const saved=page.url();
          await page.reload(); near(await num('vopp'),1000);
          assert.equal(new URL(saved).searchParams.get('from'),'vopp');
          await fill('zdut',0); assert.equal(await valid(),false); assert.equal(await page.locator('#copy-link').isDisabled(),true);
          await fill('zdut',50); await fill('vopp',0); assert.equal(await valid(),true);
          assert.match(await page.locator('#metrics').innerText(),/∞/);
          await fill('dbm','999999'); assert.equal(await valid(),false);
        });
        await check('Delay legacy links, driver restoration, physical unit conversion, and invalid inputs',async()=>{
          await go('delay.html?er=1&f=1&fu=GHz&from=length&L=250&lu=mm'); near(await num('length'),250);
          const t=await num('delay'); near(t,.833910237995,1e-10);
          await page.locator('#len-unit').selectOption('cm'); near(await num('length'),25);
          await page.locator('#freq-unit').selectOption('MHz'); near(await num('freq'),1000);
          await page.locator('#delay-unit').selectOption('ps'); near(await num('delay'),t*1000,1e-6);
          await fill('delay',1000); await page.reload(); near(await num('delay'),1000); near(await num('length'),29.9792458);
          await fill('degrees',90); await page.reload(); near(await num('degrees'),90);
          await go('delay.html?er=1&f=1&fu=GHz&from=delay&L=250&lu=mm'); near(await num('length'),250); assert.equal(await valid(),true);
          await fill('er',''); assert.equal(await valid(),false);
          await fill('er',1); await fill('length',-1); assert.equal(await valid(),false);
          await fill('length',0); assert.equal(await valid(),true); await page.reload(); near(await num('length'),0);
        });
        await check('Phase estimator transmission/reflection, unwrapping, application and saved inputs',async()=>{
          await go('delay.html');
          await fill('phase-p2',-72); await page.locator('#phase-mode').selectOption('reflection');
          assert.match(await page.locator('#phase-metrics').innerText(),/299\.79246 mm/);
          await page.locator('#phase-use').click(); near(await num('length'),299.792458);
          await fill('phase-p1',-170); await fill('phase-p2',170); await fill('phase-turns',-1);
          await page.reload(); near(await num('phase-turns'),-1); near(await num('phase-p1'),-170);
          assert.match(await page.locator('#phase-metrics').innerText(),/−?\-?20 deg/);
          await fill('phase-f2',1000); assert.equal(await valid(),false);
          await fill('phase-f2',1100); await fill('phase-turns',0);
          assert.match(await page.locator('#phase-status').innerText(),/Negative delay/);
          assert.equal(await page.locator('#phase-use').isDisabled(),true);
        });
        await check('IP3 reference planes, absolute IM3 conversion and incomplete gain',async()=>{
          await go('large-signal.html?tab=imd3');
          const before=await page.locator('#imd-metrics').innerText(); assert.match(before,/30\.00 dBm/);
          await page.locator('#imd-unit').selectOption('dbm'); near(await num('imd-im3'),-30);
          await page.locator('#imd-plane').selectOption('output'); near(await num('imd-tone'),10);
          assert.match(await page.locator('#imd-metrics').innerText(),/30\.00 dBm/);
          await fill('imd-gain',''); assert.equal(await valid(),true);
          await page.locator('#imd-plane').selectOption('input'); assert.equal(await valid(),false);
          await fill('imd-tone',-10); assert.equal(await valid(),false);
          await fill('imd-gain',20); assert.equal(await valid(),true);
        });
        await check('Large-signal saves every tab, P1dB driver and THD data',async()=>{
          await go('large-signal.html?tab=imd3'); await fill('imd-tone',-14); await fill('imd-im3',-46);
          await page.locator('[data-panel="p1db"]').click(); await fill('p1-pout',7);
          await page.locator('[data-panel="thd"]').click(); await fill('thd-h2',-55); await fill('thd-h4',-70);
          await page.reload(); near(await num('thd-h2'),-55); near(await num('thd-h4'),-70);
          await page.locator('[data-panel="imd3"]').click(); near(await num('imd-tone'),-14); near(await num('imd-im3'),-46);
          await page.locator('[data-panel="p1db"]').click(); near(await num('p1-pout'),7);
          await fill('p1-gain',22); near(await num('p1-pout'),7); near(await num('p1-pin'),-14);
          await page.locator('[data-panel="thd"]').click(); await fill('thd-h4','bad'); assert.equal(await valid(),false);
        });
        await check('Match complex impedance, scalar edits, invalid data and canonical links',async()=>{
          await go('match.html'); await fill('x',50); near(await num('gamma'),Math.sqrt(.2));
          const phase=await num('phase'); await fill('rl',-20); near(await num('gamma'),.1); near(await num('phase'),phase);
          await page.reload(); near(await num('phase'),phase); near(await num('gamma'),.1);
          await fill('gamma',1.1); assert.equal(await valid(),false);
          await page.locator('[data-special="match"]').click(); near(await num('z'),50);
          await page.locator('[data-special="short"]').click(); near(await num('z'),0); near(await num('gamma'),1);
          await page.locator('[data-special="open"]').click(); assert.match(await page.locator('#metrics').innerText(),/Open/);
          await page.reload(); assert.match(await page.locator('#metrics').innerText(),/Open/);
          await page.locator('[data-load="75"]').click(); await page.reload(); await fill('z0',75); near(await num('gamma'),0);
        });
        await check('Smith chart responds to keyboard and pointer interaction',async()=>{
          await go('match.html'); const smith=page.locator('#smith'); await smith.focus(); await page.keyboard.press('ArrowUp');
          near(await num('gamma'),.01); near(await num('phase'),90);
          await smith.scrollIntoViewIfNeeded();
          const box=await smith.boundingBox();
          // Locator click scrolls and waits for actionability on Linux as well as Windows.
          await smith.click({position:{x:box.width/2,y:box.height/2}});
          // Firefox rounds pointer coordinates to device pixels; allow one chart pixel.
          near(await num('gamma'),0,.006);
          await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down();
          await page.mouse.move(box.x+box.width*.65,box.y+box.height*.35,{steps:6}); await page.mouse.up();
          assert.ok(await num('x')>0); assert.ok(await num('gamma')>.1);
        });
        await check('Power and noise chain output levels, limits, reorder and physical bandwidth units',async()=>{
          await go('chain.html'); assert.equal(await page.locator('.stage').count(),3);
          assert.match(await page.locator('#power-rows').innerText(),/-23\.00 dBm/);
          assert.match(await page.locator('#power-rows').innerText(),/-3\.00 dBm/);
          assert.match(await page.locator('#power-rows').innerText(),/-9\.00 dBm/);
          const noise=await page.locator('#noise-metrics').innerText();
          await page.locator('#bandwidth-unit').selectOption('kHz'); near(await num('bandwidth'),1000);
          assert.equal(await page.locator('#noise-metrics').innerText(),noise);
          await fill('source-power',0); assert.match(await page.locator('#chain-status').innerText(),/exceed/);
          await page.locator('.stage').nth(1).locator('[data-action="up"]').click();
          assert.notEqual(await page.locator('#noise-metrics').innerText(),noise);
          assert.match(await page.locator('.stage').first().innerText(),/AMPLIFIER/);
          await page.reload(); assert.match(await page.locator('.stage').first().innerText(),/AMPLIFIER/);
          await page.locator('.stage').first().locator('[data-key="nf"]').fill('-2'); assert.equal(await valid(),false);
          await page.locator('.stage').first().locator('[data-key="nf"]').fill('2');
          await page.locator('#add-passive').click(); assert.equal(await page.locator('.stage').count(),4);
          await page.locator('.stage').last().locator('[data-action="remove"]').click(); assert.equal(await page.locator('.stage').count(),3);
        });
        await check('Named setups save, load, update, delete, and keep names as plain text',async()=>{
          await go('delay.html'); await fill('length',250);
          await page.locator('.saved-setups summary').click();
          await fill('setup-name','Bench <receiver>'); await page.locator('#setup-save').click();
          await fill('length',100); await page.locator('#setup-list').selectOption('0');
          await page.locator('#setup-load').click(); await page.waitForURL(/L=250/); near(await num('length'),250);
          await page.locator('.saved-setups summary').click(); await fill('setup-name','Bench <receiver>');
          await fill('length',125); await page.locator('#setup-save').click();
          assert.equal(await page.locator('#setup-list option').count(),2);
          assert.equal(await page.locator('#setup-list option').nth(1).textContent(),'Bench <receiver>');
          await page.locator('#setup-list').selectOption('0'); await page.locator('#setup-delete').click();
          assert.equal(await page.locator('#setup-list option').count(),1);
        });
        await check('Copied links and results reflect current inputs; clipboard failures are reported',async()=>{
          for (const file of ['index.html','match.html','large-signal.html','delay.html','chain.html']) {
            await go(file); await page.locator('#copy-link').click();
            assert.equal(await page.evaluate(()=>window.copiedText),page.url());
            await page.locator('#copy-result').click();
            assert.ok((await page.evaluate(()=>window.copiedText)).length>20);
          }
          await go('delay.html');
          await page.evaluate(()=>navigator.clipboard.writeText=async()=>{throw new Error('denied');});
          await page.locator('#copy-link').click();
          assert.match(await page.locator('#bench-status').innerText(),/Clipboard unavailable/);
        });
        await check('Fractional inputs retain precision across saved links',async()=>{
          await go('large-signal.html?t=-10.123456789'); near(await num('tone-dbm'),-10.123456789,1e-11);
          await page.locator('[data-panel="p1db"]').click(); await fill('p1-pout',7.123456789); await page.reload(); near(await num('p1-pout'),7.123456789,1e-11);
          await go('index.html?from=vopp&v=0.123456789012&u=V&m=se&dir=src&zd=50'); near(await num('vopp'),.123456789012,1e-12);
          await page.reload(); near(await num('vopp'),.123456789012,1e-12);
        });
        await check('Unavailable browser storage leaves calculators and copy links usable',async()=>{
          const blocked=await context.newPage();
          await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('storage denied');}}));
          await blocked.goto(base+'delay.html');
          assert.equal(await blocked.evaluate(()=>Bench.valid),true);
          assert.match(await blocked.locator('#bench-status').innerText(),/unavailable/);
          await blocked.locator('.saved-setups summary').click(); await blocked.locator('#setup-name').fill('Test'); await blocked.locator('#setup-save').click();
          assert.match(await blocked.locator('#bench-status').innerText(),/Could not save/);
          await blocked.locator('#copy-link').click(); assert.equal(await blocked.evaluate(()=>window.copiedText),blocked.url());
          await blocked.close();
        });
        await check('Invalid saved chain data is surfaced; stage names are escaped',async()=>{
          await go('chain.html?stages=broken'); assert.equal(await valid(),false);
          assert.match(await page.locator('#chain-status').innerText(),/could not be read/);
          await fill('source-power',-20); assert.equal(await valid(),true);
          await page.locator('.stage').first().locator('[data-key="name"]').fill('<img src=x onerror=alert(1)>');
          assert.equal(await page.locator('#power-path img').count(),0);
          await page.reload(); assert.equal(await page.locator('.stage').first().locator('[data-key="name"]').inputValue(),'<img src=x onerror=alert(1)>');
        });
        await check('Every page has working navigation, calculation detail, and responsive layout',async()=>{
          for(const width of [390,768,1440]) for(const file of ['index.html','match.html','large-signal.html','delay.html','chain.html']) {
            await page.setViewportSize({width,height:900}); await go(file);
            assert.equal(await valid(),true,`${file} default invalid`);
            const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
            if (overflow) console.log(await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(el=>!el.closest('.schematic-stage')).map(el=>({tag:el.tagName,id:el.id,class:el.className,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})).filter(el=>el.right>innerWidth+1).slice(0,30)));
            assert.equal(overflow,false,`${file} overflows at ${width}px`);
            await page.locator('.calculation summary').click();
            assert.ok((await page.locator('#calculation-text').innerText()).length>150);
            for(const link of await page.locator('nav a').all()) {
              const target=await link.getAttribute('href'); const response=await context.request.get(new URL(target,page.url()).href); assert.equal(response.status(),200);
            }
            if(process.env.SCREENSHOTS) {
              const dir=path.join(root,'tmp','screenshots',browserName); fs.mkdirSync(dir,{recursive:true});
              await page.locator('.calculation summary').click();
              await page.screenshot({path:path.join(dir,`${file}-${width}.png`),fullPage:true});
            }
          }
        });
        assert.deepEqual(errors,[],`Uncaught browser errors: ${errors.join(', ')}`);
        await context.close();
      } finally { await browser.close(); }
    }
  } finally { await new Promise(resolve=>server.close(resolve)); }
  console.log(`${checks} browser scenarios passed`);
})().catch(err=>{console.error(err); process.exitCode=1; server.close();});
