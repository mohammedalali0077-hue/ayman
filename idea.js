const $ = id => document.getElementById(id);
let employee = JSON.parse(localStorage.getItem("bankEmployee") || "null");
let employeeApproved = false;

async function ensureApprovedEmployee() {
  if (!employee) {
    window.location.replace("index.html");
    return;
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
      return;
    }

    employee = data.employee;
    employeeApproved = true;
    localStorage.setItem("bankEmployee", JSON.stringify(employee));
    $("employeeWelcome").textContent = employee.name
      ? `مرحباً، ${employee.name}`
      : `الرقم الوظيفي: ${employee.code}`;
  } catch {
    $("ideaMessage").className = "form-message error";
    $("ideaMessage").textContent = "تعذر التحقق من اعتماد الحساب. تأكد من تشغيل السيرفر.";
  }
}

$("myIdeasBtn").addEventListener("click", () => { window.location.href = "dashboard.html"; });
$("backHomeBtn").addEventListener("click", () => { window.location.href = "home.html"; });
$("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("bankEmployee");
  window.location.href = "index.html";
});

$("sendIdeaBtn").addEventListener("click", async () => {
  if (!employeeApproved) {
    $("ideaMessage").className = "form-message error";
    $("ideaMessage").textContent = "حسابك غير معتمد للدخول بعد.";
    return;
  }

  const payload = {
    employeeName: employee?.name || "",
    employeeCode: employee?.code || "",
    category: $("category").value,
    title: $("ideaTitle").value.trim(),
    challenge: $("challenge").value.trim(),
    solution: $("solution").value.trim(),
    expectedImpact: $("expectedImpact").value.trim()
  };

  if (!payload.category || !payload.title || !payload.challenge || !payload.solution || !payload.expectedImpact) {
    $("ideaMessage").className = "form-message error";
    $("ideaMessage").textContent = "يرجى إكمال جميع الحقول المطلوبة.";
    return;
  }

  const btn = $("sendIdeaBtn");
  btn.disabled = true;
  btn.textContent = "جاري إرسال الفكرة...";
  try {
    const res = await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "تعذر الإرسال.");
    ["ideaTitle", "challenge", "solution", "expectedImpact"].forEach(id => $(id).value = "");
    $("category").value = "";
    $("ideaMessage").className = "form-message success";
    $("ideaMessage").textContent = `تم تسجيل الفكرة رقم ${data.id} بنجاح، وستنتقل الآن إلى مرحلة التقييم والفرز. ✅`;
  } catch (err) {
    $("ideaMessage").className = "form-message error";
    $("ideaMessage").textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "إرسال الفكرة إلى لجنة التقييم";
  }
});

ensureApprovedEmployee();
