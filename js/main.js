document.addEventListener("DOMContentLoaded", function () {
  const HUB_HASH = "f0d1f82a60d8332ecb4e3eaf7b779e94a251ddf2becbbddd240118d853895b35";

  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => nav.classList.remove("open"));
    });
  }

  const trigger = document.getElementById("shark-portal");
  const modal = document.getElementById("portal-modal");
  const closeBtn = document.getElementById("portal-close");
  const form = document.getElementById("portal-form");
  const errorEl = document.getElementById("portal-error");
  const input = document.getElementById("portal-code");

  function openModal() {
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    if (errorEl) errorEl.style.display = "none";
    if (input) {
      input.value = "";
      input.focus();
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    if (errorEl) errorEl.style.display = "none";
  }

  async function sha256(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function handlePortalSubmit(event) {
    event.preventDefault();
    const code = (input && input.value ? input.value : "").trim();
    const hash = await sha256(code);

    if (hash === HUB_HASH) {
      sessionStorage.setItem("jaw_auth", "ok");
      const dest = sessionStorage.getItem("jaw_return") || "dashboard.html";
      sessionStorage.removeItem("jaw_return");
      window.location.href = dest;
      return;
    }

    if (errorEl) {
      errorEl.textContent = "Incorrect code. Try again.";
      errorEl.style.display = "block";
    }
    if (input) {
      input.value = "";
      input.focus();
    }
  }

  if (trigger) trigger.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal && modal.classList.contains("open")) closeModal();
  });
  if (form) form.addEventListener("submit", handlePortalSubmit);

  /* Compliance Lock staged demo */
  const demoBtn = document.getElementById("demo-trigger");
  const complianceScreen = document.getElementById("compliance-screen");
  const warningLine = document.getElementById("warning-line");
  const unlockHint = document.getElementById("unlock-hint");
  let demoRunning = false;

  if (demoBtn && complianceScreen) {
    demoBtn.addEventListener("click", function () {
      if (demoRunning) return;
      demoRunning = true;
      demoBtn.disabled = true;
      demoBtn.textContent = "Running…";

      complianceScreen.classList.remove("locked", "unlocked");
      if (warningLine) warningLine.style.display = "none";
      if (unlockHint) unlockHint.style.display = "none";

      setTimeout(function () {
        if (warningLine) warningLine.style.display = "block";
      }, 500);

      setTimeout(function () {
        complianceScreen.classList.add("locked");
      }, 1400);

      setTimeout(function () {
        if (unlockHint) unlockHint.style.display = "block";
      }, 2800);

      setTimeout(function () {
        complianceScreen.classList.remove("locked");
        complianceScreen.classList.add("unlocked");
        if (warningLine) warningLine.style.display = "none";
        if (unlockHint) unlockHint.style.display = "none";
      }, 5200);

      setTimeout(function () {
        complianceScreen.classList.remove("unlocked");
        demoBtn.disabled = false;
        demoBtn.textContent = "▶ Run Compliance Demo";
        demoRunning = false;
      }, 7000);
    });
  }
});
