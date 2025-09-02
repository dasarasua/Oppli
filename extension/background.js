// background.js (MV3 module) — dynamic page key + offline queue (no dedupe)

const APP_URLS  = ["https://oppli.io/*", "https://www.oppli.io/*"];
const APP_HOST  = "oppli.io";
const QUEUE_KEY   = "oppliQueue";   // queued items when Oppli isn't open

// ---------------- helpers ----------------
async function findAppTabs() {
    try {
      const tabs = await chrome.tabs.query({ url: APP_URLS });
      return tabs || [];
    } catch (e) {
      console.error("[Background] findAppTabs error:", e);
      return [];
    }
  }
  

// Discover the LocalStorage key your app uses (attribute/global/scan/fallback)
async function detectAppKey(tabId){
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // 1) Preferred: explicit key via attribute or global
      const attrKey = document.documentElement?.getAttribute("data-rolemap-key");
      if (attrKey) return attrKey;
      if (window.ROLEMAP_DB_KEY) return window.ROLEMAP_DB_KEY;

      // 2) Scan LocalStorage for a RoleMap-like DB
      for (let i = 0; i < localStorage.length; i++){
        const k = localStorage.key(i);
        try {
          const v = JSON.parse(localStorage.getItem(k) || "null");
          if (v && typeof v === "object" &&
              Array.isArray(v.companies) &&
              Array.isArray(v.jobs) &&
              Array.isArray(v.contacts)) {
            return k;
          }
        } catch(e){}
      }
      // 3) Fallback default
      return "rolemap-db";
    }
  });
  return result || "rolemap-db";
}

function uid(prefix){ return `${prefix}-${Math.random().toString(36).slice(2,10)}`; }

async function getQueue(){
  const o = await chrome.storage.local.get(QUEUE_KEY);
  return Array.isArray(o[QUEUE_KEY]) ? o[QUEUE_KEY] : [];
}
async function setQueue(items){
  await chrome.storage.local.set({ [QUEUE_KEY]: items });
}
async function pushToQueue(item){
  const q = await getQueue();
  q.push(item);
  await setQueue(q);
}

