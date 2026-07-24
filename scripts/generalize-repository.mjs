import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'.');
const file=path.join(root,'README.md');
let source=fs.readFileSync(file,'utf8');
const replaceExact=(needle,replacement,label,expected=1)=>{const count=source.split(needle).length-1;if(count!==expected)throw new Error(`${label}: expected ${expected}, found ${count}`);source=source.split(needle).join(replacement);};

replaceExact(
  'Pacefold is a local-first, installable workday rhythm system. The verified core keeps the clock, schedule and one next useful action primary. Pacefold 15.8 brings the HSSys notebook, current cue, capture, contained media, weather, OneNote and diagnostics into one quiet integrated dock without turning the workday into another dashboard.',
  'Pacefold is a local-first, installable workday rhythm system for anyone who wants a calmer day without another dashboard. The verified core keeps the clock, schedule and one next useful action primary; the integrated dock adds a local notebook, capture, contained media, weather, optional OneNote and diagnostics only when requested.',
  'README introduction');
replaceExact('## Capture and HSSys notebook','## Capture and local notebook','README capture heading');
replaceExact('Unprefixed notes go to Daily. The full dated HSSys notebook retains search, section tabs, editing, completion and deletion.','Unprefixed notes go to Daily. The full dated local notebook retains search, section tabs, editing, completion and deletion.','README notebook copy');
replaceExact('The intended destination remains the **HSSys** notebook and a **Pacefold** section. Identical page sends share one in-flight request, cross-window locks end when the real request settles or safely times out, and failed delivery never removes the local page. Pacefold does not store Microsoft passwords or access tokens.','The destination is the OneNote notebook and section the user chooses. Identical page sends share one in-flight request, cross-window locks end when the real request settles or safely times out, and failed delivery never removes the local page. Pacefold does not store Microsoft passwords or access tokens.','README OneNote destination');

if(!source.includes('## Original developer preset')){
  const marker='## Functional taskbar state';
  const section=`## Original developer preset\n\nPacefold is designed for everyone, but it ships with the creator-tested Original preset so the first run is useful rather than empty. Its defaults remain an 8:30 a.m.–4:30 p.m. workday, location-calculated Muslim moments with Hanafi Asr in Toronto, a 24 oz hydration target, a 30-minute noodles preparation cue, a 20-minute desk meal, 20-minute eye cues and 45-minute movement cues. Setup can replace any or all of these immediately with Everyday, Mindfulness, another faith-aware profile or a fully custom rhythm.\n\n`;
  replaceExact(marker,section+marker,'README original preset insertion');
}

fs.writeFileSync(file,source);
console.log('Generalized the public repository description while preserving the Original developer preset.');
