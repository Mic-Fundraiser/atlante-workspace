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
    renderer.render(scene,camera);host.classList.add('live');
  });
}
try{init();}catch{host.classList.add('layer-fallback');}