// Apply one mutation (job/contact) inside an Opply tab
async function applyMutationInTab(tabId, appKey, item){
  try {
    console.log(`[Background] 🔧 Starting applyMutationInTab for ${item.type}:`, item.payload);
    console.log(`[Background] 🔧 Target tabId: ${tabId}, appKey: ${appKey}`);
    
    // Test tab access first
    try {
      const tab = await chrome.tabs.get(tabId);
      console.log(`[Background] 🔧 Tab access test successful:`, {
        tabId: tab.id,
        url: tab.url,
        status: tab.status
      });
    } catch (tabError) {
      console.error(`[Background] ❌ Tab access test failed:`, tabError);
      throw new Error(`Cannot access tab ${tabId}: ${tabError.message}`);
    }
    
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      args: [appKey, item],
      func: async (APP_KEY, it) => {
        console.log(`[Background] 🔧 SCRIPT EXECUTION STARTED for ${it.type}`);
        console.log(`[Background] 🔧 APP_KEY: ${APP_KEY}`);
        console.log(`[Background] 🔧 ITEM:`, it);
        console.log(`[Background] 🔧 SCRIPT IS RUNNING IN OPPLY TAB!`);
        
        try {
          console.log(`[Background] 🔧 Executing script for ${it.type}:`, it.payload);
          
          // Read current DB (or initialize)
          let db;
          try { db = JSON.parse(localStorage.getItem(APP_KEY) || "{}"); } catch { db = {}; }
          if (!db || typeof db !== "object") db = {};
          db.companies = Array.isArray(db.companies) ? db.companies : [];
          db.jobs      = Array.isArray(db.jobs)      ? db.jobs      : [];
          db.contacts  = Array.isArray(db.contacts)  ? db.contacts  : [];
          db.chats     = Array.isArray(db.chats)     ? db.chats     : [];
          db.actions   = Array.isArray(db.actions)   ? db.actions   : [];
          db.ideas     = Array.isArray(db.ideas)     ? db.ideas     : [];
          db.links     = Array.isArray(db.links)     ? db.links     : [];
          if (typeof db.version !== "number") db.version = 1;

          console.log(`[Background] 🔧 DB initialized, companies: ${db.companies.length}`);

          // IndexedDB functions for logo storage
          const IMAGES_DB_NAME = 'rolemap-images';
          const IMAGES_DB_VERSION = 1;
          let _imagesDbPromise = null;

          function openImagesDB(){
            if (_imagesDbPromise) return _imagesDbPromise;
            _imagesDbPromise = new Promise((resolve, reject)=>{
              const req = indexedDB.open(IMAGES_DB_NAME, IMAGES_DB_VERSION);
              req.onupgradeneeded = ()=>{
                const dbi = req.result;
                if (!dbi.objectStoreNames.contains('logos')) {
                  dbi.createObjectStore('logos', { keyPath: 'id' });
                }
              };
              req.onsuccess = ()=> resolve(req.result);
              req.onerror = ()=> reject(req.error);
            });
            return _imagesDbPromise;
          }

          async function logosPut(id, blob, type){
            const dbi = await openImagesDB();
            return new Promise((resolve,reject)=>{
              const tx = dbi.transaction('logos','readwrite');
              tx.objectStore('logos').put({id, blob, type});
              tx.oncomplete = ()=> resolve();
              tx.onerror = ()=> reject(tx.error);
            });
          }

          function dataUrlToBlob(dataUrl){
            return fetch(dataUrl).then(r=>r.blob());
          }

          // Ensure company by name; handle logo storage properly with IndexedDB
          async function ensureCompanyByName(name, logoDataUrl, logoType){
            console.log(`[Background] 🔧 ensureCompanyByName called for: ${name}`);
            console.log(`[Background] 🔧 Input parameters:`, { name, logoDataUrlLength: logoDataUrl?.length, logoType });
            
            // Save debug log to localStorage
            const debugLog = `[${new Date().toISOString()}] ensureCompanyByName called for: ${name}, logoDataUrlLength: ${logoDataUrl?.length}, logoType: ${logoType}`;
            const existingLogs = JSON.parse(localStorage.getItem('oppli-debug-logs') || '[]');
            existingLogs.push(debugLog);
            localStorage.setItem('oppli-debug-logs', JSON.stringify(existingLogs.slice(-10))); // Keep last 10 logs
            
            const key = (name || "").trim().toLowerCase();
            if (!key) {
              console.log(`[Background] ❌ No company name provided`);
              return null;
            }
            
            let c = db.companies.find(x => (x.name||"").trim().toLowerCase() === key);
            if (!c){
              c = {
                id: `company-${Math.random().toString(36).slice(2,10)}`,
                name,
                type: "Other",
                priority: "Medium",
                website: "",
                location: "",
                sector: "",
                description: "",
                notes: "",
                logoId: ""
              };
              db.companies.push(c);
              console.log(`[Background] 🔧 Created new company: ${c.id}`);
            } else {
              console.log(`[Background] 🔧 Found existing company: ${c.id}`);
            }
            
            // Handle logo storage if provided - now using IndexedDB
            console.log(`[Background] 🔍 Logo processing for company ${name}:`, {
              logoDataUrlPresent: !!logoDataUrl,
              logoDataUrlLength: logoDataUrl?.length || 0,
              logoType: logoType,
              existingLogoId: c.logoId,
              logoDataUrlStartsWith: logoDataUrl ? logoDataUrl.substring(0, 30) : 'None',
              logoDataUrlValid: logoDataUrl && logoDataUrl.length > 0
            });
            
            if (logoDataUrl && logoDataUrl.length > 0) {
              console.log(`[Background] ✅ Logo data is valid, processing...`);
              
              // Fix logo type mismatch - detect actual format from data URL
              let actualLogoType = logoType;
              if (logoDataUrl.startsWith('data:image/jpeg')) {
                actualLogoType = 'image/jpeg';
              } else if (logoDataUrl.startsWith('data:image/png')) {
                actualLogoType = 'image/png';
              } else if (logoDataUrl.startsWith('data:image/webp')) {
                actualLogoType = 'image/webp';
              }
              
              const logoId = `logo-${c.id}`;
              c.logoId = logoId;
              
              console.log(`[Background] 🔧 Logo ID generated: ${logoId}`);
              console.log(`[Background] 🔧 Actual logo type: ${actualLogoType}`);
              
              try {
                // Convert data URL to blob and store in IndexedDB
                const blob = await dataUrlToBlob(logoDataUrl);
                await logosPut(logoId, blob, actualLogoType);
                
                console.log(`[Background] ✅ Stored logo in IndexedDB for company ${name}:`, {
                  logoId: logoId,
                  originalLogoType: logoType,
                  actualLogoType: actualLogoType,
                  blobSize: blob.size,
                  blobType: blob.type
                });
                
                // Save success log to localStorage
                const successLog = `[${new Date().toISOString()}] ✅ Logo saved to IndexedDB: ${logoId}, type: ${actualLogoType}, blobSize: ${blob.size}`;
                const successLogs = JSON.parse(localStorage.getItem('oppli-success-logs') || '[]');
                successLogs.push(successLog);
                localStorage.setItem('oppli-success-logs', JSON.stringify(successLogs.slice(-5))); // Keep last 5 logs
                
              } catch (error) {
                console.error(`[Background] ❌ Error storing logo in IndexedDB:`, error);
                
                // Save error log to localStorage
                const errorLog = `[${new Date().toISOString()}] ❌ IndexedDB error: ${error.message}`;
                const errorLogs = JSON.parse(localStorage.getItem('oppli-error-logs') || '[]');
                errorLogs.push(errorLog);
                localStorage.setItem('oppli-error-logs', JSON.stringify(errorLogs.slice(-5))); // Keep last 5 logs
              }
            } else {
              console.log(`[Background] ⚠️ No logo data provided for company ${name}:`, {
                logoDataUrlPresent: !!logoDataUrl,
                logoDataUrlLength: logoDataUrl?.length || 0,
                logoType: logoType,
                logoDataUrlValid: logoDataUrl && logoDataUrl.length > 0
              });
              
              // Save failure log to localStorage
              const failureLog = `[${new Date().toISOString()}] ⚠️ No logo data: logoDataUrlPresent: ${!!logoDataUrl}, logoDataUrlLength: ${logoDataUrl?.length || 0}`;
              const failureLogs = JSON.parse(localStorage.getItem('oppli-failure-logs') || '[]');
              failureLogs.push(failureLog);
              localStorage.setItem('oppli-failure-logs', JSON.stringify(failureLogs.slice(-5))); // Keep last 5 logs
            }
            
            return c.id;
          }

          // Apply mutation
          if (it.type === "job"){
            const { companyName, logoDataUrl, logoType, title, location, sourceUrl, notes } = it.payload || {};
            console.log(`[Background] 📋 Processing job: ${title} at ${companyName}`);
            console.log(`[Background] 🖼️ Logo data received:`, {
              logoDataUrlPresent: !!logoDataUrl,
              logoDataUrlLength: logoDataUrl?.length || 0,
              logoType: logoType,
              logoDataUrlPreview: logoDataUrl ? logoDataUrl.substring(0, 50) + '...' : 'None'
            });
            
            const companyId = await ensureCompanyByName(companyName || "", logoDataUrl || "", logoType || "");
            
            db.jobs.push({
              id: `job-${Math.random().toString(36).slice(2,10)}`,
              title: title || "",
              status: "To apply",
              companyId: companyId || null,
              sourceLink: sourceUrl || "",
              location: location || "",
              notes: notes || ""
            });
            console.log(`[Background] ✅ Job saved successfully`);
            
            // Debug: Check final state
            console.log(`[Background] 🔍 Final DB state:`, {
              totalCompanies: db.companies.length,
              companyWithLogo: db.companies.find(c => c.id === companyId)?.logoId || 'None'
            });
          }

          if (it.type === "contact"){
            const { companyName, logoDataUrl, logoType, name, role, linkedInUrl } = it.payload || {};
            console.log(`[Background] 📋 Processing contact: ${name} at ${companyName}`);
            console.log(`[Background] 🖼️ Logo data received:`, {
              logoDataUrlPresent: !!logoDataUrl,
              logoDataUrlLength: logoDataUrl?.length || 0,
              logoType: logoType,
              logoDataUrlPreview: logoDataUrl ? logoDataUrl.substring(0, 50) + '...' : 'None'
            });
            
            const companyId = await ensureCompanyByName(companyName || "", logoDataUrl || "", logoType || "");
            
            db.contacts.push({
              id: `ctc-${Math.random().toString(36).slice(2,10)}`,
              name: name || "",
              role: role || "",
              department: "",
              email: "",
              linkedIn: linkedInUrl || "",
              companyId: companyId || null,
              relStrength: "Cold",
              howWeMet: "",
              notes: ""
            });
            console.log(`[Background] ✅ Contact saved successfully`);
            
            // Debug: Check final state
            console.log(`[Background] 🔍 Final DB state:`, {
              totalCompanies: db.companies.length,
              companyWithLogo: db.companies.find(c => c.id === companyId)?.logoId || 'None'
            });
          }

          // Save
          try { 
            localStorage.setItem(APP_KEY, JSON.stringify(db)); 
            console.log(`[Background] ✅ Database saved successfully`);
            
            // Trigger refresh in Opply tab
            try {
              // Send a custom event to trigger refresh
              window.dispatchEvent(new CustomEvent('oppli-data-updated', { 
                detail: { type: it.type, timestamp: Date.now() }
              }));
              console.log(`[Background] ✅ Refresh event dispatched`);
            } catch (refreshError) {
              console.log(`[Background] ⚠️ Could not dispatch refresh event:`, refreshError);
            }
            
            return { success: true, message: "Data saved successfully" };
          } catch(e){
            console.error(`[Background] ❌ Error saving database:`, e);
            return { success: false, error: e.message };
          }
        } catch (error) {
          console.error(`[Background] ❌ Error in script execution:`, error);
          return { success: false, error: error.message };
        }
      }
    });
    
    console.log(`[Background] 🔧 Script execution result:`, result);
    
    if (result && result[0] && result[0].result) {
      console.log(`[Background] ✅ Script execution returned:`, result[0].result);
    } else {
      console.error(`[Background] ❌ Script execution failed or returned no result`);
    }
    
    console.log(`[Background] ✅ applyMutationInTab completed successfully`);
  } catch (error) {
    console.error(`[Background] ❌ Error in applyMutationInTab:`, error);
    throw error;
  }
}

