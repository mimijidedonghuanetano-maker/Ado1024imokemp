const { getStore, connectLambda } = require("@netlify/blobs");

const STORE_NAME = "ado-support";
const KEY = "supports";

function json(data, status = 200) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    body: JSON.stringify(data),
  };
}

function cleanX(x) {
  return String(x || "").trim().replace(/^@/, "").slice(0, 50);
}
function cleanText(x) {
  return String(x || "").trim().slice(0, 50);
}

async function loadAll(store) {
  const data = await store.get(KEY, { type: "json" });
  return Array.isArray(data) ? data : [];
}
async function saveAll(store, list) {
  await store.setJSON(KEY, list);
}

async function hmac(secret, text) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function makeToken(adminPassword) {
  const exp = Date.now() + 1000 * 60 * 60 * 12;
  const body = String(exp);
  return body + "." + (await hmac(adminPassword, body));
}
async function validToken(adminPassword, token) {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return (await hmac(adminPassword, exp)) === sig;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

exports.handler = async (event) => {
  connectLambda(event);
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Ado1024loveforever";
  const store = getStore(STORE_NAME);

  let sub = event.path.replace(/^(\/\.netlify\/functions\/api|\/api)/, "");
  if (!sub) sub = "/";
  const method = event.httpMethod;

  try {
    if (method === "GET" && sub === "/count") {
      const list = await loadAll(store);
      const count = list.filter((r) => !r.deleted_at).length;
      return json({ count });
    }

    if (method === "GET" && sub === "/messages") {
      const list = await loadAll(store);
      const cutoff = Date.now() - 30 * 60 * 1000;
      const visible = list.filter((r) => !r.deleted_at && new Date(r.created_at).getTime() <= cutoff);
      const messages = shuffle(visible)
        .slice(0, 100)
        .map((r) => ({ x_id: r.x_id, message: r.message }));
      return json({ messages });
    }

    if (method === "POST" && sub === "/submit") {
      let b;
      try {
        b = JSON.parse(event.body || "{}");
      } catch {
        return json({ error: "入力形式が正しくありません" }, 400);
      }
      const x = cleanX(b.x_id);
      const song = String(b.song || "").trim().slice(0, 100);
      const message = cleanText(b.message);
      if (!x || !song || !message) return json({ error: "すべて入力してください" }, 400);
      if (message.length > 50) return json({ error: "メッセージは50文字以内です" }, 400);
      if (!/^[A-Za-z0-9_.\-]{1,50}$/.test(x)) return json({ error: "X IDの形式を確認してください" }, 400);

      const list = await loadAll(store);
      list.push({
        id: crypto.randomUUID(),
        x_id: x,
        song,
        message,
        created_at: new Date().toISOString(),
        deleted_at: null,
      });
      await saveAll(store, list);
      return json({ ok: true });
    }

    if (method === "POST" && sub === "/admin/login") {
      let b;
      try {
        b = JSON.parse(event.body || "{}");
      } catch {
        return json({ error: "入力形式が正しくありません" }, 400);
      }
      if (!ADMIN_PASSWORD) return json({ error: "管理パスワードが未設定です" }, 500);
      if (String(b.password || "") !== ADMIN_PASSWORD) return json({ error: "パスワードが違います" }, 401);
      return json({ token: await makeToken(ADMIN_PASSWORD) });
    }

    if (sub.startsWith("/admin/")) {
      const auth = event.headers.authorization || event.headers.Authorization || "";
      const token = auth.replace(/^Bearer\s+/i, "");
      if (!ADMIN_PASSWORD || !(await validToken(ADMIN_PASSWORD, token))) {
        return json({ error: "認証が必要です" }, 401);
      }

      if (method === "GET" && sub === "/admin/supports") {
        const list = await loadAll(store);
        const items = list
          .slice()
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 1000);
        return json({ items });
      }

      if (method === "POST" && sub === "/admin/delete") {
        let b;
        try {
          b = JSON.parse(event.body || "{}");
        } catch {
          return json({ error: "入力形式が正しくありません" }, 400);
        }
        const id = String(b.id || "");
        const list = await loadAll(store);
        const idx = list.findIndex((r) => r.id === id);
        if (idx !== -1) {
          list[idx].deleted_at = new Date().toISOString();
          await saveAll(store, list);
        }
        return json({ ok: true });
      }
    }

    return json({ error: "Not Found" }, 404);
  } catch (err) {
    return json({ error: "サーバーエラー: " + (err && err.message ? err.message : String(err)) }, 500);
  }
};
