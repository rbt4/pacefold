export function installRelease(ctx){
  document.documentElement.dataset.release=ctx.RELEASE;
  document.title='Clock';
  const appName=document.querySelector('meta[name="application-name"]');if(appName)appName.content='Clock';
  const brand=document.querySelector('.brand');
  if(brand){brand.setAttribute('aria-label','Return to Clock');const title=brand.querySelector('strong'),tagline=brand.querySelector('small');if(title)title.textContent='Clock';if(tagline){tagline.textContent='';tagline.hidden=true}}
  const restore=document.getElementById('cover-return');if(restore){restore.setAttribute('aria-label','Return to start surface');const label=restore.querySelector('span');if(label)label.textContent='Start'}
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),replacements=[];
  while(walker.nextNode()){
    const node=walker.currentNode;
    if(/Pacefold\s+\d+\.\d+\.\d+/.test(node.nodeValue||''))replacements.push(node);
  }
  for(const node of replacements)node.nodeValue=node.nodeValue.replace(/Pacefold\s+\d+\.\d+\.\d+/g,`Pacefold ${ctx.RELEASE}`);
  if(ctx.log&&ctx.KEYS?.log){ctx.log.version=ctx.RELEASE;localStorage.setItem(ctx.KEYS.log,JSON.stringify(ctx.log))}
  const baseBackup=ctx.currentBackup;
  if(typeof baseBackup==='function')ctx.currentBackup=()=>{
    const payload=baseBackup();
    return{...payload,release:ctx.RELEASE,revision:ctx.REVISION};
  };
}
