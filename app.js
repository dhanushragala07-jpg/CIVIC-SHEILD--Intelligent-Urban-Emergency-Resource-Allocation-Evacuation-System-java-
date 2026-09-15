const REGIONS = [
  "Riverside",
  "Hillview",
  "Central",
  "Lakeside",
  "Eastbank",
  "Industrial Area",
  "Greenfield"
];

const shelters = {
  "Riverside": "Riverside Relief Centre",
  "Hillview": "Hillview Community Shelter",
  "Central": "Central Civic Shelter",
  "Lakeside": "Lakeside Relief Centre",
  "Eastbank": "Eastbank Safe Shelter",
  "Industrial Area": "Industrial Zone Shelter",
  "Greenfield": "Greenfield Community Shelter"
};

const edges = {
  "Riverside": [["Hillview",4],["Central",6]],
  "Hillview": [["Riverside",4],["Central",3],["Eastbank",4]],
  "Central": [["Riverside",6],["Hillview",3],["Lakeside",4],["Industrial Area",5]],
  "Lakeside": [["Central",4],["Eastbank",3],["Greenfield",5]],
  "Eastbank": [["Hillview",4],["Lakeside",3],["Industrial Area",2],["Greenfield",6]],
  "Industrial Area": [["Central",5],["Eastbank",2],["Greenfield",3]],
  "Greenfield": [["Lakeside",5],["Eastbank",6],["Industrial Area",3]]
};

const multipliers = {
  FLOOD: 1.12,
  FIRE: 1.18,
  MEDICAL: 1.20,
  HEAT: 1.08
};

const PASSKEY = "5109965";
const DEFAULT_RESOURCES = {
  amb: 0,
  team: 0,
  kit: 0,
  bus: 0
};

let incidents = [];
let resources = {...DEFAULT_RESOURCES};
let allocations = {};
let currentRole = "";
let cloudReady = false;
let supabaseClient = null;

const $ = id => document.getElementById(id);

function score(x) {
  return Math.min(
    100,
    (
      Math.min(35, x.people / 40) +
      Math.min(25, x.vulnerable / 20) +
      x.medical * 2 +
      x.risk * 3
    ) * (multipliers[x.type] || 1)
  );
}

function recommendation(s) {
  if (s >= 85) return "Immediate Response";
  if (s >= 70) return "High Priority";
  if (s >= 55) return "Respond Soon";
  return "Monitor Closely";
}

function riskWord(n) {
  return n >= 9 ? "Extreme" :
         n >= 7 ? "High" :
         n >= 4 ? "Moderate" : "Low";
}

function sorted() {
  return [...incidents].sort((a,b) => score(b) - score(a));
}

function typeName(t) {
  return {
    FLOOD: "Flood",
    FIRE: "Fire",
    MEDICAL: "Medical",
    HEAT: "Heat Wave"
  }[t] || t;
}

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    m => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[m])
  );
}

/* NEW: Format disaster date and time */
function formatOccurred(value) {
  if (!value) return "Not recorded";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "Not recorded";
  }

  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/* NEW: Set current date/time as default */
function setDefaultOccurredAt() {
  const el = $("occurredAt");

  if (!el || el.value) return;

  const d = new Date();

  d.setMinutes(
    d.getMinutes() - d.getTimezoneOffset()
  );

  el.value = d.toISOString().slice(0,16);
}

function cloudConfigured() {
  return (
    window.CIVIC_SUPABASE_URL &&
    window.CIVIC_SUPABASE_KEY &&
    !window.CIVIC_SUPABASE_URL.includes("YOUR_") &&
    !window.CIVIC_SUPABASE_KEY.includes("YOUR_")
  );
}

function setConnectionStatus(text, ok = true) {
  const el = $("resourceStatus");

  if (el) {
    el.textContent = text;
    el.classList.remove("hidden");
    el.style.borderColor =
      ok
        ? "rgba(73,225,165,.35)"
        : "rgba(255,126,126,.35)";
  }
}

