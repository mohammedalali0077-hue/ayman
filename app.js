const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();

const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || "admin").trim();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "123456").trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_SECRET_KEY = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const supabase = SUPABASE_URL && SUPABASE_SECRET_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function dbConfigured(res) {
  if (supabase) return true;
  res.status(503).json({
    message: "قاعدة البيانات غير مهيأة. أضف SUPABASE_URL و SUPABASE_SECRET_KEY إلى متغيرات البيئة."
  });
  return false;
}

function adminAuthorized(req) {
  const username = clean(String(req.headers["x-admin-username"] || ""));
  const password = clean(String(req.headers["x-admin-password"] || ""));
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

function identityToEmployee(identity) {
  const value = clean(identity);
  const looksLikeCode = /^[0-9٠-٩\-\s]+$/.test(value);
  return looksLikeCode
    ? { employeeName: "", employeeCode: value, identityKey: `code:${value}` }
    : { employeeName: value, employeeCode: "", identityKey: `name:${value.toLocaleLowerCase("ar")}` };
}

function employeeIdentityKey(employeeName, employeeCode) {
  const code = clean(employeeCode);
  if (code) return `code:${code}`;
  const name = clean(employeeName);
  return name ? `name:${name.toLocaleLowerCase("ar")}` : "";
}

async function employeeIsApproved(employeeName, employeeCode) {
  const identityKey = employeeIdentityKey(employeeName, employeeCode);
  if (!identityKey || !supabase) return false;

  const { data, error } = await supabase
    .from("employee_registrations")
    .select("status")
    .eq("identity_key", identityKey)
    .maybeSingle();

  if (error) throw error;
  return data?.status === "approved";
}

async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (err) {
    console.error("Telegram error:", err.message);
  }
}

app.get("/api/health", (req, res) => {
  res.json({ success: true, databaseConfigured: Boolean(supabase) });
});

app.post("/api/employee/login", async (req, res) => {
  if (!dbConfigured(res)) return;

  try {
    const identity = clean(req.body.identity);
    if (!identity) {
      return res.status(400).json({ message: "يرجى إدخال رقم الموظف أو الاسم." });
    }

    const employee = identityToEmployee(identity);
    const { data: existing, error: findError } = await supabase
      .from("employee_registrations")
      .select("*")
      .eq("identity_key", employee.identityKey)
      .maybeSingle();

    if (findError) throw findError;

    if (!existing) {
      const { error: insertError } = await supabase
        .from("employee_registrations")
        .insert({
          identity_key: employee.identityKey,
          employee_name: employee.employeeName || null,
          employee_code: employee.employeeCode || null,
          status: "pending"
        });

      if (insertError) {
        // لو أرسل الموظف الطلب نفسه في نفس اللحظة، نكمل كطلب معلّق بدلاً من إظهار خطأ.
        if (insertError.code !== "23505") throw insertError;
      }

      return res.status(202).json({
        success: false,
        status: "pending",
        message: "تم إرسال طلب تسجيلك إلى الإدارة. يمكنك الدخول بعد موافقة الأدمن."
      });
    }

    if (existing.status === "approved") {
      return res.json({
        success: true,
        status: "approved",
        employee: {
          name: existing.employee_name || "",
          code: existing.employee_code || ""
        }
      });
    }

    if (existing.status === "rejected") {
      return res.status(403).json({
        success: false,
        status: "rejected",
        message: "تم رفض طلب التسجيل. يرجى مراجعة الإدارة."
      });
    }

    return res.status(202).json({
      success: false,
      status: "pending",
      message: "طلب تسجيلك بانتظار موافقة الإدارة."
    });
  } catch (error) {
    console.error("Employee login error:", error);
    res.status(500).json({ message: "حدث خطأ أثناء معالجة طلب التسجيل." });
  }
});

app.post("/api/admin/login", (req, res) => {
  const username = clean(req.body.username);
  const password = clean(req.body.password);

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return res.json({ success: true });
  }
  res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة." });
});

app.get("/api/admin/registrations", async (req, res) => {
  if (!adminAuthorized(req)) return res.status(401).json({ message: "غير مصرح." });
  if (!dbConfigured(res)) return;

  try {
    const { data, error } = await supabase
      .from("employee_registrations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const order = { pending: 0, approved: 1, rejected: 2 };
    data.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
    res.json(data);
  } catch (error) {
    console.error("Load registrations error:", error);
    res.status(500).json({ message: "تعذر تحميل طلبات تسجيل الموظفين." });
  }
});

app.patch("/api/admin/registrations/:id", async (req, res) => {
  if (!adminAuthorized(req)) return res.status(401).json({ message: "غير مصرح." });
  if (!dbConfigured(res)) return;

  const status = clean(req.body.status);
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "حالة التسجيل غير صالحة." });
  }

  try {
    const { data, error } = await supabase
      .from("employee_registrations")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "طلب التسجيل غير موجود." });
    res.json({ success: true });
  } catch (error) {
    console.error("Review registration error:", error);
    res.status(500).json({ message: "تعذر تحديث طلب التسجيل." });
  }
});

