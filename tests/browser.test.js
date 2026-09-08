// Actual browser interactions against a local server, including a GitHub Pages subpath.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const playwright = require('playwright');
const { expect } = require('playwright/test');
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
        const numeric=async(id, expected, tolerance=1e-7)=>expect.poll(async()=>Math.abs(await num(id)-expected)).toBeLessThan(tolerance);
        const fill=async(id,v)=>page.locator('#'+id).fill(String(v));
        const check=async(name,fn)=>{
          try { await fn(); checks++; console.log(`${browserName}: ${name}`); }
          catch(error) {
            const dir=path.join(root,'tmp','screenshots',browserName); fs.mkdirSync(dir,{recursive:true});
            await page.screenshot({path:path.join(dir,'failure.png'),fullPage:true}).catch(()=>{});
            console.error('Failed scenario:',name,'URL:',page.url()); throw error;
          }
        };
        const valid=()=>page.evaluate(()=>window.Bench.valid);
        await check('VOPP drive, units, zero voltage, invalid impedance, and driver restoration',async()=>{
          await go(''); await numeric('vopp',.6325);
          await page.locator('#btn-diff').click(); await numeric('vopp',1.265);
          await page.locator('#vopp-unit').selectOption('mV'); await numeric('vopp',1265);
          await fill('vopp',1000); await expect(page).toHaveURL(/from=vopp/); const saved=page.url();
          await page.reload(); await numeric('vopp',1000);
          assert.equal(new URL(saved).searchParams.get('from'),'vopp');
          await fill('zdut',0); await expect.poll(valid).toBe(false); assert.equal(await page.locator('#copy-link').isDisabled(),true);
          await fill('zdut',50); await fill('vopp',0); await expect.poll(valid).toBe(true);
          await expect(page.locator('#metrics')).toContainText(/∞/);
          await fill('dbm','999999'); await expect.poll(valid).toBe(false);
        });
        await check('Zero dBm displays as zero in available and delivered power metrics',async()=>{
          for (const drive of ['se','diff']) for (const direction of ['src','rx']) {
            await go(`index.html?d=0&from=dbm&m=${drive}&dir=${direction}&zd=50`);
            for (const label of ['Available','Delivered']) {
              const metric = page.locator('#metrics .metric').filter({has:page.locator('dt', {hasText:label})});
              await expect(metric.locator('dd')).toHaveText('0 dBm');
            }
            await page.locator('#copy-result').click();
            assert.match(await page.evaluate(()=>window.copiedText), /\| 0 dBm/);
          }
        });
        await check('Delay legacy links, driver restoration, physical unit conversion, and invalid inputs',async()=>{
          await go('delay.html?er=1&f=1&fu=GHz&from=length&L=250&lu=mm'); await numeric('length',250);
          const t=await num('delay'); near(t,.8339);
          await page.locator('#len-unit').selectOption('cm'); await numeric('length',25);
          await page.locator('#freq-unit').selectOption('MHz'); await numeric('freq',1000);
          await page.locator('#delay-unit').selectOption('ps'); await numeric('delay',t*1000,1e-6);
          await fill('delay',1000); await page.reload(); await numeric('delay',1000); await numeric('length',29.98);
          await fill('degrees',90); await page.reload(); await numeric('degrees',90);
          await go('delay.html?er=1&f=1&fu=GHz&from=delay&L=250&lu=mm'); await numeric('length',250); await expect.poll(valid).toBe(true);
          await fill('er',''); await expect.poll(valid).toBe(false);
          await fill('er',1); await fill('length',-1); await expect.poll(valid).toBe(false);
          await fill('length',0); await expect.poll(valid).toBe(true); await page.reload(); await numeric('length',0);
        });
        await check('Phase estimator transmission/reflection, unwrapping, application and saved inputs',async()=>{
          await go('delay.html');
          await fill('phase-p2',-72); await page.locator('#phase-mode').selectOption('reflection');
          await expect(page.locator('#phase-metrics')).toContainText(/299\.8 mm/);
          await page.locator('#phase-use').click(); await numeric('length',299.8);
          await fill('phase-p1',-170); await fill('phase-p2',170); await fill('phase-turns',-1);
          await page.reload(); await numeric('phase-turns',-1); await numeric('phase-p1',-170);
          await expect(page.locator('#phase-metrics')).toContainText(/−?\-?20 deg/);
          await fill('phase-f2',1000); await expect.poll(valid).toBe(false);
          await fill('phase-f2',1100); await fill('phase-turns',0);
          await expect(page.locator('#phase-status')).toContainText(/Negative delay/);
          assert.equal(await page.locator('#phase-use').isDisabled(),true);
        });
        await check('IP3 reference planes, absolute IM3 conversion and blank unity gain',async()=>{
          await go('large-signal.html?tab=imd3');
          const before=await page.locator('#imd-metrics').innerText(); assert.match(before,/30\.00 dBm/);
          await page.locator('#imd-unit').selectOption('dbm'); await numeric('imd-im3',-30);
          await page.locator('#imd-plane').selectOption('output'); await numeric('imd-tone',10);
          await expect(page.locator('#imd-metrics')).toContainText(/30\.00 dBm/);
          await fill('imd-gain',''); await expect.poll(valid).toBe(true);
          await page.locator('#imd-plane').selectOption('input'); await expect.poll(valid).toBe(true); await numeric('imd-tone',10);
          await fill('imd-tone',-10); await expect.poll(valid).toBe(true);
          await fill('imd-gain',20); await expect.poll(valid).toBe(true);
        });
        await check('Large-signal saves every tab, P1dB driver and THD data',async()=>{
          await go('large-signal.html?tab=imd3'); await fill('imd-tone',-14); await fill('imd-im3',-46);
          await page.locator('[data-panel="p1db"]').click(); await fill('p1-pout',7);
          await page.locator('[data-panel="thd"]').click(); await fill('thd-h2',-55); await fill('thd-h4',-70);
          await page.reload(); await numeric('thd-h2',-55); await numeric('thd-h4',-70);
          await page.locator('[data-panel="imd3"]').click(); await numeric('imd-tone',-14); await numeric('imd-im3',-46);
          await page.locator('[data-panel="p1db"]').click(); await numeric('p1-pout',7);
          await fill('p1-gain',22); await numeric('p1-pout',7); await numeric('p1-pin',-14);
          await page.locator('[data-panel="thd"]').click(); await fill('thd-h4','bad'); await expect.poll(valid).toBe(false);
        });
        await check('Match complex impedance, scalar edits, invalid data and canonical links',async()=>{
          await go('match.html'); await fill('x',50); await numeric('gamma',.4472);
          const phase=await num('phase'); await fill('rl',-20); await numeric('gamma',.1); await numeric('phase',phase);
          await page.reload(); await numeric('phase',phase); await numeric('gamma',.1);
          await fill('gamma',1.1); await expect.poll(valid).toBe(false);
          await page.locator('[data-special="match"]').click(); await numeric('z',50);
          await page.locator('[data-special="short"]').click(); await numeric('z',0); await numeric('gamma',1);
          await page.locator('[data-special="open"]').click(); await expect(page.locator('#metrics')).toContainText(/Open/);
          await page.reload(); await expect(page.locator('#metrics')).toContainText(/Open/);
          await page.locator('[data-load="75"]').click(); await page.reload(); await fill('z0',75); await numeric('gamma',0);
        });
        await check('Smith chart responds to keyboard and pointer interaction',async()=>{
          await go('match.html'); const smith=page.locator('#smith'); await smith.focus(); await page.keyboard.press('ArrowUp');
          await numeric('gamma',.01); await numeric('phase',90);
          await smith.scrollIntoViewIfNeeded();
          const box=await smith.boundingBox();
          // Locator click scrolls and waits for actionability on Linux as well as Windows.
          await smith.click({position:{x:box.width/2,y:box.height/2}});
          // Firefox rounds pointer coordinates to device pixels; allow one chart pixel.
          await numeric('gamma',0,.006);
          await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down();
          await page.mouse.move(box.x+box.width*.65,box.y+box.height*.35,{steps:6}); await page.mouse.up();
          assert.ok(await num('x')>0); assert.ok(await num('gamma')>.1);
        });
        await check('Power and noise chain output levels, limits, reorder and physical bandwidth units',async()=>{
          await go('chain.html'); assert.equal(await page.locator('.stage').count(),3);
          await expect(page.locator('#power-rows')).toContainText(/-23\.00 dBm/);
          await expect(page.locator('#power-rows')).toContainText(/-3\.00 dBm/);
          await expect(page.locator('#power-rows')).toContainText(/-9\.00 dBm/);
          const noise=await page.locator('#noise-metrics').innerText();
          await page.locator('#bandwidth-unit').selectOption('kHz'); await numeric('bandwidth',1000);
          assert.equal(await page.locator('#noise-metrics').innerText(),noise);
          await fill('source-power',0); await expect(page.locator('#chain-status')).toContainText(/exceed/);
          await page.locator('.stage').nth(1).locator('[data-action="up"]').click();
          assert.notEqual(await page.locator('#noise-metrics').innerText(),noise);
          await expect(page.locator('.stage').first()).toContainText(/AMPLIFIER/);
          await page.reload(); await expect(page.locator('.stage').first()).toContainText(/AMPLIFIER/);
          await page.locator('.stage').first().locator('[data-key="nf"]').fill('-2'); await expect.poll(valid).toBe(false);
          await page.locator('.stage').first().locator('[data-key="nf"]').fill('2');
          await page.locator('#add-passive').click(); assert.equal(await page.locator('.stage').count(),4);
          await page.locator('.stage').last().locator('[data-action="remove"]').click(); assert.equal(await page.locator('.stage').count(),3);
        });
        await check('Named setups save, load, update, delete, and keep names as plain text',async()=>{
          await go('delay.html'); await fill('length',250);
          await page.locator('.saved-setups summary').click();
          await fill('setup-name','Bench <receiver>'); await page.locator('#setup-save').click();
          await fill('length',100); await page.locator('#setup-list').selectOption('0');
          await page.locator('#setup-load').click(); await page.waitForURL(/L=250/); await numeric('length',250);
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
          await expect(page.locator('#bench-status')).toContainText(/Clipboard unavailable/);
        });
        await check('Fractional inputs retain precision across saved links',async()=>{
          await go('large-signal.html?t=-10.123456789'); await numeric('tone-dbm',-10.12);
          await page.locator('[data-panel="p1db"]').click(); await fill('p1-pout',7.123456789); await page.reload(); await numeric('p1-pout',7.12);
          await go('index.html?from=vopp&v=0.123456789012&u=V&m=se&dir=src&zd=50'); await numeric('vopp',.1235);
          await page.reload(); await numeric('vopp',.1235);
          near(Number(new URL(page.url()).searchParams.get('v')),.123456789012,1e-14);
        });
        await check('Rounded fields retain exact values across repeated unit changes and restoration',async()=>{
          await go('delay.html'); await numeric('delay',.3336);
          const originalDelay=Number(new URL(page.url()).searchParams.get('t'));
          near(originalDelay,1e9*.1/299792458,1e-14);
          for(let i=0;i<3;i++) {
            await page.locator('#delay-unit').selectOption('ps'); await numeric('delay',333.6);
            await page.locator('#delay-unit').selectOption('ns'); await numeric('delay',.3336);
            await page.locator('#len-unit').selectOption('in'); await numeric('length',3.937);
            await page.locator('#len-unit').selectOption('mm'); await numeric('length',100);
          }
          await page.reload(); await numeric('delay',.3336);
          near(Number(new URL(page.url()).searchParams.get('t')),originalDelay,1e-12);
          await page.locator('#phase-use').click(); await numeric('length',299.8);
          await expect.poll(async()=>Number(new URL(await page.evaluate(()=>location.href)).searchParams.get('L'))).toBeCloseTo(299.792458,9);
          await page.reload(); await numeric('length',299.8);
          await go('index.html?from=vopp&v=0.123456789012&u=V&m=se&dir=src&zd=50');
          for(let i=0;i<3;i++) { await page.locator('#vopp-unit').selectOption('mV'); await numeric('vopp',123.5); await page.locator('#vopp-unit').selectOption('V'); }
          await page.reload(); await numeric('vopp',.1235);
          near(Number(new URL(page.url()).searchParams.get('v')),.123456789012,1e-14);
          await go('match.html'); await fill('x',50); await numeric('gamma',.4472);
          await page.locator('.reference-details summary').click();
          await page.locator('[data-chart="vswr"]').click(); await fill('rl',-20);
          await expect.poll(async()=>Number(new URL(await page.evaluate(()=>location.href)).searchParams.get('phase'))).toBeCloseTo(63.434948822922,9);
        });
        await check('Preset buttons replace exact values even when their rounded displays match',async()=>{
          const queryNumber=async key=>Number(new URL(await page.evaluate(()=>location.href)).searchParams.get(key));
          await go('match.html?z0=50.0001&z=50.0002&x=0');
          await numeric('z0',50); await numeric('z',50);
          await page.locator('[data-reference="50"]').click();
          await expect.poll(()=>queryNumber('z0')).toBe(50);
          await page.locator('[data-load="50"]').click();
          await expect.poll(()=>queryNumber('z')).toBe(50); await numeric('gamma',0);
          await go('delay.html?er=2.10001'); await numeric('er',2.1);
          await page.locator('[data-er="2.1"]').click(); await expect.poll(()=>queryNumber('er')).toBe(2.1);
          await go('index.html?zd=50.0001'); await numeric('zdut',50);
          await page.locator('[data-z="50"]').click(); await expect.poll(()=>queryNumber('zd')).toBe(50);
          await go('large-signal.html?z=50.0001'); await numeric('z0',50);
          await page.locator('[data-z="50"]').click(); await expect.poll(()=>queryNumber('z')).toBe(50);
        });
        await check('Blank neutral inputs mean zero, while required values and omitted measurements stay distinct',async()=>{
          await go('match.html'); await fill('x',''); await expect.poll(valid).toBe(true); await numeric('gamma',0);
          await fill('z',''); await fill('x',50); await numeric('gamma',1); await numeric('phase',90);
          await fill('gamma',.2); await fill('phase',''); await numeric('z',75); await numeric('x',0);
          await fill('x','-'); await expect.poll(valid).toBe(false); await fill('x',''); await expect.poll(valid).toBe(true);
          await fill('z0',''); await expect.poll(valid).toBe(false);
          await go('delay.html'); await fill('length',''); await numeric('delay',0); await expect.poll(valid).toBe(true);
          await fill('phase-p1',''); await fill('phase-p2',''); await fill('phase-turns',''); await expect.poll(valid).toBe(true);
          await expect(page.locator('#phase-metrics')).toContainText('0 ns');
          await fill('freq',''); await expect.poll(valid).toBe(false);
          await go('chain.html'); await page.locator('.stage').first().locator('[data-key="db"]').fill(''); await expect.poll(valid).toBe(true);
          await expect(page.locator('#power-rows').locator('tr').first()).toContainText('-20.00 dBm');
          await page.locator('.stage').first().locator('[data-key="limit"]').fill('');
          await expect(page.locator('#power-rows').locator('tr').first()).toContainText('Unspecified');
          await page.locator('.stage').nth(1).locator('[data-key="nf"]').fill(''); await expect.poll(valid).toBe(false);
          await go('large-signal.html?tab=thd'); await fill('thd-h3',''); await expect(page.locator('#thd-metrics')).toContainText('1 %');
          await fill('thd-h2',''); await expect.poll(valid).toBe(false);
          await page.locator('[data-panel="p1db"]').click(); await fill('p1-gain',''); await numeric('p1-pout',-11);
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
          await go('chain.html?stages=broken'); await expect.poll(valid).toBe(false);
          await expect(page.locator('#chain-status')).toContainText(/could not be read/);
          await fill('source-power',-20); await expect.poll(valid).toBe(true);
          await page.locator('.stage').first().locator('[data-key="name"]').fill('<img src=x onerror=alert(1)>');
          assert.equal(await page.locator('#power-path img').count(),0);
          await page.reload(); assert.equal(await page.locator('.stage').first().locator('[data-key="name"]').inputValue(),'<img src=x onerror=alert(1)>');
        });
        await check('LaTeX equations update across calculator modes and preserve plain-text stage names',async()=>{
          const rendered=async()=>{
            await expect(page.locator('#calculation-text .katex').first()).toBeVisible();
            assert.equal(await page.locator('.equation-error').count(),0, page.url());
            assert.equal(await page.locator('.equation .katex-mathml').count(),await page.locator('.equation').count());
          };
          for (const file of [
            'index.html?from=vopp&v=0&m=diff&dir=rx',
            'index.html?d=-100&m=diff',
            'match.html?from=point&re=1&im=0',
            'match.html?from=point&re=-1&im=0',
            'match.html?z=50&x=50',
            'delay.html?phase-mode=reflection&phase-p2=-72',
            'large-signal.html?tab=twotone&m=diff',
            'large-signal.html?tab=imd3&imd-unit=dbm',
            'large-signal.html?tab=p1db&p1-meas=7',
            'large-signal.html?tab=thd&thd-h4=-60&thd-h5=-70',
            'chain.html?stages=%5B%5D'
          ]) {
            await go(file); await page.locator('.calculation summary').click(); await rendered();
          }
          await go('delay.html'); await page.locator('.calculation summary').click(); await rendered();
          const wavelength=page.locator('.equation').filter({has:page.getByRole('heading',{name:'Guided wavelength',exact:true})});
          await fill('freq',2000);
          await expect(wavelength.locator('annotation')).toContainText('149.9');
          await fill('freq',''); await expect(page.locator('#calculation-text')).toContainText('Correct the line inputs');
          assert.equal(await page.locator('#calculation-text .katex').count(),0);
          await fill('freq',1000); await rendered();
          await go('chain.html'); await page.locator('.calculation summary').click();
          const stageName='<img src=x onerror=alert(1)> \\frac{1}{2}';
          await page.locator('.stage').first().locator('[data-key="name"]').fill(stageName);
          await expect(page.locator('#calculation-text')).toContainText(stageName);
          assert.equal(await page.locator('#calculation-text img').count(),0); await rendered();
        });
        await check('Every page has working navigation, calculation detail, and responsive layout',async()=>{
          for(const width of [390,768,1440]) for(const file of ['index.html','match.html','large-signal.html','delay.html','chain.html']) {
            await page.setViewportSize({width,height:900}); await go(file);
            assert.equal(await valid(),true,`${file} default invalid`);
            const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
            if (overflow) console.log(await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(el=>!el.closest('.schematic-stage')).map(el=>({tag:el.tagName,id:el.id,class:el.className,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})).filter(el=>el.right>innerWidth+1).slice(0,30)));
            assert.equal(overflow,false,`${file} overflows at ${width}px`);
            await page.locator('.calculation summary').click();
            await expect(page.locator('#calculation-text .katex').first()).toBeVisible();
            assert.equal(await page.locator('.equation-error').count(),0, `${file} has an invalid LaTeX equation`);
            assert.equal(await page.locator('.equation .katex-mathml').count(), await page.locator('.equation').count());
            assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${file} equations overflow at ${width}px`);
            for(const link of await page.locator('nav a').all()) {
              const target=await link.getAttribute('href'); const response=await context.request.get(new URL(target,page.url()).href); assert.equal(response.status(),200);
            }
            if(process.env.SCREENSHOTS) {
              const dir=path.join(root,'tmp','screenshots',browserName); fs.mkdirSync(dir,{recursive:true});
              await page.locator('.calculation').screenshot({path:path.join(dir,`equations-${file}-${width}.png`)});
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
