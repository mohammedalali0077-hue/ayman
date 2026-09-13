const identityInput = document.getElementById("employeeIdentity");
const continueBtn = document.getElementById("continueBtn");
const loginError = document.getElementById("loginError");

async function login() {
  const identity = identityInput.value.trim();
  if (!identity) {
    loginError.textContent = "يرجى إدخال رقم الموظف أو الاسم للمتابعة.";
    identityInput.focus();
    return;
  }

  continueBtn.disabled = true;
  continueBtn.querySelector("span:first-child").textContent = "جاري التحقق...";
  loginError.textContent = "";

  try {
    const res = await fetch("/api/employee/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success && data.employee) {
      localStorage.setItem("bankEmployee", JSON.stringify(data.employee));
      window.location.href = "home.html";
      return;
    }

    loginError.textContent = data.message || "تعذر تسجيل الدخول.";
    if (data.status === "pending") {
      loginError.classList.add("pending-message");
    } else {
      loginError.classList.remove("pending-message");
    }
  } catch (err) {
    loginError.textContent = "تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مرة أخرى.";
  } finally {
    continueBtn.disabled = false;
    continueBtn.querySelector("span:first-child").textContent = "دخول";
  }
}

continueBtn.addEventListener("click", login);
identityInput.addEventListener("keydown", event => {
  if (event.key === "Enter") login();
});

// لا يتم تحويل الموظف تلقائياً للرئيسية إلا إذا كانت جلسة الدخول موجودة بالفعل.
if (localStorage.getItem("bankEmployee")) {
  window.location.replace("home.html");
}
