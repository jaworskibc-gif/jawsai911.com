(function () {
  function textParam(params, key) {
    return String(params.get(key) || "").trim();
  }

  function setText(selector, value) {
    if (!value) return;
    var node = document.querySelector(selector);
    if (node) node.textContent = value;
  }

  function setHtml(selector, value) {
    if (!value) return;
    var node = document.querySelector(selector);
    if (node) node.innerHTML = value;
  }

  function setManyText(selectors, value) {
    if (!value) return;
    selectors.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (node) {
        node.textContent = value;
      });
    });
  }

  function setImage(selector, url, alt) {
    if (!url) return;
    var node = document.querySelector(selector);
    if (!node) return;
    node.src = url;
    if (alt) node.alt = alt;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function applyPhotos(name, photos) {
    if (!photos.length) return;
    var targets = [
      ".hero .hero-img img",
      ".hero .hero-side figure:nth-child(1) img",
      ".hero .hero-side figure:nth-child(2) img",
      ".lookbook-strip .look-card:nth-child(1) img",
      ".lookbook-strip .look-card:nth-child(2) img",
      ".lookbook-strip .look-card:nth-child(3) img",
      ".bento figure:nth-child(1) img",
      ".bento figure:nth-child(2) img",
      ".bento figure:nth-child(3) img"
    ];
    targets.forEach(function (selector, index) {
      var photo = photos[index % photos.length];
      setImage(selector, photo, name ? name + " work photo" : "Business work photo");
    });
  }

  function replaceBrandText(name) {
    if (!name) return;
    var patterns = [
      /Rivet Fade Co\. Barbershop/g,
      /Rivet Fade Co\./g,
      /Rivet Fade Co/g,
      /Rivet Fade/g,
      /Softline Studio/g,
      /Softline/g,
      /LuminaDesk/g,
      /Hair SuperSite/g
    ];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) {
      var node = walker.currentNode;
      if (!node || !node.nodeValue) continue;
      if (node.parentNode && /SCRIPT|STYLE|NOSCRIPT/.test(node.parentNode.nodeName)) continue;
      nodes.push(node);
    }
    nodes.forEach(function (node) {
      var nextValue = node.nodeValue;
      patterns.forEach(function (pattern) {
        nextValue = nextValue.replace(pattern, name);
      });
      if (nextValue !== node.nodeValue) node.nodeValue = nextValue;
    });
  }

  function insertReviews(name, reviewUrl, reviews) {
    if (!reviews.length) return;
    var hero = document.querySelector(".hero");
    if (!hero || document.querySelector(".crm-proof-band")) return;
    var style = document.createElement("style");
    style.textContent =
      ".crm-proof-band{padding:18px 0 8px;border-bottom:1px solid var(--line)}" +
      ".crm-proof-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}" +
      ".crm-proof-card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px;box-shadow:0 12px 30px rgba(6,16,28,.06)}" +
      ".crm-proof-card p{margin:0 0 8px;line-height:1.65}" +
      ".crm-proof-card small{color:var(--muted)}" +
      ".crm-proof-head{display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:16px}" +
      ".crm-proof-head h3{margin:0;font-size:clamp(22px,2vw,30px)}" +
      ".crm-proof-head a{color:inherit;text-decoration:none;font-weight:700}" +
      "@media (max-width:800px){.crm-proof-grid{grid-template-columns:1fr}}";
    document.head.appendChild(style);

    var section = document.createElement("section");
    section.className = "crm-proof-band";
    var cards = reviews.map(function (review) {
      return '<article class="crm-proof-card"><p>"' + escapeHtml(review) + '"</p><small>Google review' + (name ? " · " + escapeHtml(name) : "") + "</small></article>";
    }).join("");
    var cta = reviewUrl ? '<a href="' + escapeHtml(reviewUrl) + '" target="_blank" rel="noopener">Open Google reviews</a>' : "";
    section.innerHTML =
      '<div class="wrap"><div class="crm-proof-head"><div><div class="label">Google proof · live client copy</div><h3>Real reviews on the page.</h3></div>' +
      cta +
      '</div><div class="crm-proof-grid">' + cards + "</div></div>";
    hero.insertAdjacentElement("afterend", section);
  }

  function run() {
    var params = new URLSearchParams(window.location.search);
    var name = textParam(params, "name");
    var owner = textParam(params, "owner");
    var rating = textParam(params, "rating");
    var reviewCount = textParam(params, "review_count");
    var reviewUrl = textParam(params, "review_url");
    var reviews = ["review_1", "review_2", "review_3"].map(function (key) {
      return textParam(params, key);
    }).filter(Boolean);
    var photos = ["photo_1", "photo_2", "photo_3"].map(function (key) {
      return textParam(params, key);
    }).filter(Boolean);
    if (!name && !reviews.length && !photos.length && !rating && !reviewCount) return;

    if (name) {
      document.title = name + " | Demo";
      var metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) metaDescription.setAttribute("content", name + " demo site with live reviews, client photos, and after-hours lead capture.");
      var ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute("content", name + " | Demo");
      replaceBrandText(name);
      setManyText([
        ".demo-bar strong",
        ".logo",
        ".hero .float small",
        "#faq + * strong",
        ".chat-head strong"
      ], name);
      setText(".hero h1", name);
      setHtml(".hero .hero-sub", escapeHtml(name) + " now has a live demo showing after-hours lead capture, review follow-up, and fresh service content that turns visits into new bookings.");
    }
    if (rating || reviewCount) {
      var chipParts = [];
      if (rating) chipParts.push("<b>★ " + rating + "</b>");
      if (reviewCount) chipParts.push(reviewCount + " Google reviews");
      setHtml(".hero .trust-row .chip:first-child", chipParts.join(" "));
    }
    if (reviews[0]) {
      setText(".hero .float p", '"' + reviews[0] + '"');
      setText(".hero .float small", "Google review" + (name ? " · " + name : ""));
    }
    if (owner) {
      var secondCard = document.querySelector(".lookbook-strip .look-card:nth-child(2) .meta strong");
      if (secondCard) secondCard.textContent = owner;
    }

    applyPhotos(name, photos);
    insertReviews(name, reviewUrl, reviews);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
