// ==UserScript==
// @name         KIET Attendance Helper
// @namespace    https://github.com/abhishek9th/erp
// @version      1.0.0
// @description  Auto-shows your attendance %, how many classes you can skip, and how many you must attend to stay >= 75% — right on CyberVidya. Piggybacks on your normal login; nothing hardcoded, no password handling.
// @match        https://kiet.cybervidya.net/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // ------------------------------------------------------------------ math
  const P = 0.75;
  const canSkip = (a, t) => (t === 0 ? 0 : Math.max(0, Math.floor(a / P - t)));
  const mustAttend = (a, t) => Math.max(0, Math.ceil((P * t - a) / (1 - P)));

  // ------------------------------------------------------ payload discovery
  // We don't hardcode the attendance endpoint. Instead we hook fetch + XHR
  // and inspect every JSON response the site itself loads. Whichever response
  // contains attendance-shaped rows gets rendered. When you open your
  // attendance page normally, the panel fills in.
  const PRESENT_KEYS = ["presentClasses", "present", "attended", "attendedClasses", "totalPresent", "noOfPresent"];
  const TOTAL_KEYS = ["totalClasses", "total", "held", "deliveredClasses", "totalDelivered", "noOfTotal"];
  const PCT_KEYS = ["percentage", "attendancePercentage", "presentPercentage"];
  const NAME_KEYS = ["courseName", "subject", "subjectName", "course", "name", "paperName"];

  const pick = (o, keys) => {
    for (const k of keys) if (o && o[k] != null) return o[k];
    return undefined;
  };

  function findRows(node, depth = 0) {
    if (depth > 8 || node == null) return [];
    if (Array.isArray(node)) {
      const looksLikeCourses =
        node.length &&
        node.every((r) => r && typeof r === "object" && pick(r, TOTAL_KEYS) != null);
      if (looksLikeCourses) return node;
      for (const item of node) {
        const found = findRows(item, depth + 1);
        if (found.length) return found;
      }
      return [];
    }
    if (typeof node === "object") {
      for (const v of Object.values(node)) {
        const found = findRows(v, depth + 1);
        if (found.length) return found;
      }
    }
    return [];
  }

  function normalize(json) {
    return findRows(json)
      .map((r) => {
        const attended = Number(pick(r, PRESENT_KEYS));
        let total = Number(pick(r, TOTAL_KEYS));
        // Some payloads give % instead of raw present — derive when possible.
        if (!Number.isFinite(attended) && Number.isFinite(total)) return null;
        return {
          course: String(pick(r, NAME_KEYS) ?? "Course"),
          attended,
          total,
          givenPct: Number(pick(r, PCT_KEYS)),
        };
      })
      .filter((c) => c && Number.isFinite(c.attended) && Number.isFinite(c.total) && c.total > 0);
  }

  let lastCourses = null;

  function consider(json) {
    try {
      const courses = normalize(json);
      if (courses.length) {
        lastCourses = courses;
        render(courses);
      }
    } catch (_) {}
  }

  // hook fetch
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    res
      .clone()
      .json()
      .then(consider)
      .catch(() => {});
    return res;
  };

  // hook XHR (Angular's HttpClient uses XHR)
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__url = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener("load", function () {
      const ct = this.getResponseHeader && this.getResponseHeader("content-type");
      if (ct && ct.includes("json")) {
        try {
          consider(JSON.parse(this.responseText));
        } catch (_) {}
      }
    });
    return origSend.apply(this, arguments);
  };

  // --------------------------------------------------------------- rendering
  function ensurePanel() {
    let el = document.getElementById("kiet-att-panel");
    if (el) return el;
    el = document.createElement("div");
    el.id = "kiet-att-panel";
    el.innerHTML = `
      <style>
        #kiet-att-panel{position:fixed;top:16px;right:16px;z-index:999999;width:340px;max-height:80vh;
          overflow:auto;background:#111826;color:#e6ecf5;border:1px solid #2a3550;border-radius:14px;
          font-family:Montserrat,system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.5);}
        #kiet-att-panel .kh{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;
          border-bottom:1px solid #2a3550;position:sticky;top:0;background:#111826;}
        #kiet-att-panel .kh b{font-size:14px;letter-spacing:.02em;}
        #kiet-att-panel .kx{cursor:pointer;color:#8ea0be;font-size:18px;line-height:1;background:none;border:none;}
        #kiet-att-panel .kbody{padding:10px 14px 14px;}
        #kiet-att-panel .kc{background:#1a2233;border:1px solid #2a3550;border-radius:10px;padding:10px 12px;margin:8px 0;}
        #kiet-att-panel .kc.hl{border-color:#4f8cff;}
        #kiet-att-panel .krow{display:flex;justify-content:space-between;align-items:baseline;}
        #kiet-att-panel .kname{font-weight:600;font-size:13px;}
        #kiet-att-panel .kpct{font-size:20px;font-weight:700;}
        #kiet-att-panel .kbar{position:relative;height:6px;background:#0d1220;border-radius:4px;margin:8px 0 6px;overflow:hidden;}
        #kiet-att-panel .kfill{height:100%;}
        #kiet-att-panel .kmark{position:absolute;top:0;left:75%;width:2px;height:100%;background:#8ea0be;}
        #kiet-att-panel .kmeta{color:#8ea0be;font-size:12px;}
        #kiet-att-panel .kverd{font-size:12.5px;margin-top:6px;}
        #kiet-att-panel .kempty{color:#8ea0be;font-size:13px;padding:6px 0;}
        #kiet-att-panel .ok{color:#2fbf71;} #kiet-att-panel .bad{color:#ff5c72;}
      </style>
      <div class="kh"><b>Attendance Helper</b><button class="kx" title="hide">×</button></div>
      <div class="kbody"><div class="kempty">Open your attendance page — this fills in automatically.</div></div>`;
    document.body.appendChild(el);
    el.querySelector(".kx").onclick = () => el.remove();
    return el;
  }

  function card({ course, attended, total, percent, safe, skip, need }, hl) {
    const fill = safe ? "#2fbf71" : "#ff5c72";
    const verdict = safe
      ? `<div class="kverd ok">Can skip <b>${skip}</b> more class${skip === 1 ? "" : "es"}.</div>`
      : `<div class="kverd bad">Attend <b>${need}</b> more in a row to reach 75%.</div>`;
    return `<div class="kc ${hl ? "hl" : ""}">
      <div class="krow"><span class="kname">${course}</span><span class="kpct">${percent.toFixed(1)}%</span></div>
      <div class="kbar"><div class="kfill" style="width:${Math.min(100, percent)}%;background:${fill}"></div><div class="kmark"></div></div>
      <div class="kmeta">${attended} / ${total} classes</div>${verdict}</div>`;
  }

  function evalCourse(c) {
    const percent = (c.attended / c.total) * 100;
    const safe = percent >= P * 100;
    return {
      ...c,
      percent,
      safe,
      skip: safe ? canSkip(c.attended, c.total) : 0,
      need: safe ? 0 : mustAttend(c.attended, c.total),
    };
  }

  function render(courses) {
    const panel = ensurePanel();
    const body = panel.querySelector(".kbody");
    const evald = courses.map(evalCourse);
    const A = courses.reduce((s, c) => s + c.attended, 0);
    const T = courses.reduce((s, c) => s + c.total, 0);
    const overall = evalCourse({ course: "Overall", attended: A, total: T });
    body.innerHTML = card(overall, true) + evald.map((c) => card(c)).join("");
  }

  // show the (empty) panel immediately so you know it's alive
  ensurePanel();
})();
