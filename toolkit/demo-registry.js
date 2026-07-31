window.JAWS_DEMO_REGISTRY = (function () {
  const REGISTRY = {
    salon: {
      barber: {
        label: "Rivet Fade Co. Demo",
        demo_type: "Rivet",
        public_url: "https://jawsai911.com/demos/apex-cuts/index.html",
        command_url: "https://jawsai911.com/demos/apex-cuts/command.html",
        proposal_template_key: "barber-growth-proposal",
        proposal_template_url: "category-templates/barber-growth-proposal.html",
        secondary_proposal_template_key: "shark-growth-proposal-2",
        secondary_proposal_template_url: "category-templates/shark-growth-proposal-2.html",
        outreach_template_key: "barber-receipt",
        outreach_template_url: "category-templates/barber-receipt.html",
        niche: "salon",
        category: "barber"
      },
      nail: {
        label: "Softline Studio Demo",
        demo_type: "Softline",
        public_url: "https://jawsai911.com/demos/luxe-nails/index.html",
        command_url: "https://jawsai911.com/demos/luxe-nails/command.html",
        proposal_template_key: "shark-growth-proposal",
        proposal_template_url: "category-templates/shark-growth-proposal.html",
        secondary_proposal_template_key: "shark-growth-proposal-2",
        secondary_proposal_template_url: "category-templates/shark-growth-proposal-2.html",
        outreach_template_key: "nail-receipt",
        outreach_template_url: "category-templates/nail-receipt.html",
        niche: "salon",
        category: "nail"
      },
      hair: {
        label: "Lumina Desk Demo",
        demo_type: "Lumina",
        public_url: "https://jawsai911.com/demos/hair-studio/index.html",
        command_url: "https://jawsai911.com/demos/hair-studio/command.html",
        proposal_template_key: "shark-growth-proposal",
        proposal_template_url: "category-templates/shark-growth-proposal.html",
        secondary_proposal_template_key: "shark-growth-proposal-2",
        secondary_proposal_template_url: "category-templates/shark-growth-proposal-2.html",
        outreach_template_key: "hair-receipt",
        outreach_template_url: "category-templates/hair-receipt.html",
        niche: "salon",
        category: "hair"
      }
    },
    pool: {
      flagship: {
        label: "Pool Flagship Demo Library",
        demo_type: "Pool Flagship",
        public_url: "site-demos/index.html",
        command_url: "",
        niche: "pool",
        category: "pool"
      }
    }
  };

  function normalize(value) {
    return String(value || "").toLowerCase().trim();
  }

  function categoryKey(value) {
    const raw = normalize(value);
    if (raw.includes("barber")) return "barber";
    if (raw.includes("nail")) return "nail";
    if (raw.includes("hair")) return "hair";
    if (raw.includes("pool")) return "pool";
    return raw;
  }

  function resolveByCategory(category) {
    const key = categoryKey(category);
    return REGISTRY.salon[key] || REGISTRY.pool[key] || null;
  }

  return {
    registry: REGISTRY,
    categoryKey,
    resolveByCategory
  };
})();
