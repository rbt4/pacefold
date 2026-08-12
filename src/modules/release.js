export function installRelease(ctx){
  document.documentElement.dataset.release=ctx.RELEASE;
  document.title='Clock';
  const appName=document.querySelector('meta[name="application-name"]');if(appName)appName.content='Clock';
  const brand=document.querySelector('.brand');
  if(brand){brand.setAttribute('aria-label','Return to Clock');const title=brand.querySelector('strong'),tagline=brand.querySelector('small');if(title)title.textContent='Clock';if(tagline){tagline.textContent='';tagline.hidden=true}}
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const replacements=[];
  while(walker.nextNode()){
    const node=walker.currentNode;
    if(node.nodeValue?.includes('Pacefold 25.1.0'))replacements.push(node);
  }
  for(const node of replacements)node.nodeValue=node.nodeValue.replaceAll('Pacefold 25.1.0',`Pacefold ${ctx.RELEASE}`);
  const baseBackup=ctx.currentBackup;
  if(typeof baseBackup==='function')ctx.currentBackup=()=>{
    const payload=baseBackup();
    return{...payload,release:ctx.RELEASE,revision:ctx.REVISION};
  };
}
