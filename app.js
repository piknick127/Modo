const $=id=>document.getElementById(id),E=PaintGuide;
let owned=E.inventory.map(p=>p.id),report=[],sourceImage=null,crop=null,start=null,busy=false,ocrRows=[];
try{const saved=JSON.parse(localStorage.getItem('paint-stock-v1'));if(Array.isArray(saved))owned=saved.filter(id=>E.inventory.some(p=>p.id===id));$('notes').value=localStorage.getItem('paint-notes-v1')||'';}catch{}
const status=s=>$('status').textContent=s;
function store(){try{localStorage.setItem('paint-stock-v1',JSON.stringify(owned));localStorage.setItem('paint-notes-v1',$('notes').value)}catch{status('瀏覽器無法保存本機資料，請下載備份。')}}
function stock(){const box=$('inventory');box.replaceChildren();for(const p of E.inventory){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=owned.includes(p.id);check.onchange=()=>{owned=check.checked?[...owned,p.id]:owned.filter(x=>x!==p.id);store();$('count').textContent=owned.length+' 項';if(report.length)generate()};label.append(check,document.createTextNode(p.id+' '+p.name));box.append(label)}$('count').textContent=owned.length+' 項'}
function add(parent,tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;parent.append(el);return el}
function generate(){const total=Number($('volume').value);if(!Number.isFinite(total)||total<.1||total>100){status('請輸入 0.1–100 ml 的色漆量。');return}const text=$('text').value.trim();$('results').replaceChildren();report=[];if(!text){status('請先辨識圖片、貼上配方或載入範例。');return}report=E.parse(text).map(r=>E.suggest(r,owned,total));for(const r of report){const el=add($('results'),'article','','result');add(el,'h3',r.title);add(el,'span',r.status,'badge');add(el,'p','原文：'+r.raw,'muted');if(r.warnings.length){for(const w of r.warnings)add(el,'div','• '+w,'warn');add(el,'p','完整配方尚未成立；以下僅列出可查對材料，不提供成品用量。','muted')}const table=add(el,'table','');const head=add(table,'tr','');['原色','庫存候選',r.warnings.length?'原圖比例':r.layer?'施工順序':'試調用量'].forEach(s=>add(head,'th',s));r.items.forEach((p,i)=>{const tr=add(table,'tr','');add(tr,'td',p.name);add(tr,'td',p.paint?p.paint.id+' '+p.paint.name:'待補色／查對');add(tr,'td',r.warnings.length?(p.tiny?'少量':p.amount===null?'未辨識':p.amount+'%'):r.layer?'第 '+(i+1)+' 層，單色':p.tiny?'微量，逐次添加':p.ml.toFixed(3)+' ml（'+p.amount+'%）')});if(!r.warnings.length)add(el,'p',r.layer?'每層乾燥後再施工下一層；罩染層數會影響色澤，各層用量另估。':'沿用原比例的探索配方。底色與乾燥後光澤均會影響結果；微量成分不納入預估總量。','muted') }status('已產生 '+report.length+' 組結果；請對照原圖確認部位與比例。')}
function saveFile(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('generate').onclick=generate;$('sample').onclick=()=>{$('text').value=E.sample;generate()};$('volume').onchange=()=>{if(report.length)generate()};$('text').oninput=()=>{report=[];$('results').replaceChildren()};$('notes').oninput=store;
$('download').onclick=()=>{generate();if(report.length)saveFile('paint-recipes.json',JSON.stringify({version:1,date:new Date().toISOString(),base:$('base').value,finish:$('finish').value,paintMl:Number($('volume').value),source:$('text').value,report,notes:$('notes').value},null,2))};$('print').onclick=()=>window.print();$('exportStock').onclick=()=>saveFile('paint-stock.json',JSON.stringify({version:1,owned},null,2));$('importStock').onchange=async e=>{try{const data=JSON.parse(await e.target.files[0].text());if(data.version!==1||!Array.isArray(data.owned)||data.owned.some(id=>!E.inventory.some(p=>p.id===id)))throw Error();owned=[...new Set(data.owned)];store();stock();if(report.length)generate()}catch{status('庫存備份格式不正確；請使用此網頁匯出的 JSON。')}e.target.value=''};
function draw(){
 if(!sourceImage)return;
 const c=$('canvas'),ctx=c.getContext('2d');
 ctx.drawImage(sourceImage,0,0,c.width,c.height);
 if($('showHighlights').checked){
  ctx.save();ctx.lineWidth=Math.max(1,c.width/900);
  for(const row of ocrRows)for(const word of row.words){
   const b=word.bbox;ctx.fillStyle='rgba(255,215,64,0.27)';ctx.strokeStyle='#ffda59';
   ctx.fillRect(b.x0,b.y0,b.x1-b.x0,b.y1-b.y0);ctx.strokeRect(b.x0,b.y0,b.x1-b.x0,b.y1-b.y0);
  }
  ctx.restore();
 }
 if(crop){ctx.strokeStyle='#00e5ac';ctx.lineWidth=3;ctx.strokeRect(crop.x,crop.y,crop.w,crop.h)}
}
$('showHighlights').onchange=draw;
$('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>15*1024*1024){status('請選擇 15 MB 以內的 JPEG、PNG 或 WebP。');return}const url=URL.createObjectURL(f);try{const img=new Image();img.src=url;await img.decode();sourceImage=img;const c=$('canvas'),scale=Math.min(1,2200/img.width,2200/img.height);c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.hidden=false;crop=null;ocrRows=[];draw();$('ocr').disabled=false;report=[];$('results').replaceChildren();$('text').value='';status('圖片已載入；可先框選單一欄位，再辨識。')}catch{status('無法讀取圖片，請改用 JPEG 或 PNG。')}finally{URL.revokeObjectURL(url)}};
const point=e=>{const c=$('canvas'),r=c.getBoundingClientRect();return{x:Math.max(0,Math.min(c.width,(e.clientX-r.left)*c.width/r.width)),y:Math.max(0,Math.min(c.height,(e.clientY-r.top)*c.height/r.height))}};
$('canvas').onpointerdown=e=>{if(busy)return;start=point(e);$('canvas').setPointerCapture(e.pointerId)};$('canvas').onpointermove=e=>{if(!start)return;const p=point(e);crop={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(start.x-p.x),h:Math.abs(start.y-p.y)};draw()};$('canvas').onpointerup=()=>{start=null;if(crop&&(crop.w<15||crop.h<15))crop=null;draw()};$('canvas').onpointercancel=()=>{start=null};$('resetCrop').onclick=()=>{if(!busy){crop=null;draw()}};
function loadOCR(){if(window.Tesseract)return Promise.resolve();return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';const timer=setTimeout(()=>reject(Error('OCR 程式下載逾時')),30000);script.onload=()=>{clearTimeout(timer);resolve()};script.onerror=()=>{clearTimeout(timer);reject(Error('無法下載 OCR 程式'))};document.head.append(script)})}
$('ocr').onclick=async()=>{if(!sourceImage||busy)return;busy=true;ocrRows=[];draw();$('ocr').disabled=true;$('file').disabled=true;let worker=null,timer;try{status('正在載入辨識引擎…');await loadOCR();const c=$('canvas'),r=crop||{x:0,y:0,w:c.width,h:c.height};const target=document.createElement('canvas');target.width=Math.round(r.w);target.height=Math.round(r.h);const ctx=target.getContext('2d');ctx.drawImage(sourceImage,r.x*sourceImage.width/c.width,r.y*sourceImage.height/c.height,r.w*sourceImage.width/c.width,r.h*sourceImage.height/c.height,0,0,target.width,target.height);const pixels=ctx.getImageData(0,0,target.width,target.height);let avg=0;for(let i=0;i<pixels.data.length;i+=4)avg+=(pixels.data[i]+pixels.data[i+1]+pixels.data[i+2])/3;const invert=avg/(pixels.data.length/4)<125;for(let i=0;i<pixels.data.length;i+=4){let v=(pixels.data[i]+pixels.data[i+1]+pixels.data[i+2])/3;if(invert)v=255-v;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v}ctx.putImageData(pixels,0,0);
const operation=(async()=>{worker=await Tesseract.createWorker($('language').value,1,{logger:m=>status(m.status==='recognizing text'?'辨識中 '+Math.round(m.progress*100)+'%':'正在準備辨識資料…')});await worker.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:'11'});return worker.recognize(target,{}, {text:true,blocks:true})})();const result=await Promise.race([operation,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('辨識逾時，請縮小框選範圍後重試')),180000))]);ocrRows=layoutOCR(result.data.blocks,r,target.width,target.height);
if(!ocrRows.length)throw Error('沒有取得文字位置，無法排序與高亮；請縮小框選範圍重試');
const raw=ocrRows.map(row=>row.text).join('\n');
$('text').value=raw;
report=[];$('results').replaceChildren();draw();
status('已按逐行左→右、上→下排列 '+ocrRows.length+' 行，並以黃色標出文字。請核對部位分組後按「產生試調建議」。');
}catch(e){status((e.message||'辨識失敗')+'。也可直接貼上配方文字。')}finally{clearTimeout(timer);if(worker)await worker.terminate();busy=false;$('ocr').disabled=false;$('file').disabled=false}};
stock();

