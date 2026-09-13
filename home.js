const $ = id => document.getElementById(id);
let employee = JSON.parse(localStorage.getItem("bankEmployee") || "null");

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
    localStorage.setItem("bankEmployee", JSON.stringify(employee));
    $("employeeWelcome").textContent = employee.name
      ? `مرحباً، ${employee.name}`
      : `الرقم الوظيفي: ${employee.code}`;
    return true;
  } catch {
    return false;
  }
}

function goToIdeaPage() {
  window.location.href = "idea.html";
}

$("openIdeaTop").addEventListener("click", goToIdeaPage);
$("openIdeaHero").addEventListener("click", goToIdeaPage);
$("myIdeasBtn").addEventListener("click", () => { window.location.href = "dashboard.html"; });

$("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("bankEmployee");
  window.location.href = "index.html";
});

ensureApprovedEmployee();
