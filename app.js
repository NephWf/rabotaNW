const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const WEEKDAYS = ["вс","пн","вт","ср","чт","пт","сб"];
const KEY = "rabota-nw-v1";
const SEED = {
  "2026-09": {
    norm: 200,
    days: {
      "2026-09-01":"-","2026-09-02":"-","2026-09-03":"-","2026-09-04":"-","2026-09-05":"-","2026-09-06":"-",
      "2026-09-07":212,"2026-09-08":219,"2026-09-09":222,"2026-09-10":220,"2026-09-11":217,
      "2026-09-12":"-","2026-09-13":"-",
      "2026-09-14":229,"2026-09-15":224,"2026-09-16":204,"2026-09-17":"-","2026-09-18":212,
      "2026-09-19":"-","2026-09-20":"-",
      "2026-09-21":"-","2026-09-22":"-","2026-09-23":"-","2026-09-24":222,"2026-09-25":228,
      "2026-09-26":"-","2026-09-27":"-",
      "2026-09-28":"-","2026-09-29":"-","2026-09-30":211
    }
  }
};

let db = load();
let cursor = { y: new Date().getFullYear(), m: new Date().getMonth() };
let view = "month";
let deferredPrompt = null;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return structuredClone(SEED);
}
function save() { localStorage.setItem(KEY, JSON.stringify(db)); }
function monthKey(y, m) { return y + "-" + String(m + 1).padStart(2, "0"); }
function iso(y, m, d) { return y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0"); }
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function excelRound(n) { return Math.sign(n) * Math.round(Math.abs(n)) || 0; }
function record() {
  const key = monthKey(cursor.y, cursor.m);
  if (!db[key]) db[key] = { norm: 200, days: {} };
  return db[key];
}
function valueOf(id, weekday) {
  const stored = record().days[id];
  if (stored !== undefined) return stored;
  return weekday === 0 || weekday === 6 ? "-" : "";
}
function summarize() {
  const rec = record();
  const rows = [];
  const total = daysInMonth(cursor.y, cursor.m);
  for (let d = 1; d <= total; d++) {
    const date = new Date(cursor.y, cursor.m, d);
    const id = iso(cursor.y, cursor.m, d);
    rows.push({ d, id, wd: date.getDay(), raw: valueOf(id, date.getDay()) });
  }
  const sum = rows.filter((r) => typeof r.raw === "number").reduce((a, r) => a + r.raw, 0);
  const offs = rows.filter((r) => r.raw === "-").length;
  const blanks = rows.filter((r) => r.raw === "").length;
  const counted = rows.length - offs;
  const plan = counted * rec.norm;
  const extra = sum - plan;
  let statusText, kind, perDay = null;
  if (blanks) {
    perDay = excelRound((plan - sum) / blanks);
    statusText = "Пров. в день: " + perDay;
    kind = perDay <= rec.norm ? "good" : "wait";
  } else {
    statusText = "Излишек за месяц: " + extra;
    kind = extra >= 0 ? "good" : "bad";
  }
  return { rows, sum, plan, counted, blanks, offs, statusText, kind, ratio: sum + "/" + plan, extra };
}
function setDay(id, raw) {
  const text = String(raw).trim().replace(",", ".");
  let value = "";
  if (text === "-" || text === "—" || text.toLowerCase() === "вых") value = "-";
  else if (text !== "") {
    const n = Number(text);
    value = Number.isFinite(n) ? n : "";
  }
  record().days[id] = value;
  save();
  render();
}
function render() {
  const rec = record();
  const s = summarize();
  document.getElementById("month-label").textContent = MONTHS[cursor.m] + " " + cursor.y;
  document.getElementById("page-title").textContent = { month: "Месяц", days: "Дни", stats: "Сводка", more: "Ещё" }[view];
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  document.getElementById("view-month").classList.toggle("hidden", view !== "month");
  document.getElementById("view-days").classList.toggle("hidden", view !== "days");
  document.getElementById("view-stats").classList.toggle("hidden", view !== "stats");
  document.getElementById("view-more").classList.toggle("hidden", view !== "more");
  const pct = s.plan ? Math.min(1, s.sum / s.plan) : 0;
  document.getElementById("view-month").innerHTML = `
    <section class="card hero">
      <div class="ring-wrap">
        <svg class="ring" viewBox="0 0 140 140" aria-hidden="true">
          <circle class="ring-bg" cx="70" cy="70" r="54"></circle>
          <circle class="ring-fg" cx="70" cy="70" r="54" style="stroke-dashoffset:${339 * (1 - pct)};stroke:${s.kind === "bad" ? "var(--bad)" : "var(--accent)"}"></circle>
        </svg>
        <div class="ring-center"><strong>${s.sum}</strong><span>из ${s.plan}</span></div>
      </div>
      <div>
        <div class="meta"><span class="muted">Норма</span><b>${rec.norm}</b></div>
        <div class="meta"><span class="muted">В зачёте</span><b>${s.counted}</b></div>
        <div class="meta"><span class="muted">Пустых</span><b>${s.blanks}</b></div>
        <div class="meta"><span class="muted">Выходных</span><b>${s.offs}</b></div>
      </div>
    </section>
    <span class="status ${s.kind}">${s.statusText}</span>
    <p class="muted">${s.blanks ? "Пустые дни ещё открыты. «Пров. в день» — сколько нужно сделать в каждый из них, чтобы закрыть план." : "Все дни закрыты. Излишек — сумма минус план."}</p>`;
  document.getElementById("view-days").innerHTML = s.rows.map((row) => {
    const delta = typeof row.raw === "number" ? row.raw - rec.norm : null;
    return `<div class="card day-row ${row.raw === "-" ? "off" : ""}">
      <div><b>${String(row.d).padStart(2, "0")}</b><div class="muted">${WEEKDAYS[row.wd]}</div></div>
      <input data-day="${row.id}" value="${row.raw === "" ? "" : row.raw}" placeholder="пусто" inputmode="decimal" />
      <div style="display:flex;align-items:center;gap:6px">
        <span class="delta ${delta === null ? "" : delta >= 0 ? "up" : "down"}">${delta === null ? (row.raw === "-" ? "вых" : "—") : (delta > 0 ? "+" : "") + delta}</span>
        <button class="mini ${row.raw === "-" ? "on" : ""}" data-off="${row.id}" type="button" aria-label="Выходной">−</button>
      </div>
    </div>`;
  }).join("");
  const bars = s.rows.filter((r) => r.raw !== "-").map((r) => {
    const val = typeof r.raw === "number" ? r.raw : 0;
    const h = Math.max(6, Math.min(100, val / (rec.norm * 1.4) * 100));
    return `<i style="height:${h}%" title="${r.d}"></i>`;
  }).join("");
  document.getElementById("view-stats").innerHTML = `
    <section class="card"><h2>${s.ratio}</h2><p class="muted">${s.statusText}</p><div class="bars">${bars}</div></section>
    <section class="card"><p class="muted">Сумма делится на число дней, которые не отмечены как «-», умноженное на норму. Пустая ячейка входит в план и в «Пров. в день».</p><div class="formula">${s.ratio}<br>${s.statusText}</div></section>`;
  document.getElementById("view-more").innerHTML = `
    <section class="card">
      <h2>Норма</h2>
      <label>В день<input id="norm" type="number" min="1" value="${rec.norm}" /></label>
      <button class="btn" id="weekends" type="button">Выходные как «-»</button>
    </section>
    <section class="card">
      <h2>Данные</h2>
      <p class="muted">Хранятся только на этом устройстве.</p>
      <button class="btn" id="export" type="button">Скачать JSON</button>
      <button class="btn" id="import" type="button">Загрузить JSON</button>
      <button class="btn danger" id="reset-month" type="button">Сбросить месяц</button>
      <button class="btn" id="reset-all" type="button">Сбросить всё</button>
    </section>`;
  bind();
}
function bind() {
  document.querySelectorAll("[data-day]").forEach((input) => input.addEventListener("change", () => setDay(input.dataset.day, input.value)));
  document.querySelectorAll("[data-off]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.off;
    setDay(id, record().days[id] === "-" ? "" : "-");
  }));
  const norm = document.getElementById("norm");
  if (norm) norm.addEventListener("change", () => {
    const n = Number(norm.value);
    record().norm = Number.isFinite(n) && n > 0 ? n : 200;
    save();
    render();
  });
  const weekends = document.getElementById("weekends");
  if (weekends) weekends.addEventListener("click", () => {
    const rec = record();
    const total = daysInMonth(cursor.y, cursor.m);
    for (let d = 1; d <= total; d++) {
      const date = new Date(cursor.y, cursor.m, d);
      if (date.getDay() === 0 || date.getDay() === 6) rec.days[iso(cursor.y, cursor.m, d)] = "-";
    }
    save();
    render();
  });
  const exp = document.getElementById("export");
  if (exp) exp.addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: "application/json" }));
    a.download = "rabota.json";
    a.click();
  });
  const imp = document.getElementById("import");
  if (imp) imp.addEventListener("click", () => document.getElementById("import-file").click());
  const resetMonth = document.getElementById("reset-month");
  if (resetMonth) resetMonth.addEventListener("click", () => {
    if (!confirm("Сбросить текущий месяц?")) return;
    db[monthKey(cursor.y, cursor.m)] = { norm: 200, days: {} };
    save();
    render();
  });
  const resetAll = document.getElementById("reset-all");
  if (resetAll) resetAll.addEventListener("click", () => {
    if (!confirm("Удалить все данные приложения?")) return;
    db = {};
    save();
    render();
  });
}
function openSheet(html) {
  document.getElementById("sheet-body").innerHTML = html;
  document.getElementById("sheet").classList.remove("hidden");
}
document.getElementById("prev-month").addEventListener("click", () => {
  const date = new Date(cursor.y, cursor.m - 1, 1);
  cursor = { y: date.getFullYear(), m: date.getMonth() };
  render();
});
document.getElementById("next-month").addEventListener("click", () => {
  const date = new Date(cursor.y, cursor.m + 1, 1);
  cursor = { y: date.getFullYear(), m: date.getMonth() };
  render();
});
document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
  view = tab.dataset.view;
  render();
}));
document.getElementById("sheet-close").addEventListener("click", () => document.getElementById("sheet").classList.add("hidden"));
document.getElementById("import-file").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    db = JSON.parse(await file.text());
    save();
    render();
  } catch (e) {
    alert("Не получилось прочитать JSON");
  }
});

const installBtn = document.getElementById("btn-install");
const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
if (installBtn && !standalone) installBtn.classList.remove("hidden");
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installBtn.classList.remove("hidden");
});
window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  installBtn.classList.add("hidden");
});
installBtn.addEventListener("click", async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.classList.add("hidden");
    return;
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  openSheet(ios
    ? "<h2>На экран «Домой»</h2><p class='muted'>В Safari нажмите «Поделиться», затем «На экран Домой».</p>"
    : "<h2>Установить</h2><p class='muted'>Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».</p>");
});
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
render();