app.post("/api/ideas", async (req, res) => {
  if (!dbConfigured(res)) return;

  try {
    const employeeName = clean(req.body.employeeName);
    const employeeCode = clean(req.body.employeeCode);
    const category = clean(req.body.category);
    const title = clean(req.body.title);
    const challenge = clean(req.body.challenge);
    const solution = clean(req.body.solution);
    const expectedImpact = clean(req.body.expectedImpact);

    if ((!employeeName && !employeeCode) || !category || !title || !challenge || !solution || !expectedImpact) {
      return res.status(400).json({ message: "يرجى إكمال جميع حقول الفكرة المطلوبة." });
    }

    if (!(await employeeIsApproved(employeeName, employeeCode))) {
      return res.status(403).json({ message: "يجب موافقة الإدارة على تسجيل الموظف قبل إرسال الأفكار." });
    }

    const { data, error } = await supabase
      .from("ideas")
      .insert({
        employee_name: employeeName || null,
        employee_code: employeeCode || null,
        category,
        title,
        challenge,
        solution,
        expected_impact: expectedImpact,
        status: "جديدة"
      })
      .select("id")
      .single();

    if (error) throw error;

    const telegramText = [
      "💡 فكرة جديدة - بنك الأفكار",
      `رقم الفكرة: ${data.id}`,
      `الموظف: ${employeeName || "غير مذكور"}`,
      `الرقم الوظيفي: ${employeeCode || "غير مذكور"}`,
      `المجال: ${category}`,
      `العنوان: ${title}`,
      "",
      `التحدي: ${challenge}`,
      "",
      `الحل المقترح: ${solution}`,
      "",
      `الأثر المتوقع: ${expectedImpact}`
    ].join("\n");

    void sendTelegramMessage(telegramText);
    res.json({ success: true, id: data.id, message: "تم تسجيل الفكرة وإرسالها للتقييم." });
  } catch (error) {
    console.error("Create idea error:", error);
    res.status(500).json({ message: "تعذر تسجيل الفكرة حالياً." });
  }
});

app.get("/api/my-ideas", async (req, res) => {
  if (!dbConfigured(res)) return;

  try {
    const employeeName = clean(req.query.employeeName);
    const employeeCode = clean(req.query.employeeCode);

    if (!employeeName && !employeeCode) {
      return res.status(400).json({ message: "بيانات الموظف مطلوبة." });
    }

    if (!(await employeeIsApproved(employeeName, employeeCode))) {
      return res.status(403).json({ message: "حساب الموظف غير معتمد من الإدارة." });
    }

    let query = supabase
      .from("ideas")
      .select("id, category, title, challenge, solution, expected_impact, status, feasibility, ease, roi, admin_notes, created_at, updated_at")
      .order("id", { ascending: false });

    query = employeeCode
      ? query.eq("employee_code", employeeCode)
      : query.eq("employee_name", employeeName);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Load employee ideas error:", error);
    res.status(500).json({ message: "تعذر تحميل أفكار الموظف." });
  }
});

app.get("/api/admin/ideas", async (req, res) => {
  if (!adminAuthorized(req)) return res.status(401).json({ message: "غير مصرح." });
  if (!dbConfigured(res)) return;

  try {
    const { data, error } = await supabase
      .from("ideas")
      .select("*")
      .order("id", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Load ideas error:", error);
    res.status(500).json({ message: "تعذر تحميل الأفكار." });
  }
});

app.patch("/api/admin/ideas/:id", async (req, res) => {
  if (!adminAuthorized(req)) return res.status(401).json({ message: "غير مصرح." });
  if (!dbConfigured(res)) return;

  const allowedStatuses = ["جديدة", "قيد التقييم", "معتمدة", "قيد التنفيذ", "منفذة", "مرفوضة"];
  const status = clean(req.body.status);
  const notes = clean(req.body.adminNotes);
  const feasibility = req.body.feasibility === "" || req.body.feasibility == null ? null : Number(req.body.feasibility);
  const ease = req.body.ease === "" || req.body.ease == null ? null : Number(req.body.ease);
  const roi = req.body.roi === "" || req.body.roi == null ? null : Number(req.body.roi);

  if (!allowedStatuses.includes(status)) return res.status(400).json({ message: "حالة غير صالحة." });
  for (const score of [feasibility, ease, roi]) {
    if (score !== null && (!Number.isInteger(score) || score < 1 || score > 5)) {
      return res.status(400).json({ message: "درجات التقييم يجب أن تكون من 1 إلى 5." });
    }
  }

  try {
    const { data, error } = await supabase
      .from("ideas")
      .update({
        status,
        feasibility,
        ease,
        roi,
        admin_notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", req.params.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "الفكرة غير موجودة." });
    res.json({ success: true });
  } catch (error) {
    console.error("Update idea error:", error);
    res.status(500).json({ message: "تعذر حفظ التقييم." });
  }
});

app.delete("/api/admin/ideas/:id", async (req, res) => {
  if (!adminAuthorized(req)) return res.status(401).json({ message: "غير مصرح." });
  if (!dbConfigured(res)) return;

  try {
    const { error } = await supabase.from("ideas").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error("Delete idea error:", error);
    res.status(500).json({ message: "تعذر حذف الفكرة." });
  }
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: "حدث خطأ غير متوقع في الخادم." });
});

// Vercel يكتشف app.js تلقائياً ويشغّل تطبيق Express كـ Function واحدة.
module.exports = app;