// OCR_LAYOUT_START
function layoutOCR(blocks,region,width,height){
 const words=[];
 for(const block of blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[]){
  const candidates=line.words?.length?line.words:[line];
  for(const word of candidates){
   const text=(word.text||'').trim(),b=word.bbox;
   if(!text||!b||![b.x0,b.y0,b.x1,b.y1].every(Number.isFinite)||b.x1<=b.x0||b.y1<=b.y0)continue;
   words.push({text,bbox:{x0:region.x+b.x0*region.w/width,y0:region.y+b.y0*region.h/height,x1:region.x+b.x1*region.w/width,y1:region.y+b.y1*region.h/height}});
  }
 }
 // Use vertical overlap with an immutable row anchor, not Tesseract's column order.
 words.sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0);
 const rows=[];
 for(const word of words){
  const b=word.bbox,h=b.y1-b.y0,cy=(b.y0+b.y1)/2;
  let best=null,score=Infinity;
  for(const row of rows){
   const a=row.anchor,ah=a.y1-a.y0,delta=Math.abs(cy-(a.y0+a.y1)/2);
   const overlap=Math.min(b.y1,a.y1)-Math.max(b.y0,a.y0);
   if(overlap>=Math.min(h,ah)*0.45&&delta<=Math.max(h,ah)*0.55&&delta<score){best=row;score=delta}
  }
  if(best)best.words.push(word);else rows.push({anchor:{...b},words:[word]});
 }
 rows.sort((a,b)=>a.anchor.y0-b.anchor.y0||a.anchor.x0-b.anchor.x0);
 return rows.map(row=>{
  row.words.sort((a,b)=>a.bbox.x0-b.bbox.x0);
  let text='';row.words.forEach((word,i)=>{
   if(i){const prev=row.words[i-1],gap=word.bbox.x0-prev.bbox.x1,h=Math.min(word.bbox.y1-word.bbox.y0,prev.bbox.y1-prev.bbox.y0);
    const cjk=/[\u3040-\u30ff\u3400-\u9fff]/;
    text+=gap>h*2?'　｜　':cjk.test(prev.text.slice(-1))&&cjk.test(word.text[0])?'':' ';
   }text+=word.text;
  });return {words:row.words,text};
 });
}
// OCR_LAYOUT_END
