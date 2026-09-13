const $ = id => document.getElementById(id);
let username = sessionStorage.getItem("adminUsername") || "";
let password = sessionStorage.getItem("adminPassword") || "";
let allIdeas = [];
let allRegistrations = [];
const statuses = ["جديدة", "قيد التقييم", "معتمدة", "قيد التنفيذ", "منفذة", "مرفوضة"];

async function login() {
  username = ($("adminUsername").value || username).trim();
  password = ($("adminPassword").value || password).trim();
  $("adminError").textContent = "";

  if (!username || !password) {
    $("adminError").textContent = "اكتب اسم المستخدم وكلمة المرور.";
    return;
  }

  $("adminLoginBtn").disabled = true;
  $("adminLoginBtn").textContent = "جاري الدخول...";
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      $("adminError").textContent = data.message || "اسم المستخدم أو كلمة المرور غير صحيحة.";
      return;
    }
    sessionStorage.setItem("adminUsername", username);
    sessionStorage.setItem("adminPassword", password);
    $("adminLogin").classList.add("hidden");
    $("adminPanel").classList.remove("hidden");
    await Promise.all([loadRegistrations(), loadIdeas()]);
  } catch (err) {
    $("adminError").textContent = "تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مرة أخرى.";
  } finally {
    $("adminLoginBtn").disabled = false;
    $("adminLoginBtn").textContent = "دخول";
  }
}


async function loadRegistrations() {
  const res = await fetch("/api/admin/registrations", {
    headers: { "x-admin-username": username, "x-admin-password": password }
  });

  if (!res.ok) {
    sessionStorage.removeItem("adminUsername");
    sessionStorage.removeItem("adminPassword");
    location.reload();
    return;
  }

  allRegistrations = await res.json();
  renderRegistrations();
}

function renderRegistrations() {
  const pending = allRegistrations.filter(item => item.status === "pending");
  const badge = $("registrationBadge");

  if (pending.length) {
    badge.textContent = pending.length;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }

  if (!pending.length) {
    $("registrationsList").innerHTML = '<div class="registration-empty">لا توجد طلبات تسجيل بانتظار الموافقة.</div>';
    return;
  }

  $("registrationsList").innerHTML = pending.map(item => {
    const identity = item.employee_name
      ? `الاسم: ${escapeHtml(item.employee_name)}`
      : `الرقم الوظيفي: ${escapeHtml(item.employee_code || "—")}`;

    return `
      <article class="registration-card">
        <div>
          <strong>${identity}</strong>
          <small>تاريخ الطلب: ${formatDate(item.created_at)}</small>
        </div>
        <div class="registration-actions">
          <button class="approve-btn" onclick="reviewRegistration(${item.id}, 'approved')">موافقة</button>
          <button class="danger" onclick="reviewRegistration(${item.id}, 'rejected')">رفض</button>
        </div>
      </article>
    `;
  }).join("");
}

