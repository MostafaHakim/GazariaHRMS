// ছোট in-memory রেট লিমিটার (অতিরিক্ত প্যাকেজ ছাড়া)।
// একই IP + username থেকে WINDOW এর মধ্যে MAX বারের বেশি ব্যর্থ লগইন করলে সাময়িক ব্লক।
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;

const fails = new Map(); // key -> { count, resetAt }

const keyOf = (req) =>
  `${req.ip}|${String(req.body?.username || "").toLowerCase()}`;

const loginRateLimit = (req, res, next) => {
  const key = keyOf(req);
  const entry = fails.get(key);

  if (entry && entry.resetAt > Date.now() && entry.count >= MAX_FAILS) {
    const mins = Math.ceil((entry.resetAt - Date.now()) / 60000);
    return res.status(429).json({
      success: false,
      message: `Too many failed attempts. Try again in ${mins} minute(s).`,
    });
  }
  next();
};

const recordLoginFailure = (req) => {
  const key = keyOf(req);
  const now = Date.now();
  const entry = fails.get(key);
  if (!entry || entry.resetAt <= now) {
    fails.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
};

const clearLoginFailures = (req) => fails.delete(keyOf(req));

// মেমরি লিক ঠেকাতে পুরনো এন্ট্রি মুছে ফেলা
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of fails) if (v.resetAt <= now) fails.delete(k);
}, 10 * 60 * 1000).unref();

module.exports = { loginRateLimit, recordLoginFailure, clearLoginFailures };
