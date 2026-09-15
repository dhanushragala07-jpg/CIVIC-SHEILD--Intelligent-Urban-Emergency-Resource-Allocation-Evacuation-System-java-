const REGIONS=["Riverside","Hillview","Central","Lakeside","Eastbank","Industrial Area","Greenfield"];
const shelters={"Riverside":"Riverside Relief Centre","Hillview":"Hillview Community Shelter","Central":"Central Civic Shelter","Lakeside":"Lakeside Relief Centre","Eastbank":"Eastbank Safe Shelter","Industrial Area":"Industrial Zone Shelter","Greenfield":"Greenfield Community Shelter"};
const edges={"Riverside":[["Hillview",4],["Central",6]],"Hillview":[["Riverside",4],["Central",3],["Eastbank",4]],"Central":[["Riverside",6],["Hillview",3],["Lakeside",4],["Industrial Area",5]],"Lakeside":[["Central",4],["Eastbank",3],["Greenfield",5]],"Eastbank":[["Hillview",4],["Lakeside",3],["Industrial Area",2],["Greenfield",6]],"Industrial Area":[["Central",5],["Eastbank",2],["Greenfield",3]],"Greenfield":[["Lakeside",5],["Eastbank",6],["Industrial Area",3]]};
const multipliers={FLOOD:1.12,FIRE:1.18,MEDICAL:1.20,HEAT:1.08};
const KEY="civicshield_final_incidents";
let incidents=JSON.parse(localStorage.getItem(KEY)||"[]");
const $=id=>document.getElementById(id);
function score(x){return Math.min(100,(Math.min(35,x.people/40)+Math.min(25,x.vulnerable/20)+x.medical*2+x.risk*3)*(multipliers[x.type]||1));}
function recommendation(s){if(s>=85)return "Immediate Response";if(s>=70)return "High Priority";if(s>=55)return "Respond Soon";return "Monitor Closely";}
function riskWord(n){return n>=9?"Extreme":n>=7?"High":n>=4?"Moderate":"Low";}
function sorted(){return [...incidents].sort((a,b)=>score(b)-score(a));}
function save(){localStorage.setItem(KEY,JSON.stringify(incidents));}
function fillRegions(){["incidentRegion","routeFrom","routeTo"].forEach(id=>{const el=$(id);el.innerHTML=REGIONS.map(r=>`<option value="${r}">${r}</option>`).join("");});$("routeTo").value="Central";}
function render(){
 $("activeCount").textContent=incidents.length;
 $("affectedTotal").textContent=incidents.reduce((a,x)=>a+x.people,0).toLocaleString();
 $("vulnerableTotal").textContent=incidents.reduce((a,x)=>a+x.vulnerable,0).toLocaleString();
 const q=$("queue"); const arr=sorted();
 q.innerHTML=arr.length?arr.map((x,i)=>{const s=score(x);return `<tr><td>${i+1}</td><td><b>${esc(x.id)}</b></td><td>${typeName(x.type)}</td><td>${esc(x.region)}</td><td>${x.people.toLocaleString()}</td><td>${x.vulnerable.toLocaleString()}</td><td>${riskWord(x.risk)}</td><td>${s.toFixed(1)}</td><td class="recommendation">${recommendation(s)}</td></tr>`}).join(""): `<tr><td colspan="9" class="empty">No incidents yet. Report an emergency to begin.</td></tr>`;
 buildAllocation();
}
function typeName(t){return ({FLOOD:"Flood",FIRE:"Fire",MEDICAL:"Medical",HEAT:"Heat Wave"})[t]||t}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
$("medical").addEventListener("change",()=>{});
$("incidentForm").addEventListener("submit",e=>{e.preventDefault();
 const x={id:$('incidentId').value.trim(),type:$('incidentType').value,region:$('incidentRegion').value,people:+$('people').value,vulnerable:+$('vulnerable').value,medical:+$('medical').value,risk:+$('risk').value};
 if(!x.id||!x.type||!x.region||!x.people||!x.medical||!x.risk){alert("Please complete all emergency fields.");return}
 if(x.vulnerable<0||x.vulnerable>x.people){alert("Vulnerable people cannot be greater than people affected.");return}
 if(incidents.some(i=>i.id.toLowerCase()===x.id.toLowerCase())){alert("That Emergency ID already exists.");return}
 incidents.push(x);save();const s=score(x);$('analysis').classList.remove('hidden');$('analysis').innerHTML=`<strong>${s.toFixed(1)} / 100</strong><div><b>${recommendation(s)}</b> for ${esc(x.region)} • ${typeName(x.type)}</div><small>The system calculated this automatically. The incident has been placed in the priority queue.</small>`;render();$('incidentForm').reset();$('medical').value="";$('risk').value="";
});
function numOptions(n){return Array.from({length:n+1},(_,i)=>`<option value="${i}">${i}</option>`).join("");}
function buildAllocation(){
 const A=Math.max(0,+$('ambInput').value||0),T=Math.max(0,+$('teamInput').value||0),K=Math.max(0,+$('kitInput').value||0),B=Math.max(0,+$('busInput').value||0);
 $('availableAmb').textContent=A;$('availableTeams').textContent=T;$('availableKits').textContent=K;$('availableBuses').textContent=B;
 const arr=sorted();if(!arr.length){$('allocation').innerHTML='<div class="empty">Report incidents first, then choose exact quantities for each emergency.</div>';return;}
 $('allocation').innerHTML=arr.map((x,i)=>`<div class="allocation-card" data-id="${esc(x.id)}"><div class="allocation-head"><span>${i+1}. ${esc(x.id)} • ${typeName(x.type)} • ${esc(x.region)}</span><b>${score(x).toFixed(1)}</b></div><div class="allocation-controls"><label>Ambulances<select data-r="amb">${numOptions(A)}</select></label><label>Rescue Teams<select data-r="team">${numOptions(T)}</select></label><label>Medical Kits<select data-r="kit">${numOptions(K)}</select></label><label>Evac Buses<select data-r="bus">${numOptions(B)}</select></label></div><div class="allocation-summary">Choose the exact quantities to send to this emergency.</div></div>`).join("");
 document.querySelectorAll('.allocation-card select').forEach(s=>s.addEventListener('change',allocationChanged));
}
function allocationChanged(e){const card=e.target.closest('.allocation-card');const vals=[...card.querySelectorAll('select')].map(s=>+s.value);card.querySelector('.allocation-summary').textContent=`Sending ${vals[0]} ambulance(s), ${vals[1]} rescue team(s), ${vals[2]} medical kit(s) and ${vals[3]} evacuation bus(es).`;
 const limits={amb:+$('ambInput').value||0,team:+$('teamInput').value||0,kit:+$('kitInput').value||0,bus:+$('busInput').value||0};Object.keys(limits).forEach(k=>{let used=0;document.querySelectorAll(`select[data-r="${k}"]`).forEach(s=>used+=+s.value);if(used>limits[k])e.target.closest('.allocation-card').querySelector('.allocation-summary').textContent+=` Warning: total ${k} allocation is above available supply.`;});}
