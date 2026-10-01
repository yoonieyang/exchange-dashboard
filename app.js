const API_URL = "https://api.frankfurter.dev/v2/rate/usd/krw";
const fields = { target: document.querySelector("#target-rate"), buffer: document.querySelector("#buffer") };
let currentRate = null;
let transactions = JSON.parse(localStorage.getItem("transactions") || "[]");

function won(value) { return `${Math.round(value).toLocaleString("ko-KR")}원`; }

function loadSettings() {
  fields.target.value = localStorage.getItem("targetRate") || "1350";
  fields.buffer.value = localStorage.getItem("buffer") || "20";
}

function updateDecision() {
  if (!currentRate) return;
  const target = Number(fields.target.value);
  const buffer = Number(fields.buffer.value);
  const difference = currentRate - target;
  const title = document.querySelector("#decision-title");
  const text = document.querySelector("#decision-text");
  const badge = document.querySelector("#decision-badge");
  document.querySelector("#reference-display").textContent = won(target);
  document.querySelector("#difference-display").textContent = `${difference >= 0 ? "+" : ""}${won(difference)}`;
  badge.className = "badge";
  if (currentRate <= target) { title.textContent = "매수 기준 도달"; text.textContent = "현재 환율이 설정한 관심 매수 환율 이하입니다. 본인의 자금 계획을 확인해 보세요."; badge.textContent = "매수 구간"; badge.classList.add("buy"); }
  else if (currentRate <= target + buffer) { title.textContent = "분할매수 검토 구간"; text.textContent = "목표 환율보다 조금 높지만, 설정한 여유폭 안입니다. 한 번에 결정하기보다 분할 접근을 검토할 수 있습니다."; badge.textContent = "검토"; badge.classList.add("buy"); }
  else { title.textContent = "관망 구간"; text.textContent = "현재 환율이 설정한 기준보다 높습니다. 다음 변동을 확인해 보세요."; badge.textContent = "대기"; badge.classList.add("wait"); }
}

function money(value) { return `${Math.round(value).toLocaleString("ko-KR")}원`; }

function saveTransactions() { localStorage.setItem("transactions", JSON.stringify(transactions)); }

function normaliseRow(row) {
  const get = (...keys) => keys.map(key => row[key]).find(value => value !== undefined && value !== "");
  const rawType = String(get("구분", "type", "Type") || "").trim().toLowerCase();
  const type = rawType === "매수" || rawType === "buy" ? "buy" : rawType === "매도" || rawType === "sell" ? "sell" : null;
  const dateValue = get("거래일", "date", "Date");
  const usd = Number(get("달러 금액", "달러금액", "usd", "USD"));
  const rate = Number(get("적용 환율", "적용환율", "rate", "Rate"));
  if (!type || !dateValue || !Number.isFinite(usd) || !Number.isFinite(rate) || usd <= 0 || rate <= 0) return null;
  const date = String(dateValue).slice(0, 10);
  return { id: crypto.randomUUID(), type, date, usd, rate };
}

async function importTransactions(file) {
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const workbook = isCsv ? XLSX.read(await file.text(), { type: "string" }) : XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "", raw: false });
  const imported = rows.map(normaliseRow).filter(Boolean);
  if (!imported.length) { alert("읽을 수 있는 거래가 없습니다. 열 이름과 값을 확인해 주세요."); return; }
  transactions = [...transactions, ...imported];
  saveTransactions(); renderPortfolio();
  alert(`${imported.length}건의 거래를 불러왔습니다.`);
}

