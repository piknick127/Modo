// Official search + local PDF processing. No manual files are uploaded to a server.
let pdfDoc=null,pdfLib=null,pdfTask=null,pdfGeneration=0,pdfPageNumber=1,pdfWords=[],pdfPageInfo=[],pdfFilename='';
const pdfStatus=s=>$('pdfStatus').textContent=s;
function withPDFTimeout(promise,ms,message){let timer;return Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(message)),ms))]).finally(()=>clearTimeout(timer))}
function pdfBusy(value){for(const id of ['pdfFile','pdfPage','pdfPrev','pdfNext','extractPDF','file','ocr'])$(id).disabled=value;}
function clearPdfText(){pdfWords=[];ocrRows=[];report=[];$('text').value='';$('results').replaceChildren()}
function pdfRows(words){return layoutOCR([{paragraphs:[{lines:[{words:words.map(w=>({text:w.text,bbox:w.bbox}))}]}]}],{x:0,y:0,w:$('canvas').width,h:$('canvas').height},$('canvas').width,$('canvas').height)}
async function getPDFLibrary(){if(pdfLib)return pdfLib;const lib=await withPDFTimeout(import('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/build/pdf.mjs'),45000,'PDF 引擎下載逾時');lib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/build/pdf.worker.mjs';pdfLib=lib;return lib}
function wordFromPDF(item,styles,viewport,lib){
 if(!item.str?.trim())return null;
 const t=lib.Util.transform(viewport.transform,item.transform),h=Math.hypot(t[2],t[3]),angle=Math.atan2(t[1],t[0]);
 const style=styles[item.fontName]||{},ascent=Number.isFinite(style.ascent)?style.ascent:Number.isFinite(style.descent)?1+style.descent:.8;
 const width=Math.abs(item.width*viewport.scale),dx=Math.cos(angle),dy=Math.sin(angle),nx=-dy,ny=dx;
 const corners=[[0,-h*ascent],[width,-h*ascent],[0,h*(1-ascent)],[width,h*(1-ascent)]].map(([x,y])=>[t[4]+dx*x+nx*y,t[5]+dy*x+ny*y]);
 const bbox={x0:Math.min(...corners.map(c=>c[0])),x1:Math.max(...corners.map(c=>c[0])),y0:Math.min(...corners.map(c=>c[1])),y1:Math.max(...corners.map(c=>c[1]))};
 return {text:item.str,bbox};
}
async function showPDFPage(number){
 if(!pdfDoc||busy)return;busy=true;pdfBusy(true);const generation=pdfGeneration;
 try{clearPdfText();pdfStatus('正在顯示第 '+number+' 頁…');const page=await pdfDoc.getPage(number);const original=page.getViewport({scale:1});const scale=Math.min(3,2600/Math.max(original.width,original.height));const viewport=page.getViewport({scale});const surface=document.createElement('canvas');surface.width=Math.ceil(viewport.width);surface.height=Math.ceil(viewport.height);await page.render({canvasContext:surface.getContext('2d'),viewport}).promise;const text=await page.getTextContent();if(generation!==pdfGeneration)return;
 pdfPageNumber=number;pdfWords=text.items.map(item=>wordFromPDF(item,text.styles,viewport,pdfLib)).filter(Boolean);
 sourceImage=surface;sourceInfo={type:'pdf',filename:pdfFilename,page:number,method:'PDF text layer'};crop=null;const c=$('canvas');c.width=surface.width;c.height=surface.height;c.hidden=false;ocrRows=pdfRows(pdfWords);draw();$('pdfPage').value=String(number);
 const chars=pdfWords.map(w=>w.text).join('').length;pdfStatus(pdfFilename+' · 第 '+number+' / '+pdfDoc.numPages+' 頁 · '+(chars>=20?'有可擷取文字，可框選配方後按「擷取框選文字」。':'文字不足，請框選塗裝區後按「辨識圖片」。'));
 status('PDF 頁面已載入。黃色顯示可擷取文字；掃描圖片請使用 OCR。');
 }catch(e){pdfStatus('頁面讀取失敗：'+e.message)}finally{busy=false;pdfBusy(false);$('ocr').disabled=!sourceImage;$('extractPDF').disabled=!pdfWords.length}
}
$('manualSearch').onsubmit=e=>{e.preventDefault();try{const url=ManualCore.searchURL($('modelQuery').value);$('officialLink').href=url;$('officialLink').hidden=false;$('searchNote').textContent='搜尋詞：'+ManualCore.query($('modelQuery').value)+'。請確認等級、比例與版本；從官方頁取得 PDF 後在下方上傳。';window.open(url,'_blank','noopener,noreferrer')}catch(e){$('searchNote').textContent=e.message}};
$('pdfFile').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;if(busy){e.target.value='';return}if(!/\.pdf$/i.test(file.name)||file.size>40*1024*1024){pdfStatus('請選擇 40 MB 以內的 PDF');e.target.value='';return}
 busy=true;pdfBusy(true);const generation=++pdfGeneration;pdfFilename=file.name;
 try{clearPdfText();sourceImage=null;$('canvas').hidden=true;$('pdfControls').hidden=true;pdfStatus('正在載入 PDF 引擎…');const lib=await getPDFLibrary();if(pdfDoc)await pdfDoc.destroy();pdfDoc=null;pdfPageInfo=[];
 pdfTask=lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,cMapUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/cmaps/',cMapPacked:true,standardFontDataUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/standard_fonts/',wasmUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/wasm/'});
 pdfTask.onPassword=()=>{pdfTask.destroy();pdfStatus('此 PDF 需要密碼；請改用可直接開啟的官方 PDF。')};pdfDoc=await withPDFTimeout(pdfTask.promise,60000,'PDF 開啟逾時');
 if(pdfDoc.numPages>160){await pdfDoc.destroy();pdfDoc=null;throw Error('最多支援 160 頁，請先保留需要的頁面')}
 for(let n=1;n<=pdfDoc.numPages;n++){pdfStatus('搜尋塗裝資訊：'+n+' / '+pdfDoc.numPages+' 頁');const page=await pdfDoc.getPage(n);const tc=await page.getTextContent();const text=tc.items.map(i=>i.str||'').join(' ');pdfPageInfo.push({page:n,chars:text.replace(/\s/g,'').length,...ManualCore.scorePage(text)});page.cleanup();}
 if(generation!==pdfGeneration)return;
 const select=$('pdfPage');select.replaceChildren();for(const info of pdfPageInfo){const op=document.createElement('option');op.value=info.page;op.textContent='第 '+info.page+' 頁'+(info.candidate?' ★ 可能含塗裝資訊':info.chars<20?' · 掃描／少文字':'');select.append(op)}
 const candidates=pdfPageInfo.filter(i=>i.candidate).sort((a,b)=>b.score-a.score||a.page-b.page);$('pdfSummary').textContent=candidates.length?'找到 '+candidates.length+' 個候選頁（依關鍵字及百分比，需核對原頁）。':'未從文字層找到塗裝標題。可能是掃描版、文字轉曲線或沒有塗裝指引；請切換頁碼查看，不能判定文件沒有配方。';$('pdfControls').hidden=false;busy=false;await showPDFPage(candidates[0]?.page||1);
 }catch(e){if(pdfTask){try{await pdfTask.destroy()}catch{}}pdfDoc=null;pdfWords=[];sourceImage=null;$('canvas').hidden=true;pdfStatus('PDF 載入失敗：'+e.message+'。請確認網路或改上傳塗裝頁圖片。')}finally{busy=false;pdfBusy(false);$('ocr').disabled=!sourceImage;$('extractPDF').disabled=!pdfWords.length;e.target.value=''}
};
$('pdfPage').onchange=e=>showPDFPage(Number(e.target.value));$('pdfPrev').onclick=()=>showPDFPage(Math.max(1,pdfPageNumber-1));$('pdfNext').onclick=()=>showPDFPage(Math.min(pdfDoc.numPages,pdfPageNumber+1));
$('extractPDF').onclick=()=>{
 const words=ManualCore.filterWords(pdfWords,crop);if(!words.length){pdfStatus('選取區域沒有可讀文字，請使用「辨識圖片」。');return}
 ocrRows=pdfRows(words);const blocks=ManualCore.recipeBlocks(ocrRows);$('text').value=blocks.map(b=>b.text).join('\n\n');report=[];$('results').replaceChildren();draw();status('已直接擷取 PDF 第 '+pdfPageNumber+' 頁文字，按區塊分組。請核對色名、比例與部位後產生建議。');
};
// Image upload exits PDF mode, keeping one authoritative source for highlights.
$('file').addEventListener('change',()=>{if(busy)return;pdfGeneration++;pdfWords=[];$('pdfControls').hidden=true;$('pdfStatus').textContent='';});