['ambInput','teamInput','kitInput','busInput'].forEach(id=>$(id).addEventListener('input',buildAllocation));
$('resetResources').onclick=()=>{$('ambInput').value=6;$('teamInput').value=4;$('kitInput').value=210;$('busInput').value=3;buildAllocation();};
$('saveAllocation').onclick=()=>{if(!incidents.length){$('allocationStatus').textContent='Add at least one emergency before saving an allocation.';}else{$('allocationStatus').textContent='Allocation saved for this session. Quantities selected above will be used for the response plan.';}$('allocationStatus').classList.remove('hidden');};
function route(){const start=$('routeFrom').value,end=$('routeTo').value;if(start===end){$('routeResult').innerHTML='<b>Shortest Safe Route</b><div class="path">You are already in this region.</div>';return;}
 const blocked=[...document.querySelectorAll('.blocked-box input:checked')].map(x=>x.value);const isBlocked=(a,b)=>blocked.includes(`${a}|${b}`)||blocked.includes(`${b}|${a}`);const dist={},prev={},unvisited=new Set(REGIONS);REGIONS.forEach(r=>dist[r]=Infinity);dist[start]=0;
 while(unvisited.size){let u=[...unvisited].sort((a,b)=>dist[a]-dist[b])[0];if(dist[u]===Infinity)break;unvisited.delete(u);if(u===end)break;for(const [v,w] of edges[u]){if(isBlocked(u,v))continue;const nd=dist[u]+w;if(nd<dist[v]){dist[v]=nd;prev[v]=u;}}}
 if(dist[end]===Infinity){$('routeResult').innerHTML='<b>No safe route available.</b><span>Choose another destination or restore a blocked road.</span>';return;}let path=[],c=end;while(c){path.unshift(c);c=prev[c];}$('routeResult').innerHTML=`<b>Shortest Safe Route</b><div class="path">${path.join(' → ')}</div><span>Estimated safe travel time: <b>${dist[end]} minutes</b> • Destination support: ${shelters[end]}</span>`;
}
$('routeBtn').onclick=route;document.querySelectorAll('.blocked-box input').forEach(x=>x.addEventListener('change',route));
function riskSim(level){if(!incidents.length){$('scenarioOutput').textContent='Add an emergency first, then run this scenario.';return;}const add=+level;const before=sorted().map(x=>`${x.id}: ${score(x).toFixed(1)}`);incidents.forEach(x=>x.risk=Math.min(10,x.risk+add));save();render();const after=sorted().map(x=>`${x.id}: ${score(x).toFixed(1)}`);$('scenarioOutput').textContent=`DISASTER SEVERITY INCREASED\n\nRisk was increased by ${add} level(s), automatically.\n\nBEFORE\n${before.join('\n')}\n\nAFTER\n${after.join('\n')}\n\nThe priority queue was re-ranked.`;}
function ambSim(n){const before=+$('ambInput').value||0;const unavailable=+n;const after=Math.max(0,before-unavailable);$('ambInput').value=after;buildAllocation();$('scenarioOutput').textContent=`AMBULANCE AVAILABILITY CHANGE\n\n${unavailable} ambulance(s) were marked unavailable.\nAvailable units: ${before} → ${after}\n\nRecheck the allocation dropdowns and assign the remaining ambulances to the highest-priority incidents first.`;}
function shelterSim(p){const total=1430;const loss=Math.round(total*(+p/100));$('scenarioOutput').textContent=`SHELTER CAPACITY CHANGE\n\n${p}% of the available shelter capacity is unavailable.\nCapacity: ${total.toLocaleString()} → ${(total-loss).toLocaleString()} spaces\n\nRecommended action:\nUse the evacuation route planner and redirect evacuees toward regions with more available shelter space.`;}
document.querySelectorAll('[data-scenario="risk"]').forEach(b=>b.onclick=()=>{const v=$('riskScenario').value;if(!v){alert('Choose a severity level first.');return}riskSim(v)});document.querySelectorAll('[data-scenario="amb"]').forEach(b=>b.onclick=()=>{const v=$('ambScenario').value;if(!v){alert('Choose how many ambulances are unavailable.');return}ambSim(v)});document.querySelectorAll('[data-scenario="shelter"]').forEach(b=>b.onclick=()=>{const v=$('shelterScenario').value;if(!v){alert('Choose a shelter capacity reduction.');return}shelterSim(v)});
$('demoBtn').onclick=()=>{incidents=[{id:'E101',type:'FLOOD',region:'Riverside',people:1250,vulnerable:320,medical:8,risk:9},{id:'E104',type:'HEAT',region:'Central',people:900,vulnerable:300,medical:7,risk:7},{id:'E102',type:'FIRE',region:'Hillview',people:180,vulnerable:40,medical:9,risk:8},{id:'E103',type:'MEDICAL',region:'Lakeside',people:50,vulnerable:25,medical:10,risk:8}];save();render();};
fillRegions();render();route();
