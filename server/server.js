import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createMagicEngine } from '../magic.js';

process.on('uncaughtException', err => console.error('❌', err));

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const httpServer = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.join(ROOT, path.normalize(url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ===== Блоки =====
const AIR=0, GRASS=1, DIRT=2, STONE=3, WOOD=4, LEAVES=5, PLANKS=6, SAND=7, GRAVEL=8, COAL_ORE=9, IRON_ORE=10;

// ===== Ники =====
const ADJ = ["Весёлый","Храбрый","Тихий","Быстрый","Умный","Смелый","Добрый","Злой","Магический","Ледяной","Огненный","Тёмный","Светлый","Летающий","Подземный","Древний","Могучий"];
const NOUNS = ["Волшебник","Маг","Чародей","Колдун","Шаман","Друид","Некромант","Иллюзионист","Алхимик","Варлок","Магистр","Архимаг","Мистик","Заклинатель"];
const rand = arr => arr[Math.floor(Math.random() * arr.length)];
const randomNickname = () => `${rand(ADJ)}${rand(NOUNS)}${Math.floor(Math.random()*1000)}`;

// ===== Перлин (упрощённый для краткости) =====
const PERM = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
const p = new Array(512); for(let i=0;i<256;i++) p[i]=p[i+256]=PERM[i];
const fade=t=>t*t*t*(t*(t*6-15)+10), lerp=(t,a,b)=>a+t*(b-a);
const grad=(h,x,y,z)=>{ h&=15; const u=h<8?x:y, v=h<4?y:(h===12||h===14?x:z); return ((h&1)?-u:u)+((h&2)?-v:v); };
function noise(x,y,z){
  let X=Math.floor(x)&255, Y=Math.floor(y)&255, Z=Math.floor(z)&255;
  x-=Math.floor(x); y-=Math.floor(y); z-=Math.floor(z);
  const u=fade(x),v=fade(y),w=fade(z);
  const A=p[X]+Y, AA=p[A]+Z, AB=p[A+1]+Z, B=p[X+1]+Y, BA=p[B]+Z, BB=p[B+1]+Z;
  return lerp(w, lerp(v, lerp(u, grad(p[AA],x,y,z), grad(p[BA],x-1,y,z)), lerp(u, grad(p[AB],x,y-1,z), grad(p[BB],x-1,y-1,z))),
               lerp(v, lerp(u, grad(p[AA+1],x,y,z-1), grad(p[BA+1],x-1,y,z-1)), lerp(u, grad(p[AB+1],x,y-1,z-1), grad(p[BB+1],x-1,y-1,z-1))));
}

let seed = Math.floor(Math.random()*10000);
const edits = new Map();
const players = new Map();
let nextId = 1;

// ===== Высота и биомы =====
const terrainHeight = (wx,wz) => {
  let h = 24;
  h += noise(wx/80+seed, wz/80+seed,0)*16;
  h += noise(wx/30+seed, wz/30+seed,100)*6;
  h += noise(wx/12+seed, wz/12+seed,200)*2;
  const biome = noise(wx*0.005+seed, wz*0.005+seed,300);
  if (biome < -0.25) h = Math.max(24, Math.min(35, 28 + noise(wx/50+seed, wz/50+seed,400)*3));
  else if (biome > 0.35) h = Math.max(45, Math.min(63, h + noise(wx/20+seed, wz/20+seed,150)*20 + Math.abs(noise(wx/6+seed, wz/6+seed,250))*12));
  else h = Math.max(20, Math.min(50, h + noise(wx/25+seed, wz/25+seed,300)*6));
  return Math.max(1, Math.min(63, Math.floor(h)));
};
const getBiome = (wx,wz) => { const v=noise(wx*0.005+seed, wz*0.005+seed,300); return v<-0.25?'desert':v>0.35?'mountain':'forest'; };
const getBlock = (x,y,z) => {
  if(y<0||y>=64) return AIR;
  const key=`${x},${y},${z}`;
  if(edits.has(key)) return edits.get(key);
  const h=terrainHeight(x,z);
  if(y<h){
    if(y===h-1) return getBiome(x,z)==='desert'?SAND:GRASS;
    if(y>=h-4) return DIRT;
    if(y<40 && noise(x*0.1,y*0.1,z*0.1)>0.85) return IRON_ORE;
    if(y<60 && noise(x*0.12,y*0.12,z*0.12)>0.7) return COAL_ORE;
    return STONE;
  }
  return AIR;
};

// ===== Генерация деревьев =====
const generateBigTree = (ed, cx, cz, groundY) => {
  const h=5+Math.floor(Math.random()*3), sx=Math.floor(cx), sz=Math.floor(cz), sy=groundY;
  for(let i=0;i<h;i++){
    const y=sy+i; if(y>=64) break;
    for(let dx=-1;dx<=1;dx++) for(let dz=-1;dz<=1;dz++){
      const x=sx+dx, z=sz+dz;
      if(dx===0 && dz===0) ed.set(`${x},${y},${z}`, WOOD);
      else if(i<h-1) ed.set(`${x},${y},${z}`, WOOD);
    }
  }
  const cy=sy+h-1, r=3;
  for(let dy=-2;dy<=2;dy++) for(let dx=-r;dx<=r;dx++) for(let dz=-r;dz<=r;dz++)
    if(Math.hypot(dx,dz,dy)<=r+0.5){
      const x=sx+dx, z=sz+dz, y=cy+dy;
      if(y>=0&&y<64 && (getBlock(x,y,z)===AIR||getBlock(x,y,z)===LEAVES)) ed.set(`${x},${y},${z}`, LEAVES);
    }
  for(let dy=-1;dy<=1;dy++){ const y=cy+dy; if(y>=0&&y<64) ed.set(`${sx},${y},${sz}`, WOOD); }
};
for(let cx=-20;cx<=20;cx++) for(let cz=-20;cz<=20;cz++)
  if(Math.random()<0.1 && getBiome(cx*16+8, cz*16+8)==='forest'){
    const gy=terrainHeight(cx*16+8, cz*16+8);
    if(gy<55) generateBigTree(edits, cx*16+8, cz*16+8, gy);
  }

// ===== Вспомогательные функции =====
const send=(ws,t,d)=> ws.readyState===1 && ws.send(JSON.stringify({type:t,...d}));
const broadcast=(t,d,ex=null)=>{ const m=JSON.stringify({type:t,...d}); for(const[id,q]of players) if(id!==ex && q.ws.readyState===1) q.ws.send(m); };
const syncEffects=q=> send(q.ws,'effects',{list:[...q.effects].map(([e,v])=>({e,until:v.until,power:v.power}))});

// ===== Урон =====
const applyDamage = (targetId, dmg, src={}) => {
  const t=players.get(targetId); if(!t) return;
  let weapon=src.weapon||'неизвестного оружия', attackerId=src.attackerId, attacker=attackerId?players.get(attackerId):null;
  if(weapon.includes('огн') && t.effects.has('fire_resist')) dmg*=(1-t.effects.get('fire_resist').power);
  if(t.effects.has('vulnerability')) dmg*=1.5;
  if(t.effects.has('weakness')) dmg*=0.5;
  const ward=t.effects.get('ward');
  if(ward && dmg>0){ const a=Math.min(ward.power,dmg); ward.power-=a; dmg-=a; if(ward.power<=0) t.effects.delete('ward'); syncEffects(t); }
  dmg*=1-0.04*(t.armor+(t.effects.get('stoneskin')?.power||0));
  if(dmg<=0 && !src.kb) return;
  if(t.effects.has('ice_skin') && attackerId && attackerId!==targetId && attacker && !attacker.effects.has('freeze'))
    attacker.effects.set('freeze',{until:Date.now()+(t.effects.get('ice_skin').power||2)*1000,power:1}), syncEffects(attacker);
  if(t.chainLink && players.has(t.chainLink) && dmg>0){
    const linked=players.get(t.chainLink);
    if(linked && linked!==t && linked.hp>0) applyDamage(t.chainLink, dmg*(t.chainTransfer||0.5), {...src,weapon:'цепочки послушания',kb:0});
  }
  if(t.sphereReflect && attackerId && attackerId!==targetId && attacker && attacker.hp>0)
    applyDamage(attackerId, dmg*t.sphereReflect, {weapon:'отражённый урон',attackerId:targetId});
  const wasAlive=t.hp>0;
  t.hp-=Math.max(0,dmg);
  if(t.hp<=4 && !t.phoenixUsed && t.effects.has('phoenix')){
    t.phoenixUsed=true; t.hp=8;
    broadcast('systemMessage',{message:`${t.nickname} возродился как Феникс!`});
    broadcast('hp',{id:targetId,hp:t.hp});
    for(const[p]of players) if(p!==targetId && Math.hypot(t.x-p.x,t.z-p.z)<8){
      p.effects.set('blind',{until:Date.now()+5000,power:1}); p.effects.set('fear',{until:Date.now()+5000,power:1}); syncEffects(p);
    }
    return;
  }
  if(t.hp<=0 && wasAlive){
    t.hp=50; t.effects.clear(); syncEffects(t); broadcast('respawn',{id:targetId}); broadcast('hp',{id:targetId,hp:50}); t.phoenixUsed=false;
    const killMsg=attackerId && attackerId!==targetId && attacker ? `${attacker.nickname} убил ${t.nickname} с помощью ${weapon}` : `${t.nickname} погиб`;
    broadcast('systemMessage',{message:killMsg}); if(attackerId && attackerId!==targetId && attacker) console.log(killMsg);
  } else if(dmg>0){
    broadcast('hp',{id:targetId,hp:t.hp});
    send(t.ws,'damaged',{ax:src.ax??t.x,az:src.az??t.z,hp:t.hp,kb:src.kb??6});
  }
};

// ===== Зоны, тотемы, замедление времени =====
const activeZones=new Map(), timeSlowZones=new Map(), activeTotems=new Map();
const addZone=(x,z,r,eff,owner,dur)=>{ const id=Math.random(); activeZones.set(id,{x,z,radius:r,effect:eff,owner,until:Date.now()+dur*1000}); setTimeout(()=>activeZones.delete(id),dur*1000); broadcast('zoneSpawn',{id,x,z,radius:r,effect:eff,duration:dur}); };
const addTimeSlowZone=(casterId,x,z,r,dur)=>{ const id=Math.random(); timeSlowZones.set(id,{x,z,radius:r,endTime:Date.now()+dur*1000,casterId}); broadcast('timeSlowZone',{zoneId:id,x,z,radius:r,duration:dur}); setTimeout(()=>timeSlowZones.delete(id),dur*1000); };
const addTotem=(casterId,x,z,r,dur)=>{
  const id=Math.random(); let last=Date.now();
  const itv=setInterval(()=>{
    const now=Date.now();
    if(now-last>=3000){ last=now;
      const inRange=[...players.values()].filter(p=>p.id!==casterId && Math.hypot(p.x-x,p.z-z)<r);
      if(inRange.length){ const t=inRange[Math.floor(Math.random()*inRange.length)];
        t.effects.set('speed',{until:now+5000,power:1.5}); syncEffects(t);
        broadcast('totemCharge',{targetId:t.id,casterId}); broadcast('totemPower',{targetId:t.id,power:6});
      }
    }
  },3000);
  activeTotems.set(id,{x,z,radius:r,endTime:Date.now()+dur*1000,casterId,interval:itv});
  broadcast('totemSpawn',{id,x,z,radius:r,duration:dur});
  setTimeout(()=>{ const t=activeTotems.get(id); if(t){ clearInterval(t.interval); activeTotems.delete(id); broadcast('totemEnd',{id}); } },dur*1000);
};

// ===== Контекст магии =====
const magicCtx = {
  getBlock:(x,y,z)=>getBlock(x,y,z),
  setBlock(x,y,z,t){ edits.set(`${x},${y},${z}`,t); broadcast('blockUpdate',{x,y,z,t}); },
  terrainHeight,
  getPlayers:()=>[...players].map(([id,q])=>[id,{x:q.x,y:q.y,z:q.z}]),
  applyDamage,
  addEffect(id,type,dur,power){
    const q=players.get(id); if(!q) return;
    const pv=power?.power??power;
    q.effects.set(type,{until:Date.now()+dur*1000,power:pv, ...(type==='regen'?{lastTick:Date.now()}:{})});
    if(type==='phoenix') q.phoenixUsed=false;
    syncEffects(q);
  },
  healPlayer(id,a){ const q=players.get(id); if(!q||q.effects.has('curse')) return; q.hp=Math.min(50,q.hp+a); broadcast('hp',{id,hp:q.hp}); },
  clearDebuffs(id){ const q=players.get(id); if(q){ for(const b of ['burning','slow','freeze','curse','blind','weakness','vulnerability','disorient','disarm','shadow_shackles']) q.effects.delete(b); syncEffects(q); } },
  getMana:id=>players.get(id)?.mana??0,
  spendMana(id,c){ const q=players.get(id); if(q){ q.mana-=c; send(q.ws,'mana',{mana:Math.floor(q.mana)}); } },
  teleportPlayer(id,x,y,z){ const q=players.get(id); if(q){ q.x=x; q.y=y; q.z=z; broadcast('teleport',{id,x:q.x,y:q.y,z:q.z}); } },
  emit:(t,d)=>broadcast(t,d),
  addZone, addTotem, addTimeSlowZone,
  chainPlayers:(cId,tId,trans=0.5)=>{ const c=players.get(cId), t=players.get(tId); if(!c||!t) return false; if(c.chainLink) delete players.get(c.chainLink)?.chainLink; if(t.chainLink) delete players.get(t.chainLink)?.chainLink; c.chainLink=tId; t.chainLink=cId; c.chainTransfer=trans; t.chainTransfer=trans; broadcast('chainLink',{id1:cId,id2:tId}); return true; },
  swapPositions:(id1,id2)=>{ const p1=players.get(id1), p2=players.get(id2); if(p1&&p2){ [p1.x,p2.x]=[p2.x,p1.x]; [p1.y,p2.y]=[p2.y,p1.y]; [p1.z,p2.z]=[p2.z,p1.z]; broadcast('teleport',{id:id1,x:p1.x,y:p1.y,z:p1.z}); broadcast('teleport',{id:id2,x:p2.x,y:p2.y,z:p2.z}); broadcast('swapFx',{id1,id2}); } },
  createProtectionSphere:(cId,x,y,z,dur)=>{
    const c=players.get(cId); if(!c) return;
    c.sphereEnd=Date.now()+dur*1000; c.sphereReflect=0.5;
    broadcast('sphereSpawn',{casterId:cId,x,y,z,radius:3,duration:dur});
    const itv=setInterval(()=>{ if(!c||Date.now()>c.sphereEnd){ clearInterval(itv); if(c) c.sphereReflect=null; broadcast('sphereEnd',{casterId:cId}); return; }
      for(const[id,p]of players) if(Math.hypot(p.x-x,p.z-z)<3 && p.y>y-1&&p.y<y+2){ p.hp=Math.min(50,p.hp+2); broadcast('hp',{id,hp:p.hp}); }
    },1000);
    setTimeout(()=>{ clearInterval(itv); if(c) c.sphereReflect=null; broadcast('sphereEnd',{casterId:cId}); },dur*1000);
  },
  summonAsteroid:(cId,x,z,yaw)=>{
    const ix=x+Math.sin(yaw)*3, iz=z+Math.cos(yaw)*3;
    broadcast('asteroidStart',{casterId:cId,x:ix,z:iz,startY:60});
    setTimeout(()=>{
      const rad=5, dmg=18;
      for(const[id,p]of players) if(id!==cId && Math.hypot(p.x-ix,p.z-iz)<rad*1.6){
        const d2=(p.x-ix)**2+(p.y+0.9)**2+(p.z-iz)**2; if(d2<(rad*1.6)**2) applyDamage(id, dmg*(1-Math.sqrt(d2)/(rad*1.6)), {ax:ix,az:iz,kb:6+rad,attackerId:cId,weapon:'астероида'});
      }
      for(let dx=-rad;dx<=rad;dx++) for(let dz=-rad;dz<=rad;dz++) if(Math.hypot(dx,dz)<rad){
        const bx=Math.floor(ix+dx), bz=Math.floor(iz+dz), y=terrainHeight(bx,bz);
        for(let h=0;h<Math.max(1,rad-Math.floor(Math.hypot(dx,dz)));h++){ edits.set(`${bx},${y+h},${bz}`,STONE); broadcast('blockUpdate',{x:bx,y:y+h,z:bz,t:STONE}); }
      }
      broadcast('asteroidImpact',{x:ix,z:iz,radius:rad});
    },1500);
  },
  stomp:(cId,x,z,r)=>{ broadcast('stompFx',{x,z,radius:r}); for(const[id,p]of players) if(id!==cId && Math.hypot(p.x-x,p.z-z)<r){ p.y+=3; broadcast('teleport',{id,x:p.x,y:p.y,z:p.z}); applyDamage(id,8,{ax:x,az:z,kb:12,attackerId:cId,weapon:'топота'}); p.effects.set('disarm',{until:Date.now()+5000,power:1}); syncEffects(p); } },
  blackVortex:(cId,x,z,dur)=>{
    broadcast('vortexSpawn',{vortexId:Math.random(),x,z,radius:4,duration:dur});
    const end=Date.now()+dur*1000;
    const itv=setInterval(()=>{ if(Date.now()>end){ clearInterval(itv); broadcast('vortexEnd',{}); return; }
      for(const[id,p]of players) if(id!==cId && Math.hypot(p.x-x,p.z-z)<6) applyDamage(id,6,{ax:x,az:z,kb:5,attackerId:cId,weapon:'чёрного вихря'});
    },1000);
  },
  lightCage:(cId,tId)=>{ broadcast('cageSpawn',{casterId:cId,targetId:tId}); const end=Date.now()+6000; const itv=setInterval(()=>{ if(Date.now()>end){ clearInterval(itv); broadcast('cageEnd',{targetId:tId}); return; } applyDamage(tId,4,{ax:0,az:0,kb:0,attackerId:cId,weapon:'световой клетки'}); },1000); },
  shadowShackles:(cId,tId)=>{ const t=players.get(tId); if(t){ t.effects.set('shadow_shackles',{until:Date.now()+6000,power:1}); syncEffects(t); broadcast('shacklesFx',{targetId:tId}); } },
  dragonBreath:(cId,o,dir,yaw,cone=Math.PI/3,dist=8,dmg=8,kb=10)=>{
    for(const[id,p]of players) if(id!==cId){
      const dx=p.x-o.x, dz=p.z-o.z, d=Math.hypot(dx,dz);
      if(d>dist) continue;
      const fwd={x:Math.sin(yaw),z:Math.cos(yaw)}, dot=(dx*fwd.x+dz*fwd.z)/d;
      if(dot>=Math.cos(cone)){
        applyDamage(id,dmg,{ax:o.x,az:o.z,kb,attackerId:cId,weapon:'дыхания дракона'});
        const q=players.get(id);
        if(q){ q.effects.set('burning',{until:Date.now()+4000,power:1}); q.effects.set('freeze',{until:Date.now()+2000,power:1}); q.effects.set('weakness',{until:Date.now()+5000,power:0.7}); syncEffects(q); }
        broadcast('dragonBreathFx',{from:o,to:p});
      }
    }
    broadcast('dragonBreathCone',{origin:o,dir,yaw});
  },
};
const magic = createMagicEngine(magicCtx);

// ===== Тик (50 мс) =====
const TICK=50; let lastManaSync=0;
setInterval(()=>{
  const now=Date.now(), dt=TICK/1000;
  for(const[id,q]of players){
    let changed=false;
    for(const[e,v]of q.effects) if(now>v.until){ q.effects.delete(e); changed=true; }
    const regen=q.effects.get('regen');
    if(regen && now>=(regen.lastTick+1000)){ regen.lastTick=now; if(!q.effects.has('curse')){ q.hp=Math.min(50,q.hp+regen.power); broadcast('hp',{id,hp:q.hp}); } }
    const aura=q.effects.get('fire_aura');
    if(aura){
      q.lastAuraTick=q.lastAuraTick||0;
      if(now-q.lastAuraTick>=1000){
        q.lastAuraTick=now; const rad=aura.radius||3, dmg=aura.power;
        for(const[pid,p]of players) if(pid!==id && Math.hypot(q.x-p.x,q.z-p.z)<rad){
          applyDamage(pid,dmg,{attackerId:id,weapon:'огненной ауры',kb:0});
          if(!p.effects.has('burning')){ p.effects.set('burning',{until:now+3000,power:1}); syncEffects(p); }
        }
      }
    }
    const burn=q.effects.get('burning');
    if(burn){ q.burnAcc=(q.burnAcc||0)+dt; if(q.burnAcc>=1){ q.burnAcc-=1; applyDamage(id,burn.power,{kb:0}); } }
    if(changed) syncEffects(q);
    q.mana=Math.min(20, q.mana+dt);
  }
  for(const[id,z]of activeZones){
    if(now>z.until){ activeZones.delete(id); broadcast('zoneEnd',{id}); continue; }
    if(z.effect==='levitate_circle') for(const[pid,p]of players) if(Math.hypot(p.x-z.x,p.z-z.z)<z.radius && !p.effects.has('levitate')){ p.effects.set('levitate',{until:now+500,power:1}); syncEffects(p); }
  }
  for(const[id,z]of timeSlowZones){
    if(now>z.endTime){ timeSlowZones.delete(id); continue; }
    for(const[pid,p]of players) if(pid!==z.casterId && Math.hypot(p.x-z.x,p.z-z.z)<z.radius && !p.effects.has('time_slow')){ p.effects.set('time_slow',{until:now+500,power:0.5}); syncEffects(p); }
  }
  if(now-lastManaSync>1000){ lastManaSync=now; for(const q of players.values()) send(q.ws,'mana',{mana:Math.floor(q.mana)}); }
  magic.tick(dt);
}, TICK);

// ===== WebSocket =====
const wss = new WebSocketServer({ server: httpServer });
wss.on('connection', ws => {
  const id = nextId++, nickname = randomNickname();
  players.set(id, { id, ws, nickname, x:0.5, y:80, z:0.5, yaw:0, hp:50, armor:0, mana:20, lastAttack:0, effects:new Map(), phoenixUsed:false });
  console.log(`+ ${nickname} (${id}) · ${players.size}`);
  send(ws,'init',{
    id, nickname, seed, edits:[...edits],
    snapshot: magic.getSnapshot(),
    players:[...players].filter(([pid])=>pid!==id).map(([pid,q])=>({id:pid, nickname:q.nickname, x:q.x, y:q.y, z:q.z, yaw:q.yaw})),
    zones:[...activeZones].map(([zid,z])=>({id:zid, x:z.x, z:z.z, radius:z.radius, effect:z.effect})),
    timeSlowZones:[...timeSlowZones].map(([zid,z])=>({id:zid, x:z.x, z:z.z, radius:z.radius, duration:(z.endTime-Date.now())/1000})),
  });
  broadcast('join',{id,nickname},id);
  ws.on('message', raw => {
    let msg; try{ msg=JSON.parse(raw); }catch{ return; }
    const q=players.get(id); if(!q) return;
    switch(msg.type){
      case 'move': q.x=msg.x; q.y=msg.y; q.z=msg.z; q.yaw=msg.yaw; broadcast('move',{id,x:q.x,y:q.y,z:q.z,yaw:q.yaw},id); break;
      case 'setBlock': edits.set(`${msg.x},${msg.y},${msg.z}`,msg.t); broadcast('blockUpdate',{x:msg.x,y:msg.y,z:msg.z,t:msg.t},id); break;
      case 'attack':
        const t=players.get(msg.target);
        const now=Date.now();
        if(!t || now-q.lastAttack<400 || Math.hypot(q.x-t.x,q.z-t.z)>6) return;
        q.lastAttack=now;
        if(q.effects.has('chain_lightning') && Math.random()<(q.effects.get('chain_lightning').power||0.2)){
          applyDamage(msg.target,6,{ax:q.x,az:q.z,kb:5,attackerId:id,weapon:'разряда'});
          const cand=[...players.values()].filter(p=>p.id!==id && p.id!==msg.target && Math.hypot(p.x-t.x,p.z-t.z)<5);
          if(cand.length){ const next=cand[0]; applyDamage(next.id,4,{ax:q.x,az:q.z,kb:3,attackerId:id,weapon:'разряда (перескок)'}); broadcast('lightningEffect',{from:msg.target,to:next.id}); }
          else broadcast('lightningEffect',{from:id,to:msg.target});
        }
        applyDamage(msg.target,4,{ax:q.x,az:q.z,kb:8,attackerId:id,weapon:'меча'});
        break;
      case 'cast': magic.cast(id, msg.elements, msg.dir, {x:q.x,y:q.y+1.62,z:q.z}, q.yaw); break;
      case 'chat': broadcast('chat',{senderId:id,senderNick:q.nickname,message:msg.message},id); break;
      case 'shadow_step':
        let nearest=null, minDist=Infinity;
        for(const[pid,p]of players) if(pid!==id && Math.hypot(q.x-p.x,q.z-p.z)<10){ const d=Math.hypot(q.x-p.x,q.z-p.z); if(d<minDist){ minDist=d; nearest=p; } }
        if(nearest){
          const dirX=-Math.sin(nearest.yaw), dirZ=-Math.cos(nearest.yaw);
          const tx=nearest.x+dirX*1.5, tz=nearest.z+dirZ*1.5, ty=terrainHeight(tx,tz)+1;
          const oldX=q.x, oldZ=q.z;
          q.x=tx; q.y=ty; q.z=tz;
          broadcast('teleport',{id,x:q.x,y:q.y,z:q.z});
          broadcast('shadowStepFx',{x0:oldX,z0:oldZ,x1:q.x,z1:q.z});
          broadcast('systemMessage',{message:`${q.nickname} использовал Теневой шаг`});
        } else send(q.ws,'systemMessage',{message:'Нет цели для теневого шага'});
        break;
      case 'swap_positions':
        const target=players.get(msg.target);
        if(target && Math.hypot(q.x-target.x,q.z-target.z)<10) magicCtx.swapPositions(id,msg.target);
        break;
    }
  });
  ws.on('close',()=>{ players.delete(id); broadcast('leave',{id}); console.log(`- ${nickname} (${id}) · ${players.size}`); });
});

const PORT = process.env.PORT || 8081;
httpServer.listen(PORT, () => console.log(`✅ Игра: http://localhost:${PORT} · сид ${seed}`));