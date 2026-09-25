import{id,el}from'./state.js';

// The atmosphere: one canvas that paints the live weather over the daily photo on
// Clock and on the start page. Rain falls in three depths, slanted by the real
// wind, and splashes; storms add lightning; snow drifts; fog and cloud shadows
// roll across; clear nights get twinkling stars and the odd shooting star; clear
// days get slow motes of light near the sun. Everything parts around the cursor.
// It pauses when the page is hidden, stays still with reduced motion, and the
// command bar can preview any weather for a few seconds.
const KIND=code=>{const c=Number(code);if(!Number.isFinite(c))return'clear';if(c===0||c===1)return'clear';if(c===2||c===3)return'cloudy';if(c===45||c===48)return'fog';if(c>=51&&c<=57)return'drizzle';if((c>=61&&c<=67)||(c>=80&&c<=82))return'rain';if((c>=71&&c<=77)||c===85||c===86)return'snow';if(c>=95)return'storm';return'cloudy'};
const rand=(a,b)=>a+Math.random()*(b-a);

export function installAtmosphere(ctx){
  if(id('atmosphere'))return;
  const root=document.documentElement,calm=matchMedia('(prefers-reduced-motion: reduce)');
  const canvas=el('canvas','atmosphere');canvas.id='atmosphere';canvas.setAttribute('aria-hidden','true');
  const sky=id('sky');(sky||document.body).append(canvas);
  const g=canvas.getContext('2d',{alpha:true});if(!g)return;
  root.dataset.atmosphere='canvas';

  let sunX=.7,W=0,H=0,dpr=1,kind='clear',night=false,wind=0,intensity=.6,preview=null,previewUntil=0;
  let drops=[],splashes=[],flakes=[],motes=[],stars=[],clouds=[],fogs=[],meteor=null,flash=0,bolt=null,nextBolt=0,nextMeteor=0;
  const pointer={x:-999,y:-999,active:false};

  // Follow the start page when it is showing, so the weather is on both surfaces.
  const cover=id('pace-cover');
  const place=()=>{const on=root.dataset.cover==='on'&&cover;const parent=on?cover:(sky||document.body);if(canvas.parentElement!==parent){if(on)cover.querySelector('.cover-backdrop')?.after(canvas);else parent.append(canvas)}};
  new MutationObserver(place).observe(root,{attributes:true,attributeFilter:['data-cover']});

  const resize=()=>{dpr=Math.min(1.5,devicePixelRatio||1);W=innerWidth;H=innerHeight;canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);g.setTransform(dpr,0,0,dpr,0,0);seed()};
  const area=()=>Math.max(.35,Math.min(1.6,(W*H)/(1440*900)));

  function seed(){
    const k=preview||kind,n=area();
    drops=[];splashes=[];flakes=[];motes=[];clouds=[];fogs=[];
    if(k==='rain'||k==='storm'||k==='drizzle'){
      const count=Math.round((k==='drizzle'?140:k==='storm'?520:360)*n*(.6+intensity*.6));
      for(let i=0;i<count;i+=1){const z=Math.random();drops.push({x:rand(-100,W+100),y:rand(-H,H),z,len:(k==='drizzle'?6:12)+z*(k==='drizzle'?8:22),v:(k==='drizzle'?5:9)+z*(k==='storm'?16:12)})}
    }
    if(k==='snow'){const count=Math.round(220*n);for(let i=0;i<count;i+=1){const z=Math.random();flakes.push({x:rand(0,W),y:rand(-H,H),z,r:.8+z*2.8,v:.35+z*1.1,phase:rand(0,Math.PI*2),sway:rand(.4,1.4)})}}
    if(k==='cloudy'||k==='storm'||k==='rain'){const count=k==='cloudy'?7:5;for(let i=0;i<count;i+=1)clouds.push({x:rand(-.2,1.2)*W,y:rand(-.05,.55)*H,r:rand(.18,.34)*Math.max(W,H),v:rand(.05,.16),a:k==='cloudy'?rand(.08,.16):rand(.12,.22)})}
    if(k==='fog'){for(let i=0;i<6;i+=1)fogs.push({x:rand(0,W),y:rand(.35,.95)*H,r:rand(.3,.55)*W,v:rand(.08,.25)*(Math.random()<.5?-1:1),a:rand(.12,.22)})}
    if(k==='clear'&&!night){const count=Math.round(46*n);for(let i=0;i<count;i+=1)motes.push({x:rand(0,W),y:rand(0,H),r:rand(1,3.4),v:rand(.05,.25),phase:rand(0,Math.PI*2)})}
    if(night&&(k==='clear'||k==='cloudy'&&!preview)){stars=[];const count=Math.round(90*n);for(let i=0;i<count;i+=1)stars.push({x:rand(0,W),y:rand(0,H*.6),r:rand(.6,1.9),phase:rand(0,Math.PI*2),speed:rand(.6,2.2)})}else stars=[];
  }

  const read=()=>{
    const forecast=ctx.weekForecast?.(),current=forecast?.current||{};
    const nextKind=KIND(current.weather_code??forecast?.daily?.weather_code?.[0]);
    const state=ctx.skyState?.(),nextNight=state?!state.day:false;
    wind=Math.max(-1,Math.min(1,(Number(current.wind_speed_10m)||8)/40))*(Math.sin(((Number(current.wind_direction_10m)||250)-180)*Math.PI/180)>=0?1:-1);
    intensity=Math.max(.2,Math.min(1,(Number(current.precipitation)||0)/3+.5));
    if(nextKind!==kind||nextNight!==night){kind=nextKind;night=nextNight;seed()}
    sunX=(parseFloat(getComputedStyle(root).getPropertyValue('--sun-x'))||70)/100;
    root.dataset.atmosphereKind=preview||kind;
  };
  ctx.previewAtmosphere=(what,seconds=20)=>{previewUntil=Date.now()+seconds*1000;if(what==='night'){preview='clear';night=true;for(const[k,v]of[['--sky-shade','.6'],['--sky-stars','1'],['--sky-top','rgb(5,11,26)'],['--sky-mid','rgb(11,26,51)']])root.style.setProperty(k,v)}else preview=what;seed();root.dataset.atmosphereKind=preview;ctx.toast?.(`Previewing ${what} for ${seconds} seconds`)};

  addEventListener('pointermove',event=>{pointer.x=event.clientX;pointer.y=event.clientY;pointer.active=true},{passive:true});
  document.addEventListener('pointerleave',()=>{pointer.active=false;pointer.x=pointer.y=-999});

  // Lightning: a jagged bolt from the top, a brief white flash, then darkness.
  const makeBolt=()=>{const pts=[];let x=rand(.15,.85)*W,y=0;pts.push([x,y]);while(y<H*rand(.45,.75)){x+=rand(-40,40);y+=rand(18,46);pts.push([x,y])}return{pts,life:1}};

  let last=performance.now();
  function frame(now){
    requestAnimationFrame(frame);
    if(document.hidden)return;
    const dt=Math.min(2.5,(now-last)/16.67);last=now;
    if(preview&&Date.now()>previewUntil){preview=null;ctx.paintSky?.();read();seed()}
    const k=preview||kind;
    g.clearRect(0,0,W,H);
    if(calm.matches){drawStill(k);return}

    // Cloud shadows and fog drift first, underneath everything else.
    for(const c of clouds){c.x+=c.v*dt*(wind>=0?1:-1);if(c.x-c.r>W)c.x=-c.r;if(c.x+c.r<0)c.x=W+c.r;const gr=g.createRadialGradient(c.x,c.y,0,c.x,c.y,c.r);gr.addColorStop(0,`rgba(12,18,30,${c.a})`);gr.addColorStop(1,'rgba(12,18,30,0)');g.fillStyle=gr;g.fillRect(c.x-c.r,c.y-c.r,c.r*2,c.r*2)}
    for(const f of fogs){f.x+=f.v*dt;if(f.x-f.r>W)f.x=-f.r;if(f.x+f.r<0)f.x=W+f.r;const gr=g.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r);gr.addColorStop(0,`rgba(226,232,240,${f.a})`);gr.addColorStop(1,'rgba(226,232,240,0)');g.fillStyle=gr;g.fillRect(f.x-f.r,f.y-f.r,f.r*2,f.r*2)}

    if(stars.length){for(const s of stars){s.phase+=.02*s.speed*dt;const a=.35+.45*Math.sin(s.phase);g.fillStyle=`rgba(255,255,255,${a.toFixed(3)})`;g.beginPath();g.arc(s.x,s.y,s.r,0,Math.PI*2);g.fill()}
      if(!meteor&&now>nextMeteor){meteor={x:rand(.2,.9)*W,y:rand(.02,.25)*H,vx:-rand(9,14),vy:rand(3,5),life:1};nextMeteor=now+rand(14000,32000)}
      if(meteor){meteor.x+=meteor.vx*dt;meteor.y+=meteor.vy*dt;meteor.life-=.018*dt;const tail=g.createLinearGradient(meteor.x,meteor.y,meteor.x-meteor.vx*9,meteor.y-meteor.vy*9);tail.addColorStop(0,`rgba(255,255,255,${Math.max(0,meteor.life)})`);tail.addColorStop(1,'rgba(255,255,255,0)');g.strokeStyle=tail;g.lineWidth=1.6;g.beginPath();g.moveTo(meteor.x,meteor.y);g.lineTo(meteor.x-meteor.vx*9,meteor.y-meteor.vy*9);g.stroke();if(meteor.life<=0)meteor=null}}

    if(motes.length){const sx=sunX*W;for(const m of motes){m.phase+=.01*dt;m.y-=m.v*dt;m.x+=Math.sin(m.phase)*.3*dt;if(m.y<-10){m.y=H+10;m.x=rand(0,W)}const near=Math.max(0,1-Math.abs(m.x-sx)/(W*.45));const a=.08+.32*near;g.fillStyle=`rgba(255,236,190,${a.toFixed(3)})`;g.beginPath();g.arc(m.x,m.y,m.r,0,Math.PI*2);g.fill()}}

    if(drops.length){
      const slant=wind*6+ (k==='storm'?-3:-1.5);
      g.lineCap='round';
      for(const d of drops){
        d.y+=d.v*dt;d.x+=slant*(.4+d.z*.6)*dt;
        // Rain parts around the cursor, like drops on glass.
        if(pointer.active){const dx=d.x-pointer.x,dy=d.y-pointer.y,dist=Math.hypot(dx,dy);if(dist<90){d.x+=dx/dist*(90-dist)*.18}}
        if(d.y>H){if(d.z>.55&&Math.random()<.35)splashes.push({x:d.x,y:H-rand(0,H*.18),r:0,life:1});d.y=rand(-120,-10);d.x=rand(-100,W+100)}
        g.strokeStyle=`rgba(210,226,255,${(.12+d.z*.38).toFixed(3)})`;g.lineWidth=.6+d.z*1.1;
        g.beginPath();g.moveTo(d.x,d.y);g.lineTo(d.x-slant*d.len/10,d.y-d.len);g.stroke();
      }
      for(let i=splashes.length-1;i>=0;i-=1){const s=splashes[i];s.r+=.9*dt;s.life-=.05*dt;if(s.life<=0){splashes.splice(i,1);continue}g.strokeStyle=`rgba(220,232,255,${(s.life*.4).toFixed(3)})`;g.lineWidth=1;g.beginPath();g.ellipse(s.x,s.y,s.r*2.2,s.r*.6,0,0,Math.PI*2);g.stroke()}
    }

    if(flakes.length){for(const f of flakes){f.phase+=.02*dt;f.y+=f.v*dt;f.x+=(Math.sin(f.phase)*f.sway+wind*1.2)*.6*dt;
      if(pointer.active){const dx=f.x-pointer.x,dy=f.y-pointer.y,dist=Math.hypot(dx,dy);if(dist<110){f.x+=dx/dist*(110-dist)*.05;f.y+=dy/dist*(110-dist)*.02}}
      if(f.y>H+6){f.y=-6;f.x=rand(0,W)}if(f.x>W+6)f.x=-6;if(f.x<-6)f.x=W+6;
      g.fillStyle=`rgba(255,255,255,${(.35+f.z*.55).toFixed(3)})`;g.beginPath();g.arc(f.x,f.y,f.r,0,Math.PI*2);g.fill()}}

    if(k==='storm'){
      if(now>nextBolt){bolt=makeBolt();flash=1;nextBolt=now+rand(6000,14000)}
      if(flash>0){g.fillStyle=`rgba(230,236,255,${(flash*.35).toFixed(3)})`;g.fillRect(0,0,W,H);flash-=.08*dt}
      if(bolt){g.strokeStyle=`rgba(245,248,255,${Math.max(0,bolt.life).toFixed(3)})`;g.lineWidth=2.4;g.shadowColor='rgba(180,200,255,.9)';g.shadowBlur=18;g.beginPath();bolt.pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();g.shadowBlur=0;bolt.life-=.07*dt;if(bolt.life<=0)bolt=null}
    }
  }
  // Reduced motion: a single still impression of the weather, no movement.
  function drawStill(k){
    if(k==='rain'||k==='storm'||k==='drizzle'){g.strokeStyle='rgba(210,226,255,.22)';g.lineWidth=1;for(const d of drops.slice(0,160)){g.beginPath();g.moveTo(d.x,d.y);g.lineTo(d.x+2,d.y-d.len);g.stroke()}}
    if(k==='snow'){g.fillStyle='rgba(255,255,255,.6)';for(const f of flakes.slice(0,140)){g.beginPath();g.arc(f.x,f.y,f.r,0,Math.PI*2);g.fill()}}
    for(const s of stars){g.fillStyle='rgba(255,255,255,.5)';g.beginPath();g.arc(s.x,s.y,s.r,0,Math.PI*2);g.fill()}
  }

  addEventListener('resize',resize);
  resize();read();place();
  window.addEventListener('pacefold:week',read);setInterval(read,60000);
  requestAnimationFrame(frame);
}
