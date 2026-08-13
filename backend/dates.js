// Local date parts, never toISOString(): in IST that reports the previous day
// until 05:30, which silently files a morning order under yesterday.
function pad(n) {
  return String(n).padStart(2, '0');
}

function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nowStr(d = new Date()) {
  return `${todayStr(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

module.exports = { todayStr, nowStr };