async function initCloud() {
  if (!cloudConfigured()) {
    setConnectionStatus(
      "Cloud database is not configured yet. This preview will use this device only until Supabase is connected.",
      false
    );

    loadLocalFallback();
    render();
    return;
  }

  try {
    supabaseClient = window.supabase.createClient(
      window.CIVIC_SUPABASE_URL,
      window.CIVIC_SUPABASE_KEY
    );

    cloudReady = true;

    await refreshCloudData();
    subscribeRealtime();

    setConnectionStatus(
      "✓ Shared cloud database connected. Changes are synchronized across devices.",
      true
    );

  } catch (err) {
    console.error(err);

    cloudReady = false;

    setConnectionStatus(
      "Cloud connection failed. Check Supabase setup; this device will continue in local mode.",
      false
    );

    loadLocalFallback();
    render();
  }
}

function loadLocalFallback() {
  incidents = JSON.parse(
    localStorage.getItem("civicshield_final_incidents") || "[]"
  );

  resources = JSON.parse(
    localStorage.getItem("civicshield_admin_resources") ||
    JSON.stringify(DEFAULT_RESOURCES)
  );
}

function saveLocal() {
  localStorage.setItem(
    "civicshield_final_incidents",
    JSON.stringify(incidents)
  );

  localStorage.setItem(
    "civicshield_admin_resources",
    JSON.stringify(resources)
  );
}

async function refreshCloudData() {

  const [ir, rr, ar] = await Promise.all([

    /* NEW: occurred_at added */
    supabaseClient
      .from("incidents")
      .select(
        "id,type,region,people,vulnerable,medical,risk,occurred_at,created_at"
      )
      .order("created_at", {ascending:true}),

    supabaseClient
      .from("resources")
      .select(
        "id,ambulances,rescue_teams,medical_kits,evacuation_buses,updated_at"
      )
      .eq("id",1)
      .maybeSingle(),

    supabaseClient
      .from("allocations")
      .select(
        "incident_id,ambulances,rescue_teams,medical_kits,evacuation_buses,updated_at"
      )
  ]);

  if (ir.error) throw ir.error;
  if (rr.error) throw rr.error;
  if (ar.error) throw ar.error;

  incidents = ir.data || [];

  if (rr.data) {
    resources = {
      amb: rr.data.ambulances,
      team: rr.data.rescue_teams,
      kit: rr.data.medical_kits,
      bus: rr.data.evacuation_buses
    };
  }

  allocations = {};

  (ar.data || []).forEach(a => {
    allocations[a.incident_id] = {
      amb: a.ambulances,
      team: a.rescue_teams,
      kit: a.medical_kits,
      bus: a.evacuation_buses
    };
  });

  render();
}

function subscribeRealtime() {

  supabaseClient
    .channel("civic-shield-live")

    .on(
      "postgres_changes",
      {
        event:"*",
        schema:"public",
        table:"incidents"
      },
      async () => {
        await refreshCloudData();
        flashLive("New incident information synchronized.");
      }
    )

    .on(
      "postgres_changes",
      {
        event:"*",
        schema:"public",
        table:"resources"
      },
      async () => {
        await refreshCloudData();
        flashLive("Resource availability updated by monitoring team.");
      }
    )

    .on(
      "postgres_changes",
      {
        event:"*",
        schema:"public",
        table:"allocations"
      },
      async () => {
        await refreshCloudData();
      }
    )

    .subscribe(
      status => console.log(
        "CIVIC-SHIELD realtime:",
        status
      )
    );
}

function flashLive(msg) {

  const el = $("liveSync");

  if (!el) return;

  el.textContent = "● LIVE • " + msg;
  el.classList.remove("hidden");

  clearTimeout(window.liveTimer);

  window.liveTimer = setTimeout(
    () => {
      el.textContent =
        "● LIVE • Shared monitoring active";
    },
    4000
  );
}

