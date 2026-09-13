const $ = id => document.getElementById(id);
let employee = JSON.parse(localStorage.getItem("bankEmployee") || "null");
let currentIdeas = [];

let employeeApproved = false;

async function ensureApprovedEmployee() {
  if (!employee) {
    window.location.replace("index.html");
    return false;
  }

  const identity = employee.code || employee.name || "";
  try {
    const res = await fetch("/api/employee/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || data.status !== "approved") {
      localStorage.removeItem("bankEmployee");
      window.location.replace("index.html");
      return false;
    }

    employee = data.employee;
    employeeApproved = true;
    localStorage.setItem("bankEmployee", JSON.stringify(employee));
    $("employeeWelcome").textContent = employee.name
      ? `مرحباً، ${employee.name}`
      : `الرقم الوظيفي: ${employee.code}`;
    return true;
  } catch {
    $("ideasLoading").textContent = "تعذر التحقق من اعتماد الحساب.";
    return false;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "—";
  const normalized = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("ar-IQ", { dateStyle: "medium", timeStyle: "short" });
}

function statusClass(status) {
  const map = {
    "جديدة": "status-new",
    "قيد التقييم": "status-review",
    "معتمدة": "status-approved",
    "قيد التنفيذ": "status-progress",
    "منفذة": "status-done",
    "مرفوضة": "status-rejected"
  };
  return map[status] || "status-new";
}

function updateStats(ideas) {
  $("statTotal").textContent = ideas.length;
  $("statReview").textContent = ideas.filter(i => ["جديدة", "قيد التقييم"].includes(i.status)).length;
  $("statApproved").textContent = ideas.filter(i => ["معتمدة", "قيد التنفيذ"].includes(i.status)).length;
  $("statDone").textContent = ideas.filter(i => i.status === "منفذة").length;
}

function renderIdeas(ideas) {
  const list = $("myIdeasList");
  $("ideasLoading").style.display = "none";
  updateStats(ideas);

  if (!ideas.length) {
    list.innerHTML = `
      <div class="ideas-empty dashboard-empty-card">
        <strong>لم ترسل أي فكرة حتى الآن.</strong>
        <span>ابدأ بإرسال أول فكرة لك من زر «فكرة جديدة».</span>
      </div>`;
    return;
  }

  list.innerHTML = ideas.map(idea => {
    const scores = [idea.feasibility, idea.ease, idea.roi].filter(v => Number(v) > 0);
    const avg = scores.length ? (scores.reduce((a,b) => a + Number(b), 0) / scores.length).toFixed(1) : null;
    return `
      <article class="my-idea-card">
        <div class="my-idea-card-head">
          <div>
            <span class="idea-number">فكرة رقم #${idea.id}</span>
            <h3>${escapeHtml(idea.title || "بدون عنوان")}</h3>
          </div>
          <span class="idea-status ${statusClass(idea.status)}">${escapeHtml(idea.status || "جديدة")}</span>
        </div>
        <div class="idea-meta-row">
          <span><b>المجال:</b> ${escapeHtml(idea.category || "—")}</span>
          <span><b>تاريخ الإرسال:</b> ${formatDate(idea.created_at)}</span>
          ${avg ? `<span><b>متوسط التقييم:</b> ${avg} / 5</span>` : ""}
        </div>
        <div class="idea-summary-grid">
          <div><b>التحدي</b><p>${escapeHtml(idea.challenge || "—")}</p></div>
          <div><b>الحل المقترح</b><p>${escapeHtml(idea.solution || "—")}</p></div>
          <div><b>الأثر المتوقع</b><p>${escapeHtml(idea.expected_impact || "—")}</p></div>
        </div>
        ${idea.admin_notes ? `<div class="admin-note-box"><b>ملاحظات لجنة التقييم</b><p>${escapeHtml(idea.admin_notes)}</p></div>` : ""}
        ${idea.updated_at ? `<div class="idea-last-update">آخر تحديث: ${formatDate(idea.updated_at)}</div>` : ""}
      </article>`;
  }).join("");
}

async function loadMyIdeas() {
  $("ideasLoading").style.display = "block";
  $("ideasLoading").textContent = "جاري تحميل أفكارك...";
  $("myIdeasList").innerHTML = "";
  try {
    const params = new URLSearchParams();
    if (employee.name) params.set("employeeName", employee.name);
    if (employee.code) params.set("employeeCode", employee.code);
    const res = await fetch(`/api/my-ideas?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "تعذر تحميل الأفكار.");
    currentIdeas = data;
    renderIdeas(data);
  } catch (err) {
    $("ideasLoading").style.display = "block";
    $("ideasLoading").textContent = err.message;
  }
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadIdeas() {
  if (!currentIdeas.length) {
    alert("لا توجد أفكار لتنزيلها حالياً.");
    return;
  }
  const rows = [
    ["رقم الفكرة", "العنوان", "المجال", "الحالة", "التحدي", "الحل المقترح", "الأثر المتوقع", "ملاحظات اللجنة", "تاريخ الإرسال"],
    ...currentIdeas.map(i => [i.id, i.title, i.category, i.status, i.challenge, i.solution, i.expected_impact, i.admin_notes || "", i.created_at])
  ];
  const csv = "\uFEFF" + rows.map(r => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "afkari.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

$("backHomeBtn").addEventListener("click", () => window.location.href = "home.html");
$("newIdeaBtn").addEventListener("click", () => window.location.href = "idea.html");
$("refreshBtn").addEventListener("click", loadMyIdeas);
$("downloadBtn").addEventListener("click", downloadIdeas);
$("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("bankEmployee");
  window.location.href = "index.html";
});

ensureApprovedEmployee().then(ok => { if (ok) loadMyIdeas(); });