function renderPortfolio() {
  const summary = [...transactions].sort((a, b) => a.date.localeCompare(b.date)).reduce((acc, item) => {
    if (item.type === "buy") { acc.usd += item.usd; acc.cost += item.usd * item.rate; }
    else { const averageBeforeSale = acc.usd ? acc.cost / acc.usd : 0; acc.usd -= item.usd; acc.cost -= item.usd * averageBeforeSale; }
    return acc;
  }, { usd: 0, cost: 0 });
  const average = summary.usd > 0 ? summary.cost / summary.usd : 0;
  const value = currentRate ? summary.usd * currentRate : 0;
  const pnl = currentRate ? value - summary.cost : 0;
  document.querySelector("#holding-usd").textContent = `$${summary.usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  document.querySelector("#average-rate").textContent = average ? won(average) : "—";
  document.querySelector("#market-value").textContent = currentRate ? money(value) : "—";
  const pnlElement = document.querySelector("#unrealized-pnl");
  pnlElement.textContent = currentRate ? `${pnl >= 0 ? "+" : ""}${money(pnl)}` : "—";
  pnlElement.style.color = pnl > 0 ? "#145c3c" : pnl < 0 ? "#b64e14" : "";

  const list = document.querySelector("#transactions");
  if (!transactions.length) { list.innerHTML = '<p class="empty-state">아직 기록한 거래가 없습니다.</p>'; return; }
  list.innerHTML = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).map(item => `
    <div class="transaction"><span class="transaction-type">${item.type === "buy" ? "매수" : "매도"}</span><span><strong>$${item.usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong><small>${item.date} · ${won(item.rate)}</small></span><button class="delete-one" data-id="${item.id}" type="button">삭제</button></div>`).join("");
}

async function fetchRate() {
  const status = document.querySelector("#status");
  status.textContent = "업데이트 중";
  try {
    const response = await fetch(API_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("환율 데이터를 가져오지 못했습니다.");
    const data = await response.json();
    currentRate = data.rate;
    document.querySelector("#rate").textContent = Number(data.rate).toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.querySelector("#rate-date").textContent = `기준일 ${data.date} · 마지막 접속 시점에 새로 조회됨`;
    status.textContent = "최신 조회 완료";
    updateDecision();
    renderPortfolio();
  } catch (error) {
    status.textContent = "연결 확인 필요";
    document.querySelector("#rate-date").textContent = "환율 정보를 불러오지 못했습니다. 인터넷 연결 후 다시 시도해 주세요.";
  }
}

document.querySelector("#refresh-button").addEventListener("click", fetchRate);
document.querySelector("#settings-form").addEventListener("submit", (event) => { event.preventDefault(); localStorage.setItem("targetRate", fields.target.value); localStorage.setItem("buffer", fields.buffer.value); updateDecision(); });
document.querySelector("#record-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const usd = Number(document.querySelector("#transaction-usd").value);
  const rate = Number(document.querySelector("#transaction-rate").value);
  if (!usd || !rate) return;
  const type = document.querySelector("#transaction-type").value;
  const heldUsd = [...transactions].sort((a, b) => a.date.localeCompare(b.date)).reduce((total, item) => total + (item.type === "buy" ? item.usd : -item.usd), 0);
  if (type === "sell" && usd > heldUsd) { alert(`현재 기록상 보유 달러는 $${heldUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}입니다.`); return; }
  transactions.push({ id: crypto.randomUUID(), type, date: document.querySelector("#transaction-date").value, usd, rate });
  saveTransactions(); event.currentTarget.reset(); document.querySelector("#transaction-date").value = new Date().toISOString().slice(0, 10); renderPortfolio();
});
document.querySelector("#transactions").addEventListener("click", (event) => { if (!event.target.matches(".delete-one")) return; transactions = transactions.filter(item => item.id !== event.target.dataset.id); saveTransactions(); renderPortfolio(); });
document.querySelector("#import-file").addEventListener("change", async (event) => { const file = event.target.files[0]; if (file) await importTransactions(file); event.target.value = ""; });
document.querySelector("#clear-records").addEventListener("click", () => { if (!transactions.length || !confirm("저장된 거래 기록을 모두 삭제할까요?")) return; transactions = []; saveTransactions(); renderPortfolio(); });
loadSettings();
document.querySelector("#transaction-date").value = new Date().toISOString().slice(0, 10);
renderPortfolio();
fetchRate();