function fillRegions() {

  ["incidentRegion","routeFrom","routeTo"].forEach(id => {

    const el = $(id);

    el.innerHTML = REGIONS
      .map(r => `<option value="${r}">${r}</option>`)
      .join("");
  });

  $("routeTo").value = "Central";
}

function setRole(role) {

  currentRole = role;

  sessionStorage.setItem(
    "civicshield_role",
    role
  );

  $("accessGate").classList.add("hidden");

  $("roleBadge").textContent =
    role === "admin"
      ? "ADMIN / MONITOR"
      : "USER ACCESS";

  $("adminPanel").classList.toggle(
    "hidden",
    role !== "admin"
  );

  if (role === "admin") {
    loadResourceInputs();
  }

  render();
}

function resetAccess() {

  currentRole = "";

  sessionStorage.removeItem(
    "civicshield_role"
  );

  $("accessGate").classList.remove("hidden");
  $("passkeyBox").classList.add("hidden");
  $("passkeyError").classList.add("hidden");
  $("passkeyInput").value = "";
}

function render() {

  $("activeCount").textContent =
    incidents.length;

  $("affectedTotal").textContent =
    incidents
      .reduce((a,x) => a + x.people,0)
      .toLocaleString();

  $("vulnerableTotal").textContent =
    incidents
      .reduce((a,x) => a + x.vulnerable,0)
      .toLocaleString();

  $("availableAmb").textContent =
    resources.amb.toLocaleString();

  $("availableTeams").textContent =
    resources.team.toLocaleString();

  $("availableKits").textContent =
    resources.kit.toLocaleString();

  $("availableBuses").textContent =
    resources.bus.toLocaleString();

  const q = $("queue");
  const arr = sorted();

  q.innerHTML = arr.length
    ? arr.map((x,i) => {

        const s = score(x);

        return `
          <tr>
            <td>${i + 1}</td>

            <td>
              <b>${esc(x.id)}</b>
              <small style="display:block;margin-top:4px;opacity:.7">
                Occurred: ${formatOccurred(x.occurred_at)}
              </small>
            </td>

            <td>${typeName(x.type)}</td>

            <td>${esc(x.region)}</td>

            <td>${x.people.toLocaleString()}</td>

            <td>${x.vulnerable.toLocaleString()}</td>

            <td>${riskWord(x.risk)}</td>

            <td>${s.toFixed(1)}</td>

            <td class="recommendation">
              ${recommendation(s)}
            </td>
          </tr>
        `;

      }).join("")

    : `
      <tr>
        <td colspan="9" class="empty">
          No incidents yet. Report an emergency to begin.
        </td>
      </tr>
    `;

  buildAllocation();
  renderMonitor();
}

function renderMonitor() {

  const box = $("monitorPlaces");

  if (!box) return;

  if (!incidents.length) {

    box.innerHTML =
      '<div class="empty">No emergencies reported yet. Waiting for incident reports.</div>';

    return;
  }

  box.innerHTML = REGIONS.map(region => {

    const list = incidents
      .filter(x => x.region === region)
      .sort((a,b) => score(b) - score(a));

    if (!list.length) {

      return `
        <div class="monitor-place">
          <div>
            <b>${region}</b>
            <small>No active incident</small>
          </div>

          <span class="status-clear">
            CLEAR
          </span>
        </div>
      `;
    }

    const top = list[0];

    return `
      <div class="monitor-place">

        <div>

          <b>${region}</b>

          <small>
            ${list.length}
            active incident${list.length > 1 ? "s" : ""}
            • ${typeName(top.type)}
            • ${top.people.toLocaleString()} affected
            • ${top.vulnerable.toLocaleString()} vulnerable
            • urgency ${top.medical}/10
            • risk ${top.risk}/10
            • occurred ${formatOccurred(top.occurred_at)}
          </small>

        </div>

        <span class="status-alert">
          ${recommendation(score(top)).toUpperCase()}
        </span>

      </div>
    `;

  }).join("");
}