// Try to write immediately; if no Opply tab open, queue it.
async function saveOrQueue(item){
  try {
    console.log(`[Background] 🔧 saveOrQueue called for ${item.type}:`, item.payload);
    
    const tabs = await findAppTabs();
    console.log(`[Background] 🔧 Found ${tabs.length} Oppli tabs:`, tabs.map(t => t.url));
    
    if (tabs.length){
      console.log(`[Background] 🔧 Using tab:`, tabs[0].id, tabs[0].url);
      const appKey = await detectAppKey(tabs[0].id);
      console.log(`[Background] 🔧 Detected app key:`, appKey);
      
      await applyMutationInTab(tabs[0].id, appKey, item);
      console.log(`[Background] 🔧 applyMutationInTab completed`);
      
      return { ok:true, mode:"immediate" };
    } else {
      console.log(`[Background] 🔧 No Oppli tabs found, queuing item`);
      await pushToQueue(item);
      return { ok:true, mode:"queued" };
    }
  } catch (error) {
    console.error(`[Background] ❌ Error in saveOrQueue:`, error);
    return { ok:false, error: error.message };
  }
}

// When an Opply tab is available, flush the queue into it and then reload once
async function flushQueueInto(tabId){
  const q = await getQueue();
  if (!q.length) return;
  const appKey = await detectAppKey(tabId);
  for (const it of q){
    await applyMutationInTab(tabId, appKey, it);
  }
  await setQueue([]); // clear queue
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => { try { location.reload(); } catch(e){} }
  });
}

// ---------------- events ----------------

// Saves from content.js
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === "saveJob" || msg?.type === "saveContact"){
      const item = { type: msg.type === "saveJob" ? "job" : "contact", payload: msg.payload || {} };
      console.log(`[Background] 📨 Received ${msg.type} message:`, item.payload);
      const res  = await saveOrQueue(item);
      sendResponse(res);
      return;
    }
    sendResponse({ ok:false, error:"Unknown message type" });
  })();
  return true; // keep channel open for async
});

// When Oppli loads, flush any queued items
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") return;
    const url = (tab.url || "").toLowerCase();
    if (url.includes(APP_HOST)) {
      await flushQueueInto(tabId);
    }
  });
  

// Also try flushing on browser startup or extension install
chrome.runtime.onStartup?.addListener(async () => {
  const tabs = await findAppTabs();
  if (tabs.length) await flushQueueInto(tabs[0].id);
});
chrome.runtime.onInstalled?.addListener(async () => {
  const tabs = await findAppTabs();
  if (tabs.length) await flushQueueInto(tabs[0].id);
});