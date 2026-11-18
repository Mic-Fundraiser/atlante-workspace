import * as T from 'three';
import {RoomEnvironment} from '/room.js';
const host=document.querySelector('.core-art');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let paused=reduced.matches;
const toggle=document.querySelector('#motion');
function setMotion(){
  host.classList.toggle('paused',paused);
  toggle.textContent=paused?'▶ Anima':'Ⅱ Pausa';
  toggle.setAttribute('aria-pressed',String(paused));
}
toggle.onclick=()=>{paused=!paused;setMotion();};
reduced.onchange=()=>{paused=reduced.matches;setMotion();};setMotion();
function rounded(shape,radius,half){
  const s=half,r=radius;
  shape.moveTo(-s+r,-s);shape.lineTo(s-r,-s);shape.quadraticCurveTo(s,-s,s,-s+r);
  shape.lineTo(s,s-r);shape.quadraticCurveTo(s,s,s-r,s);shape.lineTo(-s+r,s);
  shape.quadraticCurveTo(-s,s,-s,s-r);shape.lineTo(-s,-s+r);shape.quadraticCurveTo(-s,-s,-s+r,-s);
  return shape;
}
function init(){
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=T.ACESFilmicToneMapping;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(31,1,.1,100);
  camera.position.set(0,0,7.9);
  const studio=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer);
  scene.environment=pmrem.fromScene(studio,.03).texture;studio.dispose();pmrem.dispose();
  const shape=rounded(new T.Shape(),.33,1.13);shape.holes.push(rounded(new T.Path(),.18,.61));
  const geometry=new T.ExtrudeGeometry(shape,{depth:.09,bevelEnabled:true,bevelThickness:.045,bevelSize:.045,bevelSegments:4,curveSegments:20});
  const stack=new T.Group();scene.add(stack);
  for(const [i,color] of [0xa9c4b8,0x16866a,0x58c49c,0x176f59,0x8ce5b5,0xf4eee3].entries()){
    const metal=i===0||i===5;
    const material=new T.MeshPhysicalMaterial({color,metalness:metal?.86:.22,roughness:metal?.2:.12,clearcoat:1,transmission:metal?0:.4,thickness:.3,envMapIntensity:1.4});
    stack.add(new T.Mesh(geometry,material));
  }
  const glass=new T.MeshPhysicalMaterial({color:0x3fb389,roughness:.12,metalness:.18,transmission:.45,thickness:.5,clearcoat:1});
  const silver=new T.MeshStandardMaterial({color:0xe7ece3,metalness:.9,roughness:.22});
  const jade=new T.MeshPhysicalMaterial({color:0x147055,metalness:.36,roughness:.2,clearcoat:1});
  const light=new T.MeshStandardMaterial({color:0xabffce,emissive:0x3aba86,emissiveIntensity:.7,roughness:.2});
  function mesh(group,geometry,material,x=0,y=0,z=0){
    const m=new T.Mesh(geometry,material);m.position.set(x,y,z);group.add(m);return m;
  }
  function tile(w,h,depth,r=.08){
    const outline=rounded(new T.Shape(),r,.5);
    const geo=new T.ExtrudeGeometry(outline,{depth,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:3,curveSegments:8});
    geo.scale(w,h,1);return geo;
  }
  function rail(group,a,b,width,mat){
    const d=b.clone().sub(a);
    const m=mesh(group,new T.CylinderGeometry(width,width,d.length(),10),mat);
    m.position.copy(a).lerp(b,.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;
  }
  const prism=new T.Group(),map=new T.Group(),cache=new T.Group();
  scene.add(prism,map,cache);
  // Optical compressor: several incoming streams converge on one polished output.
  for(const [x,r,material] of [[-.28,.86,silver],[-.04,.72,glass],[.21,.56,jade]]){
    const rim=mesh(prism,new T.TorusGeometry(r,.083,16,88),material,x);
    rim.rotation.y=Math.PI/2;
  }
  const lens=mesh(prism,new T.SphereGeometry(.77,48,32),glass);
  lens.scale.x=.21;
  const beams=[],pulseGeometry=new T.SphereGeometry(.055,12,10);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4, y=Math.sin(a)*.81,z=Math.cos(a)*.81;
    const route=new T.CatmullRomCurve3([new T.Vector3(-1.8,y,z),new T.Vector3(-.83,y*.91,z*.91),new T.Vector3(.12,y*.31,z*.31),new T.Vector3(.66,0,0)]);
    mesh(prism,new T.TubeGeometry(route,26,.017,7,false),i%2?glass:jade);
    beams.push({route,pulse:mesh(prism,pulseGeometry,light)});
  }
  rail(prism,new T.Vector3(.65,0,0),new T.Vector3(1.57,0,0),.052,silver);
  const packet=mesh(prism,tile(.32,.43,.13),glass,1.43);
  // Map: raised project tiles, a central index, and a moving lookup signal.
  const origin=new T.Vector3(0,0,.15),routes=[];
  const hub=mesh(map,tile(.86,.86,.2),silver);hub.rotation.z=.13;
  mesh(map,tile(.58,.58,.12),glass,0,0,.24);
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3+.2;
    const pt=new T.Vector3(Math.cos(a)*1.44,Math.sin(a)*.97,.14+(i%2)*.13);
    const route=new T.CatmullRomCurve3([origin,pt.clone().multiplyScalar(.50).add(new T.Vector3(0,.09,.07)),pt]);
    mesh(map,new T.TubeGeometry(route,18,.023,8,false),silver);
    mesh(map,tile(.51,.4,.10),i%2?glass:jade,pt.x,pt.y,pt.z);
    mesh(map,tile(.21,.075,.035),silver,pt.x-.09,pt.y+.2,pt.z+.015);
    routes.push(route);
  }
  const cursor=mesh(map,new T.SphereGeometry(.085,16,12),light);
  // Cache: a circular magazine retrieves one previously indexed card.
  const track=mesh(cache,new T.TorusGeometry(.98,.12,18,96),silver);
  track.rotation.x=Math.PI/2;track.position.y=-.57;
  const cards=[];
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,g=new T.Group();cache.add(g);
    g.position.set(Math.sin(a)*.98,-.04,Math.cos(a)*.98);g.rotation.y=a;
    mesh(g,tile(.59,.90,.085),i===0?glass:i%2?jade:silver);
    for(let j=0;j<3;j++)mesh(g,tile(.33-j*.065,.032,.015),i%2?silver:jade,-j*.03,.19-j*.14,.115);
    cards.push(g);
  }
  const selector=document.querySelector('#sculpture');
  const sculptures={original:stack,prism,map,cache};
  function selectScene(){
    for(const [name,object] of Object.entries(sculptures))object.visible=name===selector.value;
    try{localStorage.setItem('atlante-sculpture',selector.value);}catch{}
  }
  try{const saved=localStorage.getItem('atlante-sculpture');if(Object.hasOwn(sculptures,saved))selector.value=saved;}catch{}
  selector.onchange=selectScene;selectScene();selector.parentElement.hidden=false;
  const key=new T.DirectionalLight(0xffffff,3);key.position.set(-3,4,5);scene.add(key);
  const rim=new T.DirectionalLight(0xb1ffda,2);rim.position.set(4,1,-2);scene.add(rim);
  host.prepend(renderer.domElement);
  let t=1,last=0,dx=0,dy=0,active=true;
  host.onpointermove=e=>{const r=host.getBoundingClientRect();dx=(e.clientX-r.left)/r.width-.5;dy=(e.clientY-r.top)/r.height-.5;};
  host.onpointerleave=()=>{dx=dy=0;};
  new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.z=Math.max(7.2,6.3/camera.aspect);camera.updateProjectionMatrix();}).observe(host);
  new IntersectionObserver(([entry])=>active=entry.isIntersecting).observe(host);
  renderer.setAnimationLoop(now=>{
    const dt=Math.min((now-last)/1000,.1);last=now;if(!active||document.hidden)return;
    if(!paused)t+=dt;
    stack.rotation.set(.20+Math.sin(t*.46)*.16+(paused?0:dy*.45),-.72+Math.sin(t*.56)*.46+(paused?0:dx*.7),-.13+Math.sin(t*.37)*.08);
    stack.children.forEach((layer,i)=>{layer.position.z=(i-2.5)*(.25+.095*Math.sin(t*.9));layer.rotation.z=Math.sin(t*.64+i*.4)*.055;});
    const lookX=paused?0:dx*.48,lookY=paused?0:dy*.24;
    prism.rotation.set(.16+lookY,-.36+Math.sin(t*.48)*.22+lookX,-.13);
    beams.forEach(({route,pulse},i)=>pulse.position.copy(route.getPointAt((t*.35+i/8)%1)));
    packet.rotation.y=t*.65;
    map.rotation.set(-.38+lookY,-.16+Math.sin(t*.42)*.18+lookX,-.09);
    const lookup=t*.55;cursor.position.copy(routes[Math.floor(lookup)%routes.length].getPointAt(lookup%1));
    cache.rotation.set(.28+lookY,-.38+t*.20+lookX,-.08);
    cards.forEach((card,i)=>card.position.y=-.04+.52*Math.pow(Math.max(0,Math.cos(t*.9-i*Math.PI/4)),7));
    renderer.render(scene,camera);host.classList.add('live');
  });
}
try{init();}catch{host.classList.add('layer-fallback');}
