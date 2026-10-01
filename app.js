const rates = { USD: null, JPY: null };
let transactions = JSON.parse(localStorage.getItem("transactions") || "[]").map(x => ({ currency: "USD", ...x }));
const won = n => `${Math.round(n).toLocaleString("ko-KR")}원`;
const currentRate = c => c === "JPY" ? rates.JPY * 100 : rates.USD;
const unit = c => c === "JPY" ? "100 JPY" : "1 USD";

function save() { localStorage.setItem("transactions", JSON.stringify(transactions)); }
function updateDecision() {
  if (!rates.USD) return;
  const target = Number(document.querySelector("#target-rate").value), buffer = Number(document.querySelector("#buffer").value);
  const difference = rates.USD - target, title = document.querySelector("#decision-title"), text = document.querySelector("#decision-text"), badge = document.querySelector("#decision-badge");
  document.querySelector("#reference-display").textContent = won(target);
  document.querySelector("#difference-display").textContent = `${difference >= 0 ? "+" : ""}${won(difference)}`;
  badge.className = "badge";
  if (rates.USD <= target) { title.textContent = "USD 매수 기준 도달"; text.textContent = "현재 USD 환율이 설정한 관심 매수 환율 이하입니다."; badge.textContent = "매수 구간"; badge.classList.add("buy"); }
  else if (rates.USD <= target + buffer) { title.textContent = "USD 분할매수 검토"; text.textContent = "관심 매수 환율의 여유폭 안입니다."; badge.textContent = "검토"; badge.classList.add("buy"); }
  else { title.textContent = "USD 관망 구간"; text.textContent = "현재 USD 환율이 매수 기준보다 높습니다."; badge.textContent = "대기"; badge.classList.add("wait"); }
}
function signal(item) {
  if (item.type === "sell") return ["매도 완료", "기록된 매도 건", ""];
  const now = currentRate(item.currency);
  if (!now) return ["계산 중", "", ""];
  const change = (now / item.rate - 1) * 100;
  if (change >= 5) return ["+5% 매도 목표 도달", `현재 ${change.toFixed(1)}% 상승`, "signal-up"];
  if (change <= -5) return ["−5% 손절 기준 도달", `현재 ${Math.abs(change).toFixed(1)}% 하락`, "signal-down"];
  return ["보유", `목표 ${won(item.rate * 1.05)} · 손절 ${won(item.rate * .95)}`, ""];
}
function renderTransactions() {
  const list = document.querySelector("#transactions");
  if (!transactions.length) { list.innerHTML = '<p class="empty-state">아직 기록한 거래가 없습니다.</p>'; return; }
  list.innerHTML = [...transactions].sort((a,b) => b.date.localeCompare(a.date)).map(item => {
    const [label, detail, cls] = signal(item), amount = item.currency === "USD" ? "$" : "¥";
    return `<div class="transaction"><span class="transaction-type">${item.type === "buy" ? "매수" : "매도"}<small>${item.currency}</small></span><span><strong>${amount}${item.usd.toLocaleString("en-US",{maximumFractionDigits:2})}</strong><small>${item.date} · ${won(item.rate)} / ${unit(item.currency)} · <b class="${cls}">${label}</b> ${detail}</small></span><button class="delete-one" data-id="${item.id}" type="button">삭제</button></div>`;
  }).join("");
}
async function fetchRate(currency) {
  const res = await fetch(`https://api.frankfurter.dev/v2/rate/${currency.toLowerCase()}/krw`, { cache: "no-store" });
  if (!res.ok) throw new Error("rate");
  const data = await res.json(), id = currency.toLowerCase(), display = currency === "JPY" ? data.rate * 100 : data.rate;
  rates[currency] = data.rate;
  document.querySelector(`#${id}-rate`).textContent = display.toLocaleString("ko-KR",{minimumFractionDigits:2,maximumFractionDigits:2});
  document.querySelector(`#${id}-rate-date`).textContent = `기준일 ${data.date} · 마지막 접속 시점에 새로 조회됨`;
  document.querySelector(`#${id}-status`).textContent = "최신 조회 완료";
}
async function fetchRates() {
  try { await Promise.all(["USD","JPY"].map(fetchRate)); updateDecision(); renderTransactions(); }
  catch { ["usd","jpy"].forEach(id => document.querySelector(`#${id}-status`).textContent = "연결 확인 필요"); }
}
function importedRecord(row) {
  const currency = String(row.currency || "").toUpperCase(), amount = Number(row.quantity), rate = Number(row.purchase_rate_krw);
  const date = String(row.purchase_date || "").slice(0,10);
  if (!["USD","JPY"].includes(currency) || !date || !amount || !rate) return null;
  return { id: crypto.randomUUID(), type: "buy", currency, date, usd: amount, rate };
}
async function importFile(file) {
  const book = file.name.toLowerCase().endsWith(".csv") ? XLSX.read(await file.text(),{type:"string"}) : XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true});
  const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval:"", raw:false });
  const records = rows.map(importedRecord).filter(Boolean);
  if (!records.length) { alert("purchase_date, currency, quantity, purchase_rate_krw 열을 확인해 주세요."); return; }
  transactions.push(...records); save(); renderTransactions(); alert(`${records.length}건을 불러왔습니다.`);
}
document.querySelector("#refresh-button").addEventListener("click", fetchRates);
document.querySelector("#settings-form").addEventListener("submit", e => { e.preventDefault(); localStorage.setItem("targetRate",document.querySelector("#target-rate").value); localStorage.setItem("buffer",document.querySelector("#buffer").value); updateDecision(); });
document.querySelector("#record-form").addEventListener("submit", e => { e.preventDefault(); const currency=document.querySelector("#transaction-currency").value, amount=Number(document.querySelector("#transaction-usd").value), rate=Number(document.querySelector("#transaction-rate").value); if(!amount||!rate)return; transactions.push({id:crypto.randomUUID(),type:document.querySelector("#transaction-type").value,currency,date:document.querySelector("#transaction-date").value,usd:amount,rate}); save(); e.currentTarget.reset(); document.querySelector("#transaction-date").value=new Date().toISOString().slice(0,10); renderTransactions(); });
document.querySelector("#import-file").addEventListener("change", async e => { if(e.target.files[0]) await importFile(e.target.files[0]); e.target.value=""; });
document.querySelector("#transactions").addEventListener("click", e => { if(e.target.matches(".delete-one")) { transactions=transactions.filter(x=>x.id!==e.target.dataset.id); save(); renderTransactions(); } });
document.querySelector("#clear-records").addEventListener("click", () => { if(transactions.length && confirm("저장된 거래 기록을 모두 삭제할까요?")) { transactions=[]; save(); renderTransactions(); } });
document.querySelector("#target-rate").value=localStorage.getItem("targetRate") || "1350";
document.querySelector("#buffer").value=localStorage.getItem("buffer") || "20";
document.querySelector("#transaction-date").value=new Date().toISOString().slice(0,10);
renderTransactions(); fetchRates();

