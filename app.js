const members=[
 {name:'Association Executive',role:'President',type:'leadership',initial:'AE',bio:'Direction, governance and community representation.'},
 {name:'Community Secretary',role:'Secretary',type:'leadership',initial:'CS',bio:'Records, communication and coordination.'},
 {name:'Treasury Desk',role:'Treasurer',type:'leadership',initial:'TD',bio:'Responsible handling of association finances.'},
 {name:'Programme Coordinator',role:'Coordinator',type:'leadership',initial:'PC',bio:'Turns ideas into schedules, teams and action.'},
 {name:'Youth Volunteer',role:'Volunteer',type:'volunteer',initial:'YV',bio:'Community activities and on-ground support.'},
 {name:'Digital Volunteer',role:'Volunteer',type:'volunteer',initial:'DV',bio:'Digital tools, documentation and communication.'},
 {name:'Sports Volunteer',role:'Volunteer',type:'volunteer',initial:'SV',bio:'Sports, events and youth participation.'},
 {name:'Community Member',role:'Member',type:'member',initial:'CM',bio:'An active member of the BTYA community.'}
];
const boardItems=[
 {type:'announcement',label:'Update',title:'The digital home is live',body:'BTYA now has a central place for community information, participation and future member services.',date:'10 Sep 2026'},
 {type:'schedule',label:'Schedule',title:'Planning board · next session',body:'A future calendar will publish meetings, activities and important dates in one shared view.',date:'Coming soon'},
 {type:'announcement',label:'Membership',title:'Account and membership are separate',body:'Anyone can create an account. Becoming a BTYA member requires a separate registration and approval process.',date:'Planning note'},
 {type:'announcement',label:'Community desk',title:'Feedback and reports have a home',body:'Use the community desk to raise an issue, share feedback or propose an idea.',date:'Open now'},
 {type:'schedule',label:'Roadmap',title:'Member services · phase 02',body:'Authentication, member applications, role permissions and shared data are planned as the next platform layer.',date:'Next build'}
];
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function renderMembers(){const q=($('#memberSearch')?.value||'').toLowerCase().trim();const active=$('.filter.active')?.dataset.role||'all';const list=members.filter(m=>(active==='all'||m.type===active)&&(m.name+m.role+m.bio).toLowerCase().includes(q));$('#memberGrid').innerHTML=list.map(m=>`<article class="member"><div class="avatar">${m.initial}</div><span class="member-role">${m.role}</span><h3>${m.name}</h3><p>${m.bio}</p></article>`).join('')||'<div class="member" style="grid-column:1/-1"><h3>No match.</h3><p>Try another name or role.</p></div>'}
function renderBoard(filter='all'){const list=filter==='all'?boardItems:boardItems.filter(x=>x.type===filter);$('#boardGrid').innerHTML=list.map(x=>`<article class="board-card"><span class="board-type">${x.label}</span><h3>${x.title}</h3><p>${x.body}</p><span class="board-date">${x.date}</span></article>`).join('')}
$$('.filter').forEach(b=>b.addEventListener('click',()=>{$$('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderMembers()}));
$('#memberSearch')?.addEventListener('input',renderMembers);
$$('.board-switch button').forEach(b=>b.addEventListener('click',()=>{$$('.board-switch button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderBoard(b.dataset.board)}));
const mobile=$('#mobileMenu');$('#menuBtn')?.addEventListener('click',()=>{mobile.classList.add('open');mobile.setAttribute('aria-hidden','false')});$('#closeMenu')?.addEventListener('click',()=>{mobile.classList.remove('open');mobile.setAttribute('aria-hidden','true')});$$('.mobile-menu a').forEach(a=>a.addEventListener('click',()=>mobile.classList.remove('open')));
function openModal(id){const el=$('#'+id);if(!el)return;el.classList.add('open');el.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}function closeModal(el){el.classList.remove('open');el.setAttribute('aria-hidden','true');document.body.style.overflow=''}
$$('[data-modal]').forEach(b=>b.addEventListener('click',()=>{mobile?.classList.remove('open');openModal(b.dataset.modal)}));$$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.closest('.modal-backdrop'))));$$('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m)}));document.addEventListener('keydown',e=>{if(e.key==='Escape'){mobile?.classList.remove('open');$$('.modal-backdrop.open').forEach(closeModal)}});
$$('[data-switch]').forEach(b=>b.addEventListener('click',()=>{closeModal(b.closest('.modal-backdrop'));openModal(b.dataset.switch)}));
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}$$('[data-demo]').forEach(b=>b.addEventListener('click',()=>toast('UI ready — authentication/backend is intentionally not connected yet.')));
// Three.js: restrained procedural sculpture with mouse/touch parallax.
let scene,camera,renderer,group,core,ring,particles,raf;const canvas=$('#heroCanvas');const stage=$('#heroStage');
function init3D(){if(!canvas||!window.THREE)return;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(34,1,.1,100);camera.position.set(0,0,6.5);renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));group=new THREE.Group();scene.add(group);
 const geo=new THREE.IcosahedronGeometry(1.55,2);const mat=new THREE.MeshStandardMaterial({color:0x9fd64d,roughness:.24,metalness:.68,wireframe:true,transparent:true,opacity:.68});core=new THREE.Mesh(geo,mat);group.add(core);
 ring=new THREE.Mesh(new THREE.TorusGeometry(2.05,.012,8,160),new THREE.MeshBasicMaterial({color:0xc9ff63,transparent:true,opacity:.7}));ring.rotation.x=.72;group.add(ring);
 const ring2=ring.clone();ring2.scale.set(.78,.78,.78);ring2.rotation.x=-.5;ring2.rotation.y=.7;ring2.material=ring.material.clone();ring2.material.opacity=.42;group.add(ring2);
 const count=700,pos=new Float32Array(count*3);for(let i=0;i<count;i++){const r=2.6+Math.random()*2.1,a=Math.random()*Math.PI*2,b=Math.acos(2*Math.random()-1);pos[i*3]=r*Math.sin(b)*Math.cos(a);pos[i*3+1]=r*Math.sin(b)*Math.sin(a);pos[i*3+2]=r*Math.cos(b)}const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pos,3));particles=new THREE.Points(pg,new THREE.PointsMaterial({color:0xd9f6ad,size:.018,transparent:true,opacity:.55}));group.add(particles);
 scene.add(new THREE.AmbientLight(0xb8d5a0,.9));const light=new THREE.PointLight(0xc9ff63,4,12);light.position.set(2,2,3);scene.add(light);resize3D();animate3D();window.addEventListener('resize',resize3D);let tx=0,ty=0;const move=e=>{const r=stage.getBoundingClientRect();const p=e.touches?e.touches[0]:e;tx=((p.clientX-r.left)/r.width-.5)*.9;ty=((p.clientY-r.top)/r.height-.5)*.6};stage.addEventListener('pointermove',move);stage.addEventListener('touchmove',move,{passive:true});stage.addEventListener('pointerleave',()=>{tx=0;ty=0});function animate3D(){raf=requestAnimationFrame(animate3D);group.rotation.y+=(tx-group.rotation.y)*.035;group.rotation.x+=(-ty-group.rotation.x)*.035;core.rotation.z+=.002;ring.rotation.z+=.004;particles.rotation.y-=.0006;renderer.render(scene,camera)}}
function resize3D(){const r=stage.getBoundingClientRect();camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false)}
init3D();renderMembers();renderBoard();