function loadResourceInputs() {

  if ($("ambInput")) {

    $("ambInput").value = resources.amb;
    $("teamInput").value = resources.team;
    $("kitInput").value = resources.kit;
    $("busInput").value = resources.bus;
  }
}

async function readResourceInputs() {

  const next = {

    amb: Math.max(
      0,
      +$("ambInput").value || 0
    ),

    team: Math.max(
      0,
      +$("teamInput").value || 0
    ),

    kit: Math.max(
      0,
      +$("kitInput").value || 0
    ),

    bus: Math.max(
      0,
      +$("busInput").value || 0
    )
  };

  if (!cloudReady) {

    resources = next;

    saveLocal();
    render();

    return true;
  }

  const {data,error} =
    await supabaseClient.rpc(
      "set_resources",
      {
        p_passkey: PASSKEY,
        p_ambulances: next.amb,
        p_rescue_teams: next.team,
        p_medical_kits: next.kit,
        p_evacuation_buses: next.bus
      }
    );

  if (error) {

    alert(
      "Could not save shared resources: " +
      error.message
    );

    return false;
  }

  resources = {
    amb: data.ambulances,
    team: data.rescue_teams,
    kit: data.medical_kits,
    bus: data.evacuation_buses
  };

  render();

  return true;
}

$("userRoleBtn").onclick =
  () => setRole("user");

$("adminRoleBtn").onclick = () => {

  $("passkeyBox").classList.remove("hidden");
  $("passkeyInput").focus();
};

function unlockAdmin() {

  if ($("passkeyInput").value === PASSKEY) {

    setRole("admin");

  } else {

    $("passkeyError").classList.remove("hidden");
    $("passkeyInput").select();
  }
}

$("passkeyBtn").onclick = unlockAdmin;

$("passkeyInput").addEventListener(
  "keydown",
  e => {
    if (e.key === "Enter") {
      unlockAdmin();
    }
  }
);

$("switchRole").onclick = resetAccess;

$("saveAdminResources").onclick = async () => {

  if (currentRole !== "admin") return;

  const ok = await readResourceInputs();

  if (ok) {

    $("resourceStatus").textContent =
      cloudReady
        ? "✓ Resources saved to the shared cloud database. Every connected user device will receive the update."
        : "Current resources saved on this device only.";

    $("resourceStatus").classList.remove("hidden");
  }
};

/* EMERGENCY REPORT SUBMISSION */

$("incidentForm").addEventListener(
  "submit",
  async e => {

    e.preventDefault();

    const occurredInput =
      $("occurredAt").value;

    const x = {

      id: $("incidentId").value.trim(),

      type: $("incidentType").value,

      region: $("incidentRegion").value,

      people: +$("people").value,

      vulnerable: +$("vulnerable").value,

      medical: +$("medical").value,

      risk: +$("risk").value,

      /* NEW: save disaster occurrence time */
      occurred_at: new Date(
        occurredInput
      ).toISOString()
    };

    if (
      !x.id ||
      !x.type ||
      !x.region ||
      !x.people ||
      !x.medical ||
      !x.risk ||
      !occurredInput
    ) {

      alert(
        "Please complete all emergency fields."
      );

      return;
    }

    if (
      x.vulnerable < 0 ||
      x.vulnerable > x.people
    ) {

      alert(
        "Vulnerable people cannot be greater than people affected."
      );

      return;
    }

    if (
      incidents.some(
        i =>
          i.id.toLowerCase() ===
          x.id.toLowerCase()
      )
    ) {

      alert(
        "That Emergency ID already exists."
      );

      return;
    }

    if (cloudReady) {

      const {error} =
        await supabaseClient
          .from("incidents")
          .insert(x);

      if (error) {

        alert(
          "Could not report the incident: " +
          error.message
        );

        return;
      }

    } else {

      incidents.push(x);
      saveLocal();
    }

    const s = score(x);

    $("analysis").classList.remove(
      "hidden"
    );

    $("analysis").innerHTML = `

      <strong>${s.toFixed(1)} / 100</strong>

      <div>
        <b>${recommendation(s)}</b>
        for ${esc(x.region)}
        • ${typeName(x.type)}
      </div>

      <small>
        Disaster occurred:
        ${formatOccurred(x.occurred_at)}
        <br>
        The incident is now available to the monitoring team
        ${cloudReady
          ? " on every connected device"
          : " on this device"}.
      </small>
    `;

    if (cloudReady) {

      await refreshCloudData();

    } else {

      render();
    }

    $("incidentForm").reset();

    $("medical").value = "";
    $("risk").value = "";

    /* Give the next report a current date/time */
    setDefaultOccurredAt();
  }
);

