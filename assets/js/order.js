// Auto-fill today's date into startDate and endDate if empty
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0');
const dd = String(today.getDate()).padStart(2, '0');
const todayStr = `${yyyy}-${mm}-${dd}`;
if (startEl && !startEl.value) startEl.value = todayStr;
if (endEl && !endEl.value) endEl.value = todayStr;
recalc();