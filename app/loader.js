(()=>{
  'use strict';
  const RAW_PARTS=["./app-js-01.txt", "./app-js-02.txt", "./app-js-03.txt", "./app-js-04.txt", "./app-js-05.txt", "./app-js-06.txt", "./app-js-07.txt", "./app-js-08.txt", "./app-js-09.txt"];
  const TAIL_PARTS=["./app-tail-01.bin", "./app-tail-02.bin", "./app-tail-03.bin", "./app-tail-04.bin", "./app-tail-05.bin", "./app-tail-06.bin", "./app-tail-07.bin", "./app-tail-08.bin"];
  const EXPECTED='c0f9fcd043e6c8e964d076748fdec363f18e8cb17b074fa5e86d050dd88b540b';
  const fail=error=>{
    console.error('[Pacefold loader]',error);
    const hour=document.getElementById('hour'),minute=document.getElementById('minute');
    const paint=()=>{const now=new Date();if(hour)hour.textContent=String(now.getHours()%12||12);if(minute)minute.textContent=String(now.getMinutes()).padStart(2,'0');document.title=now.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});};
    paint();setInterval(paint,1000);
    const dock=document.getElementById('setupDock');if(dock){dock.hidden=false;document.getElementById('setupTitle').textContent='Pacefold could not finish loading';document.getElementById('setupText').textContent='Reconnect and reload. Your local records remain on this device.';document.getElementById('setupPrimary').textContent='Reload';document.getElementById('setupPrimary').onclick=()=>location.reload();}
  };
  const fetchOk=async(url,type='text')=>{const response=await fetch(url,{cache:'no-cache'});if(!response.ok)throw new Error(`Application part failed: ${response.status}`);return type==='buffer'?response.arrayBuffer():response.text();};
  (async()=>{
    const [raw,buffers]=await Promise.all([Promise.all(RAW_PARTS.map(url=>fetchOk(url))),Promise.all(TAIL_PARTS.map(url=>fetchOk(url,'buffer')))]);
    if(!('DecompressionStream'in window))throw new Error('This Edge version is too old for the Pacefold offline package');
    const bytes=new Uint8Array(buffers.reduce((sum,b)=>sum+b.byteLength,0));let offset=0;for(const buffer of buffers){bytes.set(new Uint8Array(buffer),offset);offset+=buffer.byteLength;}
    const tail=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    const source=raw.join('')+tail;
    if(crypto&&crypto.subtle){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));const actual=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');if(actual!==EXPECTED)throw new Error('Application integrity check failed');}
    const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
    try{await import(url);}finally{URL.revokeObjectURL(url);}
  })().catch(fail);
})();
