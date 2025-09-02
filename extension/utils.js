// ID helpers
export const uid = (p) => `${p}-${Math.random().toString(36).slice(2,10)}`;

// Oppli dataset shape (companies, jobs, contacts, …)
export function emptyDataset(){
  return { companies: [], jobs: [], contacts: [], chats: [], actions: [] };
}

// Find or create a company by name (case-insensitive, trimmed)
export function ensureCompany(data, companyName, extra = {}){
  const name = (companyName || "").trim();
  if(!name) return null;
  const existing = data.companies.find(c => (c.name || "").toLowerCase() === name.toLowerCase());
  if(existing) return existing.id;
  const id = uid("company");
  data.companies.push({
    type: "Other",
    priority: "Medium",
    logoId: "",
    name,
    id,
    description: "",
    notes: "",
    ...extra
  });
  return id;
}