function numOptions(n, selected = 0) {

  return Array.from(
    {length:n + 1},
    (_,i) =>
      `<option value="${i}" ${
        i === selected ? "selected" : ""
      }>${i}</option>`
  ).join("");
}

function buildAllocation() {

  const A = resources.amb;
  const T = resources.team;
  const K = resources.kit;
  const B = resources.bus;

  const arr = sorted();

  if (!arr.length) {

    $("allocation").innerHTML =
      '<div class="empty">Report incidents first, then choose exact quantities for each emergency.</div>';

    return;
  }

  $("allocation").innerHTML =
    arr.map((x,i) => {

      const a =
        allocations[x.id] ||
        DEFAULT_RESOURCES;

      return `

        <div
          class="allocation-card"
          data-id="${esc(x.id)}"
        >

          <div class="allocation-head">

            <span>
              ${i + 1}.
              ${esc(x.id)}
              • ${typeName(x.type)}
              • ${esc(x.region)}
            </span>

            <b>${score(x).toFixed(1)}</b>

          </div>

          <div class="allocation-controls">

            <label>
              Ambulances
              <select data-r="amb">
                ${numOptions(A,a.amb)}
              </select>
            </label>

            <label>
              Rescue Teams
              <select data-r="team">
                ${numOptions(T,a.team)}
              </select>
            </label>

            <label>
              Medical Kits
              <select data-r="kit">
                ${numOptions(K,a.kit)}
              </select>
            </label>

            <label>
              Evac Buses
              <select data-r="bus">
                ${numOptions(B,a.bus)}
              </select>
            </label>

          </div>

          <div class="allocation-summary">
            ${allocationText(a)}
          </div>

        </div>
      `;

    }).join("");

  document
    .querySelectorAll(
      ".allocation-card select"
    )
    .forEach(
      s =>
        s.addEventListener(
          "change",
          allocationChanged
        )
    );
}

function allocationText(v) {

  return `
    Sending ${v.amb} ambulance(s),
    ${v.team} rescue team(s),
    ${v.kit} medical kit(s) and
    ${v.bus} evacuation bus(es).
  `;
}

function allocationChanged(e) {

  const card =
    e.target.closest(
      ".allocation-card"
    );

  const vals =
    [...card.querySelectorAll("select")]
      .map(s => +s.value);

  card.querySelector(
    ".allocation-summary"
  ).textContent =
    allocationText({
      amb: vals[0],
      team: vals[1],
      kit: vals[2],
      bus: vals[3]
    });

  const limits = {
    amb: resources.amb,
    team: resources.team,
    kit: resources.kit,
    bus: resources.bus
  };

  let warnings = [];

  Object.keys(limits).forEach(k => {

    let used = 0;

    document
      .querySelectorAll(
        `select[data-r="${k}"]`
      )
      .forEach(
        s => used += +s.value
      );

    if (used > limits[k]) {
      warnings.push(k);
    }
  });

  if (warnings.length) {

    card.querySelector(
      ".allocation-summary"
    ).textContent +=
      " Warning: selected totals exceed available supply.";
  }
}

