(function(root){
const aliases=[['紅異端','アストレイ レッドフレーム'],['紅色異端','アストレイ レッドフレーム'],['異端紅色機','アストレイ レッドフレーム'],['藍異端','アストレイ ブルーフレーム'],['金異端','アストレイ ゴールドフレーム'],['沙薩比','サザビー'],['獨角獸','ユニコーン'],['異端','アストレイ'],['鋼彈','ガンダム']];
function query(input){let text=input.normalize('NFKC').trim();for(const [a,b] of aliases)text=text.replaceAll(a,b);return text.slice(0,180)}
function searchURL(input){const text=query(input);if(!text)throw Error('請輸入模型名稱、品番或 JAN 條碼');const u=new URL('https://manual.bandai-hobby.net/');u.searchParams.set('freeword',text);u.searchParams.set('sort','new');return u.href}
function scorePage(text){const s=text.normalize('NFKC').replace(/\s/g,'').toUpperCase();const markers=['COLORGUIDE','COLOURGUIDE','COLORCHART','PAINTINGGUIDE','カラーガイド','カラーチャート','塗装色','塗裝指引','配色指引'];const hits=markers.filter(x=>s.includes(x));const percentages=(s.match(/\d+(?:\.\d+)?%/g)||[]).length;return{score:hits.length*20+Math.min(percentages,10)*2,hits,percentages,candidate:hits.length>0||percentages>=3}}
function filterWords(words,crop){if(!crop)return words;return words.filter(w=>{const b=w.bbox,x=(b.x0+b.x1)/2,y=(b.y0+b.y1)/2;return x>=crop.x&&x<=crop.x+crop.w&&y>=crop.y&&y<=crop.y+crop.h})}
// Split each visual row on large horizontal gaps, then join aligned segments into blocks.
// Prevent the left and right recipes being interleaved by whole-page row ordering.
function recipeBlocks(rows){
 const segments=[];
 for(const row of rows){let group=[];for(const word of row.words){const last=group.at(-1);const h=Math.max(1,word.bbox.y1-word.bbox.y0);if(last&&word.bbox.x0-last.bbox.x1>h*2){segments.push(group);group=[]}group.push(word)}if(group.length)segments.push(group)}
 const blocks=[];
 for(const words of segments){const box={x0:Math.min(...words.map(w=>w.bbox.x0)),x1:Math.max(...words.map(w=>w.bbox.x1)),y0:Math.min(...words.map(w=>w.bbox.y0)),y1:Math.max(...words.map(w=>w.bbox.y1))};
  const text=words.map(w=>w.text).join(' ').replace(/([\u3040-\u30ff\u3400-\u9fff])\s+(?=[\u3040-\u30ff\u3400-\u9fff])/g,'$1');
  const heading=/の塗装色|部.*塗装|^[^%]*[:：]\s*$/.test(text);let chosen=null,distance=Infinity;
  if(!heading)for(const block of blocks){const prev=block.last,h=Math.max(1,prev.y1-prev.y0,box.y1-box.y0),dy=box.y0-prev.y1;const overlap=Math.min(box.x1,prev.x1)-Math.max(box.x0,prev.x0);if(dy>=-h*.25&&dy<h*1.8&&overlap>0&&Math.abs(box.x0-prev.x0)<h*3&&dy<distance){chosen=block;distance=dy}}
  if(chosen){chosen.lines.push(text);chosen.last=box}else blocks.push({box,last:box,lines:[text]});
 }
 return blocks.map(b=>({text:b.lines.join('\n'),bbox:b.box}));
}
const api={query,searchURL,scorePage,filterWords,recipeBlocks};root.ManualCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