async function reviewRegistration(id, status) {
  const actionText = status === "approved" ? "الموافقة على" : "رفض";
  if (!confirm(`هل تريد ${actionText} طلب تسجيل هذا الموظف؟`)) return;

  const res = await fetch(`/api/admin/registrations/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-admin-username": username,
      "x-admin-password": password
    },
    body: JSON.stringify({ status })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(data.message || "تعذر تحديث طلب التسجيل.");
    return;
  }

  await loadRegistrations();
}

async function loadIdeas() {
  const res = await fetch("/api/admin/ideas", { headers: { "x-admin-username": username, "x-admin-password": password } });
  if (!res.ok) { sessionStorage.removeItem("adminUsername"); sessionStorage.removeItem("adminPassword"); location.reload(); return; }
  allIdeas = await res.json();
  renderIdeas();
}

function renderIdeas() {
  const filter = $("statusFilter").value;
  const ideas = filter ? allIdeas.filter(x => x.status === filter) : allIdeas;
  const counts = Object.fromEntries(statuses.map(s => [s, allIdeas.filter(x => x.status === s).length]));
  $("statsText").textContent = `الإجمالي: ${allIdeas.length} • جديدة: ${counts["جديدة"]} • معتمدة: ${counts["معتمدة"]} • قيد التنفيذ: ${counts["قيد التنفيذ"]} • منفذة: ${counts["منفذة"]}`;

  if (!ideas.length) { $("ideasList").innerHTML = '<div class="card empty">لا توجد أفكار ضمن هذا التصنيف.</div>'; return; }

  $("ideasList").innerHTML = ideas.map(item => {
    const avg = [item.feasibility, item.ease, item.roi].filter(Boolean);
    const average = avg.length ? (avg.reduce((a,b) => a+b,0) / avg.length).toFixed(1) : "—";
    return `
      <article class="idea-card">
        <div class="idea-top">
          <div><span class="badge">${escapeHtml(item.category || "غير مصنف")}</span><h3>#${item.id} — ${escapeHtml(item.title || "فكرة بدون عنوان")}</h3></div>
          <span class="status status-${statusClass(item.status)}">${escapeHtml(item.status || "جديدة")}</span>
        </div>
        <div class="meta">👤 ${escapeHtml(item.employee_name || "غير مذكور")} ${item.employee_code ? `• الرقم: ${escapeHtml(item.employee_code)}` : ""} • ${formatDate(item.created_at)}</div>
        <div class="idea-content"><div><b>التحدي</b><p>${escapeHtml(item.challenge || item.idea || "—")}</p></div><div><b>الحل المقترح</b><p>${escapeHtml(item.solution || "—")}</p></div><div><b>الأثر المتوقع</b><p>${escapeHtml(item.expected_impact || "—")}</p></div></div>
        <div class="evaluation">
          <h4>تقييم اللجنة <span>متوسط التقييم: ${average}/5</span></h4>
          <div class="score-grid">
            ${scoreSelect(`feasibility-${item.id}`, "الجدوى", item.feasibility)}
            ${scoreSelect(`ease-${item.id}`, "سهولة التطبيق", item.ease)}
            ${scoreSelect(`roi-${item.id}`, "العائد على الاستثمار", item.roi)}
          </div>
          <label>حالة الفكرة</label>
          <select id="status-${item.id}">${statuses.map(s => `<option ${s === (item.status || "جديدة") ? "selected" : ""}>${s}</option>`).join("")}</select>
          <label>ملاحظات اللجنة</label>
          <textarea id="notes-${item.id}" rows="3" placeholder="اكتب ملاحظات التقييم أو متطلبات التنفيذ...">${escapeHtml(item.admin_notes || "")}</textarea>
          <div class="idea-actions"><button onclick="saveIdea(${item.id})">حفظ التقييم</button><button class="danger" onclick="deleteIdea(${item.id})">حذف</button></div>
        </div>
      </article>`;
  }).join("");
}

function scoreSelect(id, label, value) {
  return `<div><label>${label}</label><select id="${id}"><option value="">—</option>${[1,2,3,4,5].map(n => `<option value="${n}" ${Number(value)===n ? "selected" : ""}>${n} / 5</option>`).join("")}</select></div>`;
}

async function saveIdea(id) {
  const payload = { status: $(`status-${id}`).value, feasibility: $(`feasibility-${id}`).value, ease: $(`ease-${id}`).value, roi: $(`roi-${id}`).value, adminNotes: $(`notes-${id}`).value };
  const res = await fetch(`/api/admin/ideas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-admin-username": username, "x-admin-password": password }, body: JSON.stringify(payload) });
  if (!res.ok) { const d = await res.json(); alert(d.message || "تعذر الحفظ"); return; }
  await loadIdeas();
}

async function deleteIdea(id) {
  if (!confirm("هل تريد حذف هذه الفكرة نهائياً؟")) return;
  await fetch(`/api/admin/ideas/${id}`, { method: "DELETE", headers: { "x-admin-username": username, "x-admin-password": password } });
  loadIdeas();
}

function escapeHtml(v) { return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function statusClass(s) { return ({"جديدة":"new","قيد التقييم":"review","معتمدة":"approved","قيد التنفيذ":"progress","منفذة":"done","مرفوضة":"rejected"})[s] || "new"; }
function formatDate(v) { try { return new Date(v + (String(v).includes("Z") ? "" : "Z")).toLocaleString("ar-IQ"); } catch { return v; } }

function logoutAdmin() {
  sessionStorage.removeItem("adminUsername");
  sessionStorage.removeItem("adminPassword");
  username = "";
  password = "";
  location.reload();
}

$("adminLoginBtn").addEventListener("click", login);
$("adminPassword").addEventListener("keydown", e => { if (e.key === "Enter") login(); });
$("adminUsername").addEventListener("keydown", e => { if (e.key === "Enter") login(); });
$("adminLogoutBtn").addEventListener("click", logoutAdmin);
$("refreshBtn").addEventListener("click", () => Promise.all([loadRegistrations(), loadIdeas()]));
$("statusFilter").addEventListener("change", renderIdeas);
if (password) login();