$("saveAllocation").onclick =
  async () => {

    if (!incidents.length) {

      $("allocationStatus").textContent =
        "Add at least one emergency before saving an allocation.";

      $("allocationStatus").classList.remove(
        "hidden"
      );

      return;
    }

    const cards = [
      ...document.querySelectorAll(
        ".allocation-card"
      )
    ];

    if (cloudReady) {

      for (const card of cards) {

        const id = card.dataset.id;

        const vals =
          [...card.querySelectorAll("select")]
            .map(s => +s.value);

        const {error} =
          await supabaseClient
            .from("allocations")
            .upsert(
              {
                incident_id: id,
                ambulances: vals[0],
                rescue_teams: vals[1],
                medical_kits: vals[2],
                evacuation_buses: vals[3]
              },
              {
                onConflict: "incident_id"
              }
            );

        if (error) {

          alert(
            "Could not save allocation: " +
            error.message
          );

          return;
        }
      }

      await refreshCloudData();

    } else {

      cards.forEach(card => {

        const id = card.dataset.id;

        const vals =
          [...card.querySelectorAll("select")]
            .map(s => +s.value);

        allocations[id] = {
          amb: vals[0],
          team: vals[1],
          kit: vals[2],
          bus: vals[3]
        };

        saveLocal();
      });
    }

    $("allocationStatus").textContent =
      cloudReady
        ? "✓ Response allocation saved to the shared database. The monitoring team can see the current plan."
        : "Response allocation saved on this device.";

    $("allocationStatus").classList.remove(
      "hidden"
    );
  };

function route() {

  const start = $("routeFrom").value;
  const end = $("routeTo").value;

  if (start === end) {

    $("routeResult").innerHTML =
      "<b>Shortest Safe Route</b>" +
      '<div class="path">You are already in this region.</div>';

    return;
  }

  const blocked = [
    ...document.querySelectorAll(
      ".blocked-box input:checked"
    )
  ].map(x => x.value);

  const isBlocked = (a,b) =>
    blocked.includes(`${a}|${b}`) ||
    blocked.includes(`${b}|${a}`);

  const dist = {};
  const prev = {};

  const unvisited =
    new Set(REGIONS);

  REGIONS.forEach(
    r => dist[r] = Infinity
  );

  dist[start] = 0;

  while (unvisited.size) {

    let u =
      [...unvisited]
        .sort(
          (a,b) => dist[a] - dist[b]
        )[0];

    if (dist[u] === Infinity) break;

    unvisited.delete(u);

    if (u === end) break;

    for (const [v,w] of edges[u]) {

      if (isBlocked(u,v)) continue;

      const nd =
        dist[u] + w;

      if (nd < dist[v]) {

        dist[v] = nd;
        prev[v] = u;
      }
    }
  }

  if (dist[end] === Infinity) {

    $("routeResult").innerHTML =
      "<b>No safe route available.</b>" +
      "<span>Choose another destination or restore a blocked road.</span>";

    return;
  }

  let path = [];
  let c = end;

  while (c) {

    path.unshift(c);
    c = prev[c];
  }

  $("routeResult").innerHTML = `

    <b>Shortest Safe Route</b>

    <div class="path">
      ${path.join(" → ")}
    </div>

    <span>
      Estimated safe travel time:
      <b>${dist[end]} minutes</b>
      • Destination support:
      ${shelters[end]}
    </span>
  `;
}

$("routeBtn").onclick = route;

document
  .querySelectorAll(
    ".blocked-box input"
  )
  .forEach(
    x =>
      x.addEventListener(
        "change",
        route
      )
  );

