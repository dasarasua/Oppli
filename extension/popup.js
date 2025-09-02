function $(id){ return document.getElementById(id); }
function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function companyNameById(data, id){
  const c = data.companies.find(c => c.id === id);
  return c ? c.name : "";
}

document.addEventListener('DOMContentLoaded', async () => {
  const { oppliData } = await chrome.storage.local.get('oppliData');
  const data = oppliData || { companies: [], jobs: [], contacts: [], chats: [], actions: [] };

  $('stats').innerHTML =
    `<div><span class="count">${data.companies.length}</span> companies • ` +
    `<span class="count">${data.jobs.length}</span> jobs • ` +
    `<span class="count">${data.contacts.length}</span> contacts</div>`;

  const jobsTbody = $('jobs').querySelector('tbody');
  data.jobs.slice(-10).reverse().forEach(j => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${escapeHtml(j.title)}</td>` +
      `<td>${escapeHtml(companyNameById(data, j.companyId))}</td>` +
      `<td><a href="${j.sourceLink}" target="_blank">open</a></td>`;
    jobsTbody.appendChild(tr);
  });

  const contactsTbody = $('contacts').querySelector('tbody');
  data.contacts.slice(-10).reverse().forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${escapeHtml(c.name)}</td>` +
      `<td>${escapeHtml(c.role)}</td>` +
      `<td>${escapeHtml(companyNameById(data, c.companyId))}</td>`;
    contactsTbody.appendChild(tr);
  });

  $('export').addEventListener('click', async () => {
    const { oppliData } = await chrome.storage.local.get('oppliData');
    const blob = new Blob([JSON.stringify(oppliData || {}, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'oppliData.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $('clear').addEventListener('click', async () => {
    await chrome.storage.local.remove('oppliData');
    location.reload();
  });
});
