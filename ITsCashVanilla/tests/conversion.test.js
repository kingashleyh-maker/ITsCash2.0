import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
async function files(dir){const items=await readdir(dir,{withFileTypes:true});return (await Promise.all(items.map(item=>item.isDirectory()?files(path.join(dir,item.name)):path.join(dir,item.name)))).flat();}
test('all role pages, module imports, and stylesheet paths resolve locally',async()=>{
 const list=await files(root);const pages=list.filter(p=>p.endsWith('.html'));assert.equal(pages.length,24);
 for(const file of list.filter(p=>/\.(html|js)$/.test(p)&&!p.includes(path.sep+'tests'+path.sep))){
  const source=await readFile(file,'utf8');
  assert.doesNotMatch(source,/from\s*["']react(?:-dom)?(?:\/[^"']*)?["']/);
  assert.doesNotMatch(source,/\.jsx["']/);
  const refs=file.endsWith('.html')?[...source.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m=>m[1]):[...source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)].map(m=>m[1]);
  for(const ref of refs){await access(path.resolve(path.dirname(file),ref));}
 }
});
test('catalog assets exist under the standalone folder',async()=>{
 const source=await readFile(path.join(root,'shared/data/catalog.js'),'utf8');
 const refs=[...source.matchAll(/new URL\("([^"\n]+)"/g)].map(m=>m[1]);assert.equal(refs.length,20);
 for(const ref of refs)await access(path.resolve(root,'shared/data',ref));
});
test('converted app uses independent data and session storage',async()=>{
 const store=await readFile(path.join(root,'shared/scripts/store.js'),'utf8');assert.match(store,/itscash_vanilla_v1/);assert.doesNotMatch(store,/itscash_react_v2/);
 const core=await readFile(path.join(root,'shared/scripts/core.js'),'utf8');assert.match(core,/itscash_vanilla_actor/);
});