function riskSim(level) {

  if (!incidents.length) {

    $("scenarioOutput").textContent =
      "Add an emergency first, then run this scenario.";

    return;
  }

  const add = +level;

  const before =
    sorted().map(
      x =>
        `${x.id}: ${score(x).toFixed(1)}`
    );

  const simulated =
    incidents.map(
      x => ({
        ...x,
        risk: Math.min(
          10,
          x.risk + add
        )
      })
    );

  const after =
    [...simulated]
      .sort(
        (a,b) => score(b) - score(a)
      )
      .map(
        x =>
          `${x.id}: ${score(x).toFixed(1)}`
      );

  $("scenarioOutput").textContent = `

DISASTER SEVERITY INCREASED

Risk was increased by ${add} level(s) for this simulation only.

BEFORE
${before.join("\n")}

AFTER
${after.join("\n")}

The live incident data was not changed.
`;
}

async function ambSim(n) {

  const before = resources.amb;
  const unavailable = +n;

  const simulated =
    Math.max(
      0,
      before - unavailable
    );

  $("scenarioOutput").textContent = `

AMBULANCE AVAILABILITY CHANGE

${unavailable} ambulance(s) were marked unavailable for this simulation.

Available units:
${before} → ${simulated}

The live resource total was not changed.
`;
}

function shelterSim(p) {

  const total = 1430;

  const loss =
    Math.round(
      total * (+p / 100)
    );

  $("scenarioOutput").textContent = `

SHELTER CAPACITY CHANGE

${p}% of available shelter capacity is unavailable for this simulation.

Capacity:
${total.toLocaleString()}
→ ${(total-loss).toLocaleString()} spaces

Recommended action:

Use the evacuation route planner and redirect evacuees toward regions with more available shelter space.
`;
}

document
  .querySelector(
    '[data-scenario="risk"]'
  )
  .onclick = () => {

    const v =
      $("riskScenario").value;

    if (!v)
      return alert(
        "Choose a severity level first."
      );

    riskSim(v);
  };

document
  .querySelector(
    '[data-scenario="amb"]'
  )
  .onclick = () => {

    const v =
      $("ambScenario").value;

    if (!v)
      return alert(
        "Choose how many ambulances are unavailable."
      );

    ambSim(v);
  };

document
  .querySelector(
    '[data-scenario="shelter"]'
  )
  .onclick = () => {

    const v =
      $("shelterScenario").value;

    if (!v)
      return alert(
        "Choose a shelter capacity reduction."
      );

    shelterSim(v);
  };

$("demoBtn").onclick = async () => {

  const now = Date.now();

  const demo = [

    {
      id:"E101",
      type:"FLOOD",
      region:"Riverside",
      people:1250,
      vulnerable:320,
      medical:8,
      risk:9,
      occurred_at:
        new Date(now - 86400000).toISOString()
    },

    {
      id:"E104",
      type:"HEAT",
      region:"Central",
      people:900,
      vulnerable:300,
      medical:7,
      risk:7,
      occurred_at:
        new Date(now - 7200000).toISOString()
    },

    {
      id:"E102",
      type:"FIRE",
      region:"Hillview",
      people:180,
      vulnerable:40,
      medical:9,
      risk:8,
      occurred_at:
        new Date(now - 3600000).toISOString()
    },

    {
      id:"E103",
      type:"MEDICAL",
      region:"Lakeside",
      people:50,
      vulnerable:25,
      medical:10,
      risk:8,
      occurred_at:
        new Date(now - 1800000).toISOString()
    }

  ];

  if (cloudReady) {

    for (const x of demo) {

      await supabaseClient
        .from("incidents")
        .upsert(
          x,
          {onConflict:"id"}
        );
    }

    await refreshCloudData();

  } else {

    incidents = demo;
    saveLocal();
    render();
  }
};

/* INITIALIZATION */

fillRegions();

setDefaultOccurredAt();

const savedRole =
  sessionStorage.getItem(
    "civicshield_role"
  );

if (
  savedRole === "admin" ||
  savedRole === "user"
) {

  setRole(savedRole);

} else {

  resetAccess();
}

initCloud();
route();
