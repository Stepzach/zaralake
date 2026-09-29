const GIGS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTJM1n0L2wyP6LQ4jbPpPftXitGZFck6dNeyM7bztnMmOl8a4xQO8u0IQugImzqwJw_KW9Y0-id-7wR/pub?output=csv";

// Add these two URLs when ready. The site is deliberately safe if they are left blank.
const BOOKING_FORM_URL = "";
const INSTAGRAM_URL = "";

document.addEventListener("DOMContentLoaded", () => {
  initMenu();
  initExternalLinks();
  initLightbox();
  loadGigs();
  document.querySelectorAll("[data-year]").forEach(el => el.textContent = new Date().getFullYear());
});

function initMenu() {
  const button = document.querySelector("[data-menu-button]");
  const nav = document.querySelector("[data-nav]");
  if (!button || !nav) return;

  const setOpen = (open) => {
    button.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
  };

  button.addEventListener("click", () => setOpen(button.getAttribute("aria-expanded") !== "true"));
  nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && button.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      button.focus();
    }
  });
  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 801px)").matches) setOpen(false);
  });
}

function initExternalLinks() {
  document.querySelectorAll("[data-booking-link]").forEach(link => {
    if (BOOKING_FORM_URL) link.href = BOOKING_FORM_URL;
    else {
      link.removeAttribute("target");
      link.addEventListener("click", event => {
        event.preventDefault();
        window.location.href = "mailto:hello@zaralakemusic.com?subject=Booking%20enquiry";
      });
    }
  });

  document.querySelectorAll("[data-instagram-link]").forEach(link => {
    if (INSTAGRAM_URL) {
      link.href = INSTAGRAM_URL;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    } else {
      link.addEventListener("click", event => event.preventDefault());
      link.setAttribute("aria-disabled", "true");
      link.title = "Instagram link to be added";
    }
  });
}

function initLightbox() {
  const dialog = document.querySelector("[data-lightbox]");
  const image = document.querySelector("[data-lightbox-image]");
  const close = document.querySelector("[data-lightbox-close]");
  if (!dialog || !image || !close || typeof dialog.showModal !== "function") return;

  document.querySelectorAll("[data-lightbox-src]").forEach(button => {
    button.addEventListener("click", () => {
      const thumb = button.querySelector("img");
      image.src = button.dataset.lightboxSrc || thumb?.src || "";
      image.alt = thumb?.alt || "Gallery image";
      dialog.showModal();
    });
  });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    const rect = dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) dialog.close();
  });
  dialog.addEventListener("close", () => { image.src = ""; });
}

async function loadGigs() {
  const list = document.querySelector("#gig-list");
  if (!list) return;

  try {
    const response = await fetch(GIGS_CSV_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Gig feed returned ${response.status}`);
    const csv = await response.text();
    const gigs = parseCSV(csv)
      .map(normalizeGig)
      .filter(gig => gig.visible && gig.date && gig.date >= startOfToday())
      .sort((a, b) => a.date - b.date);

    list.replaceChildren();
    list.setAttribute("aria-busy", "false");
    if (!gigs.length) {
      list.innerHTML = '<p class="status">No upcoming gigs listed right now — check back soon.</p>';
      return;
    }
    gigs.forEach(gig => list.append(createGigCard(gig)));
  } catch (error) {
    console.error("Could not load gigs", error);
    list.setAttribute("aria-busy", "false");
    list.innerHTML = '<p class="status">Upcoming gigs couldn\'t be loaded right now. Please check back soon.</p>';
  }
}

function parseCSV(csv) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i], next = csv[i + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(value); rows.push(row); row = []; value = "";
    } else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return rows.filter(r => r.some(v => v.trim())).map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] || "").trim()])));
}

function normalizeGig(gig) {
  return {
    date: parseDate(gig.date),
    venue: gig.venue || "Live performance",
    location: gig.location || "",
    time: gig.time || "",
    description: gig.description || "",
    link: safeHttpUrl(gig.link),
    visible: !gig.visible || gig.visible.toLowerCase() === "true" || gig.visible === "1"
  };
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function safeHttpUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function createGigCard(gig) {
  const article = document.createElement("article");
  article.className = "gig-card";

  const date = document.createElement("time");
  date.className = "gig-date";
  date.dateTime = gig.date.toISOString().slice(0, 10);
  const day = document.createElement("strong");
  day.textContent = gig.date.getDate();
  const month = document.createElement("span");
  month.textContent = gig.date.toLocaleDateString("en-GB", { month: "short" });
  date.append(day, month);

  const info = document.createElement("div");
  info.className = "gig-info";
  const title = document.createElement("h3");
  title.textContent = gig.venue;
  info.append(title);
  if (gig.location) { const p = document.createElement("p"); p.textContent = gig.location; info.append(p); }
  if (gig.time) { const p = document.createElement("p"); p.className = "gig-time"; p.textContent = gig.time; info.append(p); }
  if (gig.description) { const p = document.createElement("p"); p.textContent = gig.description; info.append(p); }

  article.append(date, info);
  if (gig.link) {
    const action = document.createElement("a");
    action.className = "gig-action";
    action.href = gig.link;
    action.target = "_blank";
    action.rel = "noopener noreferrer";
    action.textContent = "Details ↗";
    article.append(action);
  }
  return article;
}
