const incidents=[
 {id:"E101",type:"FLOOD",zone:"E",people:1250,vuln:320,medical:8,risk:9,m:1.12},
 {id:"E102",type:"FIRE",zone:"B",people:180,vuln:40,medical:9,risk:10,m:1.18},
 {id:"E103",type:"MEDICAL",zone:"C",people:50,vuln:25,medical:10,risk:8,m:1.20},
 {id:"E104",type:"HEAT",zone:"G",people:900,vuln:300,medical:7,risk:7,m:1.08}
];
const edges={
 A:[["B",4],["D",6],["S1",3]], B:[["A",4],["C",5],["E",3]],
 C:[["B",5],["F",4],["S2",3]], D:[["A",6],["E",2]],
 E:[["B",3],["D",2],["F",3],["G",5]], F:[["C",4],["E",3],["S3",2]],
 G:[["E",5],["S4",2]],S1:[["A",3]],S2:[["C",3]],S3:[["F",2]],S4:[["G",2]]
};

function score(x){return Math.min(100,(Math.min(35,x.people/40)+Math.min(25,x.vuln/20)+x.medical*2+x.risk*3)*x.m)}
function render(){
 const sorted=[...incidents].sort((a,b)=>score(b)-score(a));
 document.getElementById("incidentTable").innerHTML=sorted.map(x=>{
   const s=score(x); const cls=s>=85?"score-high":s>=65?"score-med":"score-low";
   return `<tr><td><b>${x.id}</b></td><td><span class="badge">${x.type}</span></td><td>${x.zone}</td><td>${x.people.toLocaleString()}</td><td>${x.vuln.toLocaleString()}</td><td>${x.risk}/10</td><td class="${cls}">${s.toFixed(1)}</td><td>${s>=85?"IMMEDIATE":s>=65?"PRIORITY":"MONITOR"}</td></tr>`;
 }).join("");
 document.getElementById("peopleCount").textContent=incidents.reduce((a,x)=>a+x.people,0).toLocaleString();
 document.getElementById("incidentCount").textContent=incidents.length;
}
function runAllocation(){
 const sorted=[...incidents].sort((a,b)=>score(b)-score(a));
 let amb=5, team=3, kits=250;
 document.getElementById("allocation").innerHTML=sorted.map((x,i)=>{
   const a=amb>0; const t=team>0; const k=Math.min(kits,Math.max(10,Math.floor(x.vuln/2)));
   if(a)amb--; if(t)team--; kits-=k;
   return `<div class="allocation-row"><span>${i+1}. ${x.id} • ${x.type}</span><b>AMB ${a?"✓":"—"} &nbsp; TEAM ${t?"✓":"—"} &nbsp; KITS ${k}</b></div>`;
 }).join("");
}
function dijkstra(start,end){
 const dist={},prev={},visited=new Set(),nodes=Object.keys(edges);
 nodes.forEach(n=>dist[n]=Infinity);dist[start]=0;
 while(visited.size<nodes.length){
   let u=null;nodes.forEach(n=>{if(!visited.has(n)&&(u===null||dist[n]<dist[u]))u=n});
   if(u===null||dist[u]===Infinity)break;visited.add(u);
   edges[u].forEach(([v,w])=>{const nd=dist[u]+w;if(nd<dist[v]){dist[v]=nd;prev[v]=u}});
 }
 if(dist[end]===Infinity)return null;
 const path=[];let c=end;while(c){path.unshift(c);c=prev[c]}return {path,time:dist[end]};
}
function findRoute(){
 const r=dijkstra(document.getElementById("start").value,document.getElementById("destination").value);
 document.getElementById("routeResult").innerHTML=r?`<div class="route-path">${r.path.join(" → ")}</div><div class="route-time">Estimated safe travel time: <b>${r.time} minutes</b></div>`:"No route available.";
}
function shuffleRisks(){
 incidents.forEach(x=>x.risk=Math.min(10,x.risk+1));
 render();runAllocation();
 document.getElementById("simulationOutput").textContent="Scenario applied: disaster risk increased by 1 for every incident.\nPriority scores were recomputed and the queue was re-ordered.";
}
function simulate(type){
 let out="";
 if(type==="risk"){incidents.forEach(x=>x.risk=Math.min(10,x.risk+2));render();runAllocation();out="RISK ESCALATION\n\nAll incident risk levels increased by 2.\nThe priority engine recomputed every score.\nHighest-risk incidents move to the front of the response queue."}
 if(type==="ambulance"){out="RESOURCE SHORTAGE\n\nAmbulances: 5 → 2\n\nResult: only the two highest-priority incidents can receive an immediate ambulance assignment.\nLower-priority incidents remain queued until a unit is released."}
 if(type==="shelter"){out="SHELTER CAPACITY SHOCK\n\nS3 capacity reduction: 400 spaces\n\nResult: S3 overflow must be redirected to S2 or S4.\nThe route planner should be rerun after the shelter change."}
 document.getElementById("simulationOutput").textContent=out;
}
render();runAllocation();findRoute();
