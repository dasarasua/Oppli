// content.js — robust + mutation-watching injector for LinkedIn jobs & profiles
(() => {
  // ---- tiny data utils (no background) ----
  const uid = (p) => `${p}-${Math.random().toString(36).slice(2,10)}`;
  const emptyData = () => ({ companies: [], jobs: [], contacts: [], chats: [], actions: [] });
  
  // ---- page helpers ----
  const isJob = () => {
      const isJobPage = /linkedin\.com\/jobs\/(view|search|search-results|collections)/.test(location.href);
      console.log('[Oppli] isJob() check:', location.href, 'Result:', isJobPage);
      return isJobPage;
  };
  const isProfile = () => /linkedin\.com\/in\//.test(location.href);

  // inline CSS (avoid chrome-extension:// loads)
  (function addStyle(){
      if (document.getElementById("oppli-style")) return;
      const s = document.createElement("style");
      s.id = "oppli-style";
      s.textContent = `
  /* --- Oppli CTA (profile + jobs) --- */
.oppli-cta{
--navy:#002B5B; --teal:#007F7F; --sky:#00B4D8; --graphite:#3A3A3A;
display:inline-flex; align-items:center; gap:10px;
padding:10px 16px; border-radius:9999px;
background:linear-gradient(90deg, var(--navy) 0%, var(--teal) 100%);
color:#fff; font-weight:800; font-size:15px; line-height:1;
border:1px solid rgba(255,255,255,.14);
box-shadow:0 6px 14px rgba(0,0,0,.12);
cursor:pointer; white-space:nowrap; user-select:none;
transition:transform .06s ease, box-shadow .2s ease, background .2s ease, opacity .2s ease;
}
.oppli-cta:hover{ transform:translateY(-1px); box-shadow:0 10px 22px rgba(0,0,0,.18); }
.oppli-cta:active{ transform:translateY(0); box-shadow:0 6px 14px rgba(0,0,0,.12);}
.oppli-cta:focus-visible{ outline:3px solid #00B4D8; outline-offset:2px; }

/* Compact variant if LinkedIn squeezes the bar */
@media (max-width: 1020px){
.oppli-cta{ padding:9px 14px; font-size:14px; }
}

/* tiny inline Oppli logo in the button */
.oppli-cta .oppli-logo{ width:18px; height:18px; border-radius:4px; flex:0 0 auto; }

        .oppli-float{position:fixed;bottom:20px;right:20px;z-index:2147483647;}
    
        /* contact picker */
        .oppli-sheet{position:fixed;top:12px;right:12px;width:420px;max-width:90vw;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);z-index:2147483647;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}
        .oppli-sheet header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #eee}
        .oppli-sheet h1{margin:0;font-size:14px;font-weight:700}
        .oppli-sheet main{padding:12px}
        .oppli-row{display:flex;align-items:center;gap:8px}
        .oppli-actions{display:flex;justify-content:flex-end;gap:8px;padding:10px 12px;border-top:1px solid #eee}
        .oppli-btn{border:1px solid #e5e7eb;background:#f8fafc;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer}
        .oppli-btn.primary{background:#0ea5e9;border-color:#0ea5e9;color:#fff}
        .oppli-select,.oppli-input{width:100%;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;font-size:14px;background:#fff}
        .oppli-muted{color:#64748b;font-size:12px}
        .oppli-sp{height:8px}
      `;
      if (document.head) {
        document.head.appendChild(s);
      } else {
        // Fallback: wait for head to be available
        const waitForHead = () => {
          if (document.head) {
            document.head.appendChild(s);
          } else {
            setTimeout(waitForHead, 10);
          }
        };
        waitForHead();
      }
    })();
    

  const throttle = (fn, wait=400) => {
    let last = 0; return (...a) => { const now = Date.now(); if (now - last > wait) { last = now; fn(...a); } };
  };

  // Enhanced debug function to understand LinkedIn's button structure
  function debugButtonStructure() {
    if (!/linkedin\.com\/in\//.test(location.href)) return;
    
    console.log('[Oppli] === ENHANCED BUTTON STRUCTURE DEBUG ===');
    
    // Find all buttons on the page
    const allButtons = Array.from(document.querySelectorAll('button, a[role="button"]'));
    console.log('[Oppli] Total buttons found:', allButtons.length);
    
    // Group buttons by their containers
    const buttonContainers = new Map();
    
    allButtons.forEach((btn, i) => {
      const container = btn.closest('div');
      const containerKey = container ? container.className || container.tagName : 'no-container';
      
      if (!buttonContainers.has(containerKey)) {
        buttonContainers.set(containerKey, []);
      }
      buttonContainers.get(containerKey).push({
        index: i,
        text: (btn.innerText || btn.textContent || '').trim(),
        aria: btn.getAttribute('aria-label') || '',
        classes: btn.className,
        container: container
      });
    });
    
    // TEMPORARY DEBUG: Show ALL containers, not just those with 2+ buttons
    console.log('[Oppli] 🔍 ALL Button containers (including single buttons):');
    for (const [containerKey, buttons] of buttonContainers) {
      console.log(`[Oppli] 🔍 Container "${containerKey}" has ${buttons.length} buttons:`);
      buttons.forEach(btn => {
        console.log(`  - "${btn.text}" (aria: "${btn.aria}") classes: "${btn.classes}"`);
      });
      
      // Check if this is the container we're looking for
      if (containerKey.includes('xAPeOvyAqXCtbBrNUbVaYWpYdgeGTDGgsI')) {
        console.log(`[Oppli] 🎯 FOUND TARGET CONTAINER: "${containerKey}"`);
      }
    }
    
    // Log containers with multiple buttons (original logic)
    console.log('[Oppli] Button containers (2+ buttons only):');
    for (const [containerKey, buttons] of buttonContainers) {
      if (buttons.length >= 2) {
        console.log(`[Oppli] Container "${containerKey}" has ${buttons.length} buttons:`);
        buttons.forEach(btn => {
          console.log(`  - "${btn.text}" (aria: "${btn.aria}") classes: "${btn.classes}"`);
        });
        
        // Log the container's full structure
        if (buttons[0].container) {
          console.log(`[Oppli] Container HTML structure:`, buttons[0].container.outerHTML.substring(0, 500) + '...');
        }
      }
    }
    
    // Look specifically for containers with "Save", "Message", or "More" buttons
    const targetContainers = [];
    for (const [containerKey, buttons] of buttonContainers) {
      const buttonTexts = buttons.map(btn => btn.text.toLowerCase());
      if (buttonTexts.some(text => /save|message|more|careeros/i.test(text))) {
        targetContainers.push({
          containerKey,
          buttons,
          container: buttons[0].container
        });
      }
    }
    
    console.log('[Oppli] Target containers (with Save/Message/More):', targetContainers.length);
    targetContainers.forEach((target, i) => {
      console.log(`[Oppli] Target ${i + 1}: "${target.containerKey}"`);
      target.buttons.forEach(btn => {
        console.log(`  - "${btn.text}" (aria: "${btn.aria}")`);
      });
    });
    
    console.log('[Oppli] === END ENHANCED DEBUG ===');
    
    return targetContainers;
  }

  // Debug function to help understand LinkedIn's DOM structure
  function debugProfileStructure() {
    if (!/linkedin\.com\/in\//.test(location.href)) return;
    
    console.log('[Oppli] === DEBUG: LinkedIn Profile Structure ===');
    
    const topScope =
      document.querySelector('section.pv-top-card') ||
      document.querySelector('[data-view-name="profile-header"]') ||
      document.querySelector('#profile-content') ||
      document.querySelector('main') ||
      document.body;
    
    console.log('[Oppli] Top scope found:', !!topScope);
    
    // Find all buttons in the top area
    const allButtons = topScope.querySelectorAll('button, a[role="button"]');
    console.log('[Oppli] Total buttons found:', allButtons.length);
    
    allButtons.forEach((btn, i) => {
      const text = (btn.innerText || btn.textContent || '').trim();
      const aria = btn.getAttribute('aria-label') || '';
      const classes = btn.className;
      console.log(`[Oppli] Button ${i}: "${text}" (aria: "${aria}") classes: "${classes}"`);
    });
    
    // Look for action containers
    const containers = topScope.querySelectorAll('div');
    const actionContainers = Array.from(containers).filter(el => {
      const buttons = el.querySelectorAll('button, a[role="button"]');
      return buttons.length >= 2;
    });
    
    console.log('[Oppli] Potential action containers found:', actionContainers.length);
    actionContainers.forEach((container, i) => {
      const buttons = container.querySelectorAll('button, a[role="button"]');
      const buttonTexts = Array.from(buttons).map(btn => 
        (btn.innerText || btn.textContent || '').trim()
      );
      console.log(`[Oppli] Container ${i}:`, buttonTexts, 'classes:', container.className);
    });
    
    console.log('[Oppli] === END DEBUG ===');
  }

  // Robust button injection using mutation observers
  function createRobustButtonInjector(onClick) {
    let injected = false;
    let observer = null;
  let injectionSuccessful = false; // Global flag to prevent multiple systems from interfering
    
    function injectButton() {
    if (injected) return Promise.resolve(false);
    
    console.log('[Oppli] 🎯 Attempting smart button injection...');
    
    // CONSERVATIVE CHECK: Only inject if we have clear LinkedIn profile indicators
    const hasLinkedInProfileStructure = document.querySelector('button[aria-label*="Message"]') || 
                                       document.querySelector('button[aria-label*="Connect"]') ||
                                       document.querySelector('.pv-top-card__actions-container') ||
                                       document.querySelector('[data-section="profileTopCard"]');
    
    if (!hasLinkedInProfileStructure) {
      console.log('[Oppli] ❌ No LinkedIn profile structure detected, refusing to inject randomly');
      return Promise.resolve(false);
    }
      
      // Remove any existing Oppli buttons first to prevent duplicates
      const existingButtons = document.querySelectorAll('.oppli-cta[data-scope="profile"]');
      existingButtons.forEach(btn => {
        console.log('[Oppli] 🧹 Removing existing button to prevent duplicates');
        btn.remove();
      });
      
    // Try to find container immediately
    let targetContainer = findTargetContainer();
    
    // If not found immediately, wait a bit and try again (DOM timing issue)
    if (!targetContainer) {
      console.log('[Oppli] ⏳ Container not found immediately, waiting 100ms for DOM...');
      return new Promise((resolve) => {
        setTimeout(() => {
          targetContainer = findTargetContainer();
      if (targetContainer) {
            console.log('[Oppli] 🎯 Container found after delay, injecting...');
            const success = injectButtonToContainer(targetContainer);
            resolve(success);
          } else {
            console.log('[Oppli] ❌ Container still not found after delay');
            resolve(false);
          }
        }, 100);
      });
    }
    
    // If found immediately, inject and return Promise
    if (targetContainer) {
      const success = injectButtonToContainer(targetContainer);
      return Promise.resolve(success);
    }
    
    return Promise.resolve(false);
  }
  
  // Helper function to find the target container
  function findTargetContainer() {
    // AGGRESSIVE CONTAINER DETECTION: Look for ANY LinkedIn profile structure
    let targetContainer = null;
    
    console.log('[Oppli] 🔍 Searching for LinkedIn profile structure...');
    
    // STRATEGY 1: Look for Message/Connect buttons (most reliable)
    const messageButtons = document.querySelectorAll('button[aria-label*="Message"]');
    const connectButtons = document.querySelectorAll('button[aria-label*="Connect"]');
    
    console.log('[Oppli] 🔍 Message buttons found:', messageButtons.length);
    console.log('[Oppli] 🔍 Connect buttons found:', connectButtons.length);
    
    // Try Message buttons first
    for (const btn of messageButtons) {
      const isInStickyHeader = btn.closest('.pvs-sticky-header-profile-actions') || 
                              btn.closest('.pv-profile-sticky-header-v2__actions-container');
      
      if (!isInStickyHeader) {
        targetContainer = btn.parentElement;
        console.log('[Oppli] 🎯 Found main profile Message button container');
        break;
      }
    }
    
    // If no Message button found, try Connect buttons
    if (!targetContainer) {
      for (const btn of connectButtons) {
        const isInStickyHeader = btn.closest('.pvs-sticky-header-profile-actions') || 
                                btn.closest('.pv-profile-sticky-header-v2__actions-container');
        const isInSidebar = btn.closest('.scaffold-layout__aside') || 
                           btn.closest('[class*="sidebar"]') ||
                           btn.closest('[class*="aside"]');
        
        if (!isInStickyHeader && !isInSidebar) {
          targetContainer = btn.parentElement;
          console.log('[Oppli] 🎯 Found main profile Connect button container');
          break;
        }
      }
    }
    
    // STRATEGY 2: Look for profile action containers
    if (!targetContainer) {
      const actionsContainer = document.querySelector('.pv-top-card__actions-container') || 
                              document.querySelector('[data-test-id="pv-top-card__actions"]') ||
                              document.querySelector('.pv-top-card__actions') ||
                              document.querySelector('.pv-top-card__actions--layout-top');
      
      if (actionsContainer) {
        const isInStickyHeader = actionsContainer.closest('.pvs-sticky-header-profile-actions') || 
                                actionsContainer.closest('.pv-profile-sticky-header-v2__actions-container');
        
        if (!isInStickyHeader) {
          targetContainer = actionsContainer;
          console.log('[Oppli] 🎯 Found main profile actions container');
        }
      }
    }
    
    // STRATEGY 3: Look for ANY LinkedIn profile structure (even loading)
    if (!targetContainer) {
      // Look for ANY LinkedIn profile elements
      const linkedinElements = document.querySelectorAll('[class*="pv-"], [class*="pvs-"], [class*="scaffold-"], [class*="profile-"]');
      console.log('[Oppli] 🔍 LinkedIn elements found:', linkedinElements.length);
      
      for (const element of linkedinElements) {
        // Check if this looks like a profile header or actions area
        const className = element.className || '';
        const isProfileHeader = className.includes('top-card') || 
                               className.includes('profile-actions') || 
                               className.includes('pv-top-card') ||
                               className.includes('pvs-profile');
        
        if (isProfileHeader) {
          // Check if it's in the main area (not sidebar/sticky)
          const isInStickyHeader = element.closest('.pvs-sticky-header-profile-actions') || 
                                  element.closest('.pv-profile-sticky-header-v2__actions-container');
          const isInSidebar = element.closest('.scaffold-layout__aside') || 
                             element.closest('[class*="sidebar"]') ||
                             element.closest('[class*="aside"]');
          
          if (!isInStickyHeader && !isInSidebar) {
            console.log('[Oppli] 🎯 Found LinkedIn profile element:', className);
            
            // If this element could hold buttons, use it
            if (element.querySelector('button') || element.tagName === 'DIV') {
              targetContainer = element;
              console.log('[Oppli] 🎯 Using LinkedIn profile element as container');
              break;
            }
          }
        }
      }
    }
    
    // STRATEGY 4: Look for ANY container that might be suitable
    if (!targetContainer) {
      // Look for containers that have action-like classes
      const potentialContainers = document.querySelectorAll('[class*="actions"], [class*="profile-actions"], [class*="top-card"]');
      console.log('[Oppli] 🔍 Potential action containers found:', potentialContainers.length);
      
      for (const container of potentialContainers) {
        // Check if this container is in the main profile area (not sidebar/sticky)
        const isInStickyHeader = container.closest('.pvs-sticky-header-profile-actions') || 
                                container.closest('.pv-profile-sticky-header-v2__actions-container');
        const isInSidebar = container.closest('.scaffold-layout__aside') || 
                           container.closest('[class*="sidebar"]') ||
                           container.closest('[class*="aside"]');
        
        if (!isInStickyHeader && !isInSidebar) {
          // Check if this container looks like it could hold action buttons
          const hasActionButtons = container.querySelector('button, a[role="button"]');
          if (hasActionButtons || container.className.includes('actions')) {
            targetContainer = container;
            console.log('[Oppli] 🎯 Found potential action container:', container.className);
            break;
          }
        }
      }
    }
    
    // STRATEGY 5: Last resort - ONLY if we're sure this is a profile page
    if (!targetContainer) {
      console.log('[Oppli] 🔍 Last resort: Checking if this is actually a profile page...');
      
      // Only proceed with last resort if we're DEFINITELY on a profile page
      const isProfilePage = window.location.pathname.includes('/in/') && 
                           (document.body.textContent.includes('Experience') || 
                            document.body.textContent.includes('About') ||
                            document.body.textContent.includes('Activity') ||
                            document.querySelector('[data-section="profileTopCard"]'));
      
      if (!isProfilePage) {
        console.log('[Oppli] ❌ Not a profile page or profile not loaded, skipping last resort injection');
        return null;
      }
      
      console.log('[Oppli] ✅ Confirmed profile page, looking for suitable container...');
      
      // Look for profile-specific containers only
      const profileContainers = document.querySelectorAll('div[class*="pv-"], div[class*="profile"], div[class*="top-card"]');
      let bestCandidate = null;
      
      for (const div of profileContainers) {
        // Skip if it's in sidebar, sticky header, or navigation
        const isInStickyHeader = div.closest('.pvs-sticky-header-profile-actions') || 
                                div.closest('.pv-profile-sticky-header-v2__actions-container');
        const isInSidebar = div.closest('.scaffold-layout__aside') || 
                           div.closest('[class*="sidebar"]') ||
                           div.closest('[class*="aside"]');
        const isInNavigation = div.closest('.global-nav') || 
                              div.closest('[class*="nav"]') ||
                              div.closest('header');
        
        if (!isInStickyHeader && !isInSidebar && !isInNavigation && div.children.length > 0 && div.children.length <= 8) {
          // Check if this div looks like it could be a profile actions area
          const className = div.className || '';
          const hasProfileKeywords = className.includes('pv-') || 
                                    className.includes('profile') || 
                                    className.includes('top-card');
          
          if (hasProfileKeywords) {
            bestCandidate = div;
            console.log('[Oppli] 🎯 Found conservative profile container:', className, 'with', div.children.length, 'children');
            break;
          }
        }
      }
      
      if (bestCandidate) {
        targetContainer = bestCandidate;
      } else {
        console.log('[Oppli] ❌ No suitable profile container found, refusing to inject randomly');
        return null;
      }
    }
    
    if (targetContainer) {
      console.log('[Oppli] 🎯 Final target container:', targetContainer.className, targetContainer.tagName);
    } else {
      console.log('[Oppli] ❌ No suitable container found after exhaustive search');
    }
    
    return targetContainer;
  }
  
  // Helper function to inject button to a specific container
  function injectButtonToContainer(targetContainer) {
    if (!targetContainer) return false;
    
    console.log('[Oppli] 🎯 Found target container:', targetContainer.className);
        
        // Create our button
        const btn = makeOppliButton(onClick);
        btn.setAttribute('data-scope', 'profile');
        const wrap = document.createElement('div');
        wrap.className = 'pvs-profile-actions__action';
    wrap.style.cssText = 'display:inline-flex;align-items:center;height:32px;margin-right:8px;vertical-align:top;';
        wrap.appendChild(btn);
        
    // Insert to the left of the Message button (first position)
    const messageButton = targetContainer.querySelector('button[aria-label*="Message"]');
    if (messageButton) {
      targetContainer.insertBefore(wrap, messageButton);
      console.log('[Oppli] ✅ Successfully positioned button to the left of Message button');
    } else {
      // Fallback: insert at the beginning of the container
      targetContainer.insertBefore(wrap, targetContainer.firstChild);
      console.log('[Oppli] ✅ Successfully positioned button at the beginning of container');
    }
    
    console.log('[Oppli] 🔍 Container children count after injection:', targetContainer.children.length);
    console.log('[Oppli] 🔍 Button is now in DOM:', !!document.querySelector('.oppli-cta[data-scope="profile"]'));
          injected = true;
    injectionSuccessful = true; // Mark global success to stop all other systems
          return true;

  }
  
  // Function to detect if someone is in your network (has Message button)
  function isInMyNetwork() {
    // Look for Message button (means they're in your network)
    const messageButtons = document.querySelectorAll('button[aria-label*="Message"]');
    
    // Check if any Message button is NOT in sticky header (main profile area)
    for (const btn of messageButtons) {
      const isInStickyHeader = btn.closest('.pvs-sticky-header-profile-actions') || 
                              btn.closest('.pv-profile-sticky-header-v2__actions-container');
      
      if (!isInStickyHeader) {
        console.log('[Oppli] 🔍 Network detection: Message button found - person is in your network');
        return true;
      }
    }
    
    console.log('[Oppli] 🔍 Network detection: No Message button found - person is NOT in your network');
      return false;
    }
    
    function startObserving() {
    if (observer) {
      console.log('[Oppli] ⚠️ Observer already running, skipping...');
      return;
    }
    
    console.log('[Oppli] 🚀 Starting HYBRID observer - checking network status first...');
    
    // STRATEGY 1: Check if person is in your network (fast path for friends)
    if (isInMyNetwork()) {
      console.log('[Oppli] ⚡ Person is in your network - attempting immediate injection...');
      injectButton().then(success => {
        if (success) {
          console.log('[Oppli] ✅ Immediate injection successful (friend profile), stopping observer');
          injectionSuccessful = true; // Mark global success
          return; // No need to observe
        }
      });
    }
    
    console.log('[Oppli] ⏳ Person not in network or immediate injection failed, waiting for LinkedIn hydration...');
    
    // STRATEGY 2: Wait for hydration (for non-friends) - MORE PATIENT APPROACH
    let hydrationCount = 0;
    let hydrationTimer = null;
    let lastMutationTime = Date.now();
    let totalMutations = 0;
    let hydrationAttempts = 0;
    const maxHydrationAttempts = 3; // Try hydration detection up to 3 times
      
      observer = new MutationObserver((mutations) => {
      // Check if injection was successful from any system - if so, stop observing
      if (injectionSuccessful || document.querySelector('.oppli-cta[data-scope="profile"]')) {
        console.log('[Oppli] ✅ Button injection successful, stopping hydration observer');
          observer.disconnect();
          observer = null;
          return;
        }
        
      const now = Date.now();
      totalMutations++;
      
      // Count rapid mutations (LinkedIn is hydrating)
      if (now - lastMutationTime < 100) { // Mutations within 100ms = rapid hydration
        hydrationCount++;
      } else {
        hydrationCount = Math.max(0, hydrationCount - 1); // Decay if mutations slow down
      }
      
      lastMutationTime = now;
      
      // Debug: Log hydration status every 50 mutations
      if (totalMutations % 50 === 0) {
        console.log(`[Oppli] 🔍 Hydration status: count=${hydrationCount}, total=${totalMutations}, time=${now}`);
      }
      
      // Clear previous timer
      if (hydrationTimer) clearTimeout(hydrationTimer);
      
                // Set new timer - if no rapid mutations for 2 seconds, hydration is done
      hydrationTimer = setTimeout(() => {
        // Check again if injection was successful or we already have a button
        if (injectionSuccessful || document.querySelector('.oppli-cta[data-scope="profile"]')) {
          console.log('[Oppli] ✅ Button already present during hydration timer, stopping observer');
          if (observer) {
            observer.disconnect();
            observer = null;
          }
            return;
        }
        
        hydrationAttempts++;
        console.log(`[Oppli] 🧘 Hydration attempt ${hydrationAttempts}/${maxHydrationAttempts}: appears complete! (${hydrationCount} rapid mutations, ${totalMutations} total)`);
        console.log('[Oppli] 🎯 Now attempting injection...');
        
        // Try to inject
        injectButton().then(success => {
          if (success && observer) {
            console.log('[Oppli] ✅ Injection successful after hydration, stopping observer');
            injectionSuccessful = true; // Mark global success
            observer.disconnect();
            observer = null;
          } else {
            console.log('[Oppli] ❌ Injection failed after hydration');
            
            // If this was our last hydration attempt, keep observing for manual retry
            if (hydrationAttempts >= maxHydrationAttempts) {
              console.log('[Oppli] 🔄 Max hydration attempts reached, keeping observer for manual retry');
            } else {
              console.log('[Oppli] 🔄 Will retry hydration detection in 5 seconds...');
              // Reset hydration count for next attempt
              hydrationCount = 0;
              totalMutations = 0;
            }
          }
        });
      }, 2000); // Wait 2 seconds of no rapid mutations
    });
    
    // Observe the entire document
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
      
            // PERSISTENT FALLBACKS: Keep trying until LinkedIn structure is actually loaded
    const fallbackDelays = [1000, 2000, 4000, 8000, 16000, 32000, 64000, 90000, 120000, 180000]; // 1s to 3 minutes
    
    fallbackDelays.forEach((delay, index) => {
      setTimeout(() => { 
        // Check if injection successful, button exists, or observer is gone
        if (injectionSuccessful || !observer || document.querySelector('.oppli-cta[data-scope="profile"]')) {
          return; // Skip if injection successful, button exists, or observer stopped
        }
        
        console.log(`[Oppli] ⏰ Fallback ${index + 1}/${fallbackDelays.length}: Attempting injection after ${delay}ms...`);
        
        // Check if LinkedIn has loaded more structure since last attempt
        const hasNewStructure = document.querySelector('button[aria-label*="Message"]') || 
                               document.querySelector('button[aria-label*="Connect"]') ||
                               document.querySelector('.pv-top-card__actions-container');
        
        if (hasNewStructure) {
          console.log('[Oppli] 🔍 LinkedIn structure detected, attempting injection...');
          injectButton().then(success => {
            if (success && observer) {
              console.log(`[Oppli] ✅ Fallback ${index + 1} injection successful, stopping observer`);
              injectionSuccessful = true; // Mark global success
          observer.disconnect();
          observer = null;
        }
          });
        } else {
          // Debug: Let's see what containers ARE available
          console.log('[Oppli] ⏳ LinkedIn structure not ready yet, but let me check what IS available...');
          const availableContainers = document.querySelectorAll('[class*="actions"], [class*="profile"], [class*="top-card"], [class*="pv-"], [class*="scaffold"], [class*="artdeco"]');
          console.log('[Oppli] 🔍 Available containers:', availableContainers.length);
          availableContainers.forEach((container, idx) => {
            if (idx < 5) { // Show first 5 to avoid spam
              console.log(`[Oppli] 🔍 Container ${idx}:`, container.className, container.tagName, container.textContent.substring(0, 50));
            }
          });
          
          // Also check for any text content that might indicate profile loading
          const profileText = document.body.textContent;
          if (profileText.includes('Loading') || profileText.includes('profile') || profileText.includes('experience')) {
            console.log('[Oppli] 🔍 Profile content detected, LinkedIn is still loading...');
          }
          
          // On the last fallback, show floating button as ultimate fallback
          if (index === fallbackDelays.length - 1) {
            console.log('[Oppli] 🚨 All fallbacks completed, showing floating button as ultimate fallback');
            forceFloatProfileButton(onClick);
            // Keep the observer running to catch when LinkedIn finally loads
          }
        }
      }, delay);
    });
    
    // CONTINUOUS MONITORING: Keep checking for LinkedIn structure changes every 2 seconds
    let lastStructureCheck = Date.now();
    const structureCheckInterval = setInterval(() => {
      if (!observer) {
        clearInterval(structureCheckInterval);
        return;
      }
      
      const now = Date.now();
      if (now - lastStructureCheck > 2000) { // Check every 2 seconds (more frequent)
        lastStructureCheck = now;
        
        // Check if LinkedIn has loaded more structure
        const hasNewStructure = document.querySelector('button[aria-label*="Message"]') || 
                               document.querySelector('button[aria-label*="Connect"]') ||
                               document.querySelector('.pv-top-card__actions-container');
        
        if (hasNewStructure && !document.querySelector('.oppli-cta[data-scope="profile"]')) {
          console.log('[Oppli] 🔍 LinkedIn structure changed, attempting injection...');
          injectButton().then(success => {
            if (success && observer) {
              console.log('[Oppli] ✅ Injection successful after structure change, stopping observer');
          observer.disconnect();
          observer = null;
              clearInterval(structureCheckInterval);
            }
          });
        }
      }
    }, 1000); // Check every 1 second
    
            // CONTINUOUS MONITORING: Start monitoring immediately and keep going
    console.log('[Oppli] 🔄 Starting continuous monitoring for LinkedIn structure changes...');
    
    // Monitor every 2 seconds for LinkedIn structure
    const continuousMonitoring = setInterval(() => {
      if (!observer) {
        clearInterval(continuousMonitoring);
        return;
      }
      
      // Check if our button was removed by LinkedIn
      const buttonExists = document.querySelector('.oppli-cta[data-scope="profile"]');
      if (!buttonExists && injected) {
        console.log('[Oppli] 🔄 Button was removed by LinkedIn, re-injecting...');
        injected = false; // Reset flag to allow re-injection
      }
      
      // Check if LinkedIn has loaded the profile structure
      const hasProfileStructure = document.querySelector('button[aria-label*="Message"]') || 
                                 document.querySelector('button[aria-label*="Connect"]') ||
                                 document.querySelector('.pv-top-card__actions-container');
      
      if (hasProfileStructure && !buttonExists) {
        console.log('[Oppli] 🎯 LinkedIn profile structure detected! Attempting injection...');
        injectButton().then(success => {
          if (success && observer) {
            console.log('[Oppli] ✅ Injection successful after continuous monitoring, stopping observer');
          observer.disconnect();
          observer = null;
            clearInterval(continuousMonitoring);
          }
        });
      }
    }, 2000); // Check every 2 seconds
    
    // Note: Floating button is now shown after all fallbacks fail (at 3 minutes)
    // No need for separate 3-minute timeout since fallbacks handle this total
    
    // ADDITIONAL: Monitor button stability every 1 second
    const buttonStabilityMonitor = setInterval(() => {
      if (!observer) {
        clearInterval(buttonStabilityMonitor);
        return;
      }
      
      const buttonExists = document.querySelector('.oppli-cta[data-scope="profile"]');
      if (!buttonExists && injected) {
        console.log('[Oppli] 🔄 Button stability check: Button was removed, re-injecting...');
        injected = false; // Reset flag to allow re-injection
        
        // Try to re-inject immediately
        injectButton().then(success => {
          if (success) {
            console.log('[Oppli] ✅ Button re-injection successful');
          }
        });
      }
    }, 1000); // Check every 1 second
    
    // AGGRESSIVE MONITORING: For very slow profiles, start checking every 30 seconds after 2 minutes
      setTimeout(() => { 
      if (observer && !document.querySelector('.oppli-cta[data-scope="profile"]')) {
        console.log('[Oppli] 🚨 2 minutes passed, starting aggressive monitoring for slow profiles...');
        
        const aggressiveMonitor = setInterval(() => {
          if (!observer) {
            clearInterval(aggressiveMonitor);
            return;
          }
          
          // Check if LinkedIn finally loaded the structure
          const hasStructure = document.querySelector('button[aria-label*="Message"]') || 
                              document.querySelector('button[aria-label*="Connect"]') ||
                              document.querySelector('.pv-top-card__actions-container');
          
          if (hasStructure) {
            console.log('[Oppli] 🎯 LinkedIn structure finally loaded! Attempting injection...');
            injectButton().then(success => {
              if (success && observer) {
                console.log('[Oppli] ✅ Aggressive monitoring injection successful, stopping observer');
          observer.disconnect();
          observer = null;
                clearInterval(aggressiveMonitor);
              }
            });
          }
        }, 30000); // Check every 30 seconds
        
        // Stop aggressive monitoring after 5 minutes total
      setTimeout(() => { 
          if (aggressiveMonitor) {
            clearInterval(aggressiveMonitor);
            console.log('[Oppli] ⏰ Aggressive monitoring timeout reached');
          }
        }, 180000); // 3 minutes of aggressive monitoring
      }
    }, 120000); // Start after 2 minutes
    }
    
    function stopObserving() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    }
    
    return {
      inject: injectButton,
      start: startObserving,
      stop: stopObserving,
      isInjected: () => injected
    };
  }

  // Force button into the exact position we want
  function forceButtonPosition(onClick) {
    console.log('[Oppli] Force positioning button...');
    
    // Remove any existing floating button first
    const existingFloat = document.getElementById('oppli-float-profile');
    if (existingFloat) existingFloat.remove();
    
    // Create our button
    const btn = makeOppliButton(onClick);
    btn.setAttribute('data-scope', 'profile');
    const wrap = document.createElement('div');
    wrap.className = 'pvs-profile-actions__action';
    wrap.style.cssText = 'display:inline-flex;align-items:center;margin-left:8px';
    wrap.appendChild(btn);
    
    // Strategy 1: Target the specific container using the provided element path
    const targetContainer = document.querySelector('#profile-content > div > div > main > section > div.ph5.pb5 > div.xAPeOvyAqXCtbBrNUbVaYWpYdgeGTDGgsI');
    
    if (targetContainer) {
      console.log('[Oppli] 🎯 Found target profile container using specific selector');
      
      // Insert after the last button in this container
      const buttons = targetContainer.querySelectorAll('button, a[role="button"]');
      const lastButton = buttons[buttons.length - 1];
      
      if (lastButton && lastButton.parentElement) {
        lastButton.parentElement.insertBefore(wrap, lastButton.nextSibling);
        console.log('[Oppli] ✅ Successfully positioned button in target container');
        return true;
      }
    }
    
    // Strategy 2: Look for the exact container with Message and More buttons
    const allDivs = Array.from(document.querySelectorAll('div'));
    let fallbackContainer = null;
    
    for (const div of allDivs) {
      const buttons = div.querySelectorAll('button, a[role="button"]');
      if (buttons.length >= 2) {
        const buttonTexts = Array.from(buttons).map(b => 
          (b.innerText || b.textContent || '').toLowerCase().trim()
        );
        
        // Check if this container has both Message and More
        const hasMessage = buttonTexts.some(text => text === 'message');
        const hasMore = buttonTexts.some(text => text === 'more');
        
        if (hasMessage && hasMore) {
          fallbackContainer = div;
          console.log('[Oppli] Found fallback container with Message and More buttons');
          break;
        }
      }
    }
    
    if (fallbackContainer) {
      // Insert after the last button in this container
      const buttons = fallbackContainer.querySelectorAll('button, a[role="button"]');
      const lastButton = buttons[buttons.length - 1];
      
      if (lastButton && lastButton.parentElement) {
        lastButton.parentElement.insertBefore(wrap, lastButton.nextSibling);
        console.log('[Oppli] Successfully force positioned button in fallback container');
        return true;
      }
    }
    
    // Strategy 3: Look for any button with "Message" text and insert next to it
    const messageButtons = Array.from(document.querySelectorAll('button, a[role="button"]')).filter(btn => 
      (btn.innerText || btn.textContent || '').toLowerCase().trim() === 'message'
    );
    
    if (messageButtons.length > 0) {
      const messageBtn = messageButtons[0];
      if (messageBtn.parentElement) {
        messageBtn.parentElement.insertBefore(wrap, messageBtn.nextSibling);
        console.log('[Oppli] Force positioned next to Message button');
        return true;
      }
    }
    
    // Strategy 4: Look for any button with "More" text and insert next to it
    const moreButtons = Array.from(document.querySelectorAll('button, a[role="button"]')).filter(btn => 
      (btn.innerText || btn.textContent || '').toLowerCase().trim() === 'more'
    );
    
    if (moreButtons.length > 0) {
      const moreBtn = moreButtons[0];
      if (moreBtn.parentElement) {
        moreBtn.parentElement.insertBefore(wrap, moreBtn.nextSibling);
        console.log('[Oppli] Force positioned next to More button');
        return true;
      }
    }
    
    console.log('[Oppli] Force positioning failed, falling back to floating button');
    return false;
  }

  function forceFloatProfileButton(onClick){
      if (!/linkedin\.com\/in\//.test(location.href)) return false;
      
      // if already mounted anywhere, stop
      if (document.querySelector('.oppli-cta[data-scope="profile"]')) return true;
      
      let flo = document.getElementById('oppli-float-profile');
      if (!flo) {
        flo = document.createElement('div');
        flo.className = 'oppli-float';
        flo.id = 'oppli-float-profile';
        document.documentElement.appendChild(flo); // <= not body (avoids body timing)
      }
      
      // Remove the gray background container - just position the button directly
      flo.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483647;';
      
      flo.innerHTML = '';
      const btn = makeOppliButton(onClick);
      btn.setAttribute('data-scope', 'profile');
      
      // Use the same styling as when injected (no custom inline styles)
      flo.appendChild(btn);
      return true;
    }
    

  function toast(msg){
    const d = document.createElement("div");
    d.textContent = msg;
    d.style.cssText = "position:fixed;z-index:2147483647;bottom:16px;right:16px;background:#0ea5e9;color:#fff;padding:10px 14px;border-radius:10px;font-weight:700;box-shadow:0 4px 16px rgba(0,0,0,.2)";
    document.body.appendChild(d); setTimeout(()=>d.remove(),1600);
  }

  // Robust DOM scraper for the job header card
// Robust DOM scraper for the job header card (right-pane + full page)
// --- helper: robust text getter (handles nested spans, aria-label, title) ---
function visibleText(el) {
  if (!el) return "";
  // Prefer human-visible text
  let t = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  if (t) return t;
  // Try common nested span used by LinkedIn
  const hid = el.querySelector("[aria-hidden='true'], [aria-hidden=true]");
  if (hid) {
    t = (hid.innerText || hid.textContent || "").replace(/\s+/g, " ").trim();
    if (t) return t;
  }
  // Fallback to aria-label / title
  return (el.getAttribute("aria-label") || el.getAttribute("title") || "").trim();
}

// Scrolls, expands, and if needed opens the dedicated "details/experience" view.
// Scrolls / expands / or opens the in-place "details/experience" view so rows exist
async function ensureExperienceMounted(){
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

  // 1) Try to find the Experience card/section
  let sec =
    document.querySelector("#experience") ||
    document.querySelector("section[aria-label='Experience']") ||
    document.querySelector("section[data-view-name*='experience']") ||
    Array.from(document.querySelectorAll("section"))
      .find(s => /experience/i.test((s.querySelector("h2,h3")?.innerText || "")));

  if (sec) {
    sec.scrollIntoView({block:"center"});
    await sleep(200);

    // Expand "Show all" if available
    const showAll =
      sec.querySelector("a[href*='/details/experience']") ||
      sec.querySelector("button[aria-expanded='false'], button[aria-label*='Show']");
    if (showAll) { showAll.click(); await sleep(600); }
  }

  // 2) If still no rows, open the dedicated details view (same page swap)
  sec =
    document.querySelector("#experience") ||
    document.querySelector("section[aria-label='Experience']") ||
    document.querySelector("section[data-view-name*='experience']");
  const hasRows = !!sec && sec.querySelectorAll("li, .pvs-entity, [data-view-name='profile-component-entity']").length > 0;

  if (!hasRows) {
    const detailsLink =
      document.querySelector("a[href*='/details/experience/']") ||
      document.querySelector("a[data-test-entity-list-show-all='experience']");
    if (detailsLink) { detailsLink.click(); await sleep(900); }
  }

  // 3) Nudge to trigger virtualization
  window.scrollBy(0, 1); await sleep(120);
  window.scrollBy(0,-1); await sleep(120);
}


// --- helper: escape HTML for safe rendering ---
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}
function makeOppliButton(onClick){
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "oppli-cta";
  btn.dataset.scope = "profile";
  btn.setAttribute("aria-label","Save to Oppli");
  btn.addEventListener("click", onClick);

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS,"svg");
  svg.setAttribute("class","oppli-logo");
  svg.setAttribute("viewBox","0 0 100 100");
  svg.setAttribute("aria-hidden","true");
  const r = document.createElementNS(NS,"rect");
  r.setAttribute("x","10"); r.setAttribute("y","10");
  r.setAttribute("width","80"); r.setAttribute("height","80");
  r.setAttribute("rx","16"); r.setAttribute("ry","16");
  r.setAttribute("fill","#00CED1");
  const p = document.createElementNS(NS,"path");
  p.setAttribute("d","M25 50l15 15 35-35");
  p.setAttribute("stroke","#002B5B");
  p.setAttribute("stroke-width","6");
  p.setAttribute("fill","none");
  p.setAttribute("stroke-linecap","round");
  p.setAttribute("stroke-linejoin","round");
  svg.append(r,p);

  const span = document.createElement("span");
  span.textContent = "Save to Oppli";

// Add styling that matches LinkedIn's button design exactly
btn.style.cssText = 'height: 32px; font-size: 14px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px; border: none; border-radius: 16px; background-color: #0a66c2; color: white; cursor: pointer; font-weight: 600; box-sizing: border-box; line-height: 1.2;';

  btn.append(svg, span);
  return btn;
}


function injectProfileCtaWithRetry(onClick, tries = 12) {
  // try every ~250ms up to ~3s
  const ok = insertOppliProfileButton(onClick);
  if (ok) return;
  if (tries <= 0) return;
  setTimeout(() => injectProfileCtaWithRetry(onClick, tries - 1), 250);
}

// Trim company at first bullet/pipe/slash or common employment-type words

function cutCompanyNoise(s){
  // Keep just the company name; drop employment type and extra bullets
  return String(s || "")
    .replace(/\s+/g, " ")
    .split(/(?:\s*[•·|/]\s*)/)[0]                               // stop at first bullet/pipe/slash
    .split(/\s+(?:Full-?time|Part-?time|Internship|Contract|Temporary|Freelance|Apprenticeship|Co-?op)\b/i)[0]
    .trim();
}


// Split a composite like: "Role — Company · Full-time …"
function splitRoleCompanyLine(t){
  const s = String(t || "").replace(/\s+/g, " ").trim();
  const m = s.match(/^(.*?)\s*[–—-]\s*([^•·|/]+)(?:[•·|/].*)?$/); // role — company · …
  if (!m) return { role: "", company: "" };
  return { role: m[1].trim(), company: cutCompanyNoise(m[2]) };
}

// Return the first composite line we can find inside this experience block
function _findCompositeLine(el){
  const nodes = el.querySelectorAll(
    ".t-bold, .t-bold span[aria-hidden='true'], " +
    ".mr1.t-bold span[aria-hidden='true'], " +
    "span[aria-hidden='true'], .inline-show-more-text, .display-flex.full-width"
  );
  for (const n of nodes){
    const txt = (n.innerText || n.textContent || "").replace(/\s+/g," ").trim();
    if (txt.includes("—") || txt.includes(" - ") || /[–—-]/.test(txt)) return txt;
  }
  return "";
}

// Pull role + company from a single experience block.
// Tries links first, then falls back to parsing "Role — Company · …"



// Ensure the Experience section is rendered (handles virtualization / "Show all")
async function ensureExperienceVisible(){
  const wait = (ms)=>new Promise(r=>setTimeout(r,ms));

  // Try to locate the experience section
  const section =
    document.querySelector("#experience") ||
    document.querySelector("section[aria-label='Experience']") ||
    document.querySelector("section[data-view-name*='experience']") ||
    Array.from(document.querySelectorAll("section"))
      .find(s => /experience/i.test((s.querySelector("h2,h3")?.innerText || "")));

  if (!section) return;

  // Scroll into view a couple times so LinkedIn mounts virtual rows
  section.scrollIntoView({ behavior: "instant", block: "center" });
  await wait(200);
  window.scrollBy(0, 1); // nudge
  await wait(100);
  window.scrollBy(0, -1);

  // Expand if a "Show all" or similar button exists
  const expandBtn = section.querySelector("button[aria-expanded='false'], button[aria-label*='Show'], button:has(svg)");
  if (expandBtn) { expandBtn.click(); await wait(300); }

  // Also click tiny "… more" expanders inside items if present
  section.querySelectorAll("button[aria-label*='more'], button[aria-expanded='false']").forEach(b=>{
    if (/more/i.test(b.ariaLabel||"")) b.click();
  });

  // Give the DOM a moment to render the list
  await wait(350);
}

// --- helper: pick a plausible location token ---
function normalizeLocation(raw) {
  if (!raw) return "";
  // Split on bullets or pipes, trim pieces
  let parts = raw.split(/·|\|/).map(s => s.trim()).filter(Boolean);
  if (!parts.length) parts = [raw.trim()];
  // Drop work-mode noise
  parts = parts.filter(p => !/remote|hybrid|on-?site|full-?time|part-?time|contract/i.test(p));
  // Heuristic: prefer the last token that looks like a place
  const place = parts.findLast
    ? parts.findLast(p => /,|United|Kingdom|USA|City|County|State|Province|Emirates/i.test(p) || p.split(/\s+/).length >= 2)
    : parts.reverse().find(p => /,|United|Kingdom|USA|City|County|State|Province|Emirates/i.test(p) || p.split(/\s+/).length >= 2);
  return (place || parts[0] || "").trim();
}

// --- Robust DOM scraper for the job header card (right-pane + full page)


// Heuristic location picker that works across LinkedIn variants
// Heuristic location picker that works across LinkedIn variants
function extractLocation(topCard, jobTitle){
  const candidates = [];
  const push = (t) => {
    t = (t || "").replace(/[•·]/g, " ").replace(/\s+/g, " ").trim();
    if (!t) return;
    // drop obvious noise
    if (/remote|hybrid|on-?site|full[- ]?time|part[- ]?time|contract|intern(ship)?|permanent|temporary|applicants?/i.test(t)) return;
    if (jobTitle && t.toLowerCase() === jobTitle.toLowerCase()) return; // <-- don't pick the title
    if (t.length > 80) return;

    // score by "how much it looks like a place"
    let score = 0;
    if (/,/.test(t)) score += 2;
    if (/\b(United|Kingdom|UK|England|Scotland|Wales|Ireland|USA|United States|Canada|Germany|France|Spain|Italy|Netherlands|UAE|Emirates|Singapore|Australia|Mexico|Brazil|India|City|County|State|Province)\b/i.test(t)) score += 3;
    if (t.split(/\s+/).length >= 2) score += 1;

    candidates.push({ t, score });
  };

  const sels = [
    "[data-test-job-details-location]",
    "[data-test-meta-location]",
    ".jobs-unified-top-card__primary-description li",
    ".jobs-unified-top-card__subtitle-secondary-grouping li",
    ".jobs-details-top-card__primary-description li",
    ".topcard__flavor-row li",
    ".jobs-unified-top-card__subtitle-secondary-grouping",
    "[data-test-details-subtitle]"
  ];
  for (const sel of sels){
    topCard.querySelectorAll(sel).forEach(el => push(el.innerText || el.textContent || ""));
  }

  // small sweep around the title row (covers some A/B UIs)
  const near = topCard.querySelector("h1")?.parentElement;
  if (near) near.querySelectorAll(":scope > * , :scope > * *").forEach(el => push(el.innerText || el.textContent || ""));

  if (!candidates.length) return "";
  candidates.sort((a,b) => b.score - a.score);
  return candidates[0].t;
}


function scrapeJobDom(topCard){
  const title =
    visibleText(
      topCard.querySelector(
        "h1[data-test-job-title], h1.jobs-unified-top-card__job-title, h1.top-card-layout__title, .jobs-details-top-card__job-title, h1"
      )
    ) || "";

  // COMPANY
  const companyEl =
    topCard.querySelector(
      "a[href*='/company/'], [data-test-company-name], .jobs-details-top-card__company-info a, .jobs-unified-top-card__company-name a, .artdeco-entity-lockup__subtitle a"
    ) || topCard.querySelector(".jobs-unified-top-card__company-name, .jobs-details-top-card__company-info");

  let companyName = visibleText(companyEl);
  if (!companyName) {
    const nested = companyEl && companyEl.querySelector("span[aria-hidden='true'], span[aria-hidden=true]");
    companyName = visibleText(nested);
  }
  if (!companyName) companyName = guessCompanyFromTitle(title);

  // clean up "logo" suffix and normalize spaces
  companyName = (companyName || "").replace(/\blogo\b/gi, "").replace(/\s+/g, " ").trim();

  // LOCATION (now via the helper)
  const location = extractLocation(topCard, title);


  // DESCRIPTION (for notes)
  const description = visibleText(
    topCard.querySelector("[data-test-description], #job-details, .jobs-description__container, .description__text")
  );

  // LOGO (DOM fallback)
  let logoUrl = "";
  const logoImg =
    topCard.querySelector(".jobs-unified-top-card img") ||
    topCard.querySelector(".artdeco-entity-lockup__image img") ||
    topCard.querySelector("img[alt*='logo' i], img[src*='logo' i]");
  if (logoImg) logoUrl = logoImg.getAttribute("src") || logoImg.getAttribute("data-delayed-url") || "";
  if (logoUrl && logoUrl.startsWith("data:")) logoUrl = ""; // ignore tiny placeholders

  console.log("[Oppli] DOM scrape:", { title, companyName, location });
  return { title, companyName, location, description, logoUrl };
}


  // 1) Prefer LinkedIn's JSON-LD <script type="application/ld+json">
  function readJobFromJsonLd(){
      try{
        const nodes = document.querySelectorAll('script[type="application/ld+json"]');
        for (const s of nodes){
          const raw = s.textContent?.trim() || "";
          if (!raw || !/JobPosting/i.test(raw)) continue;
    
          const obj = JSON.parse(raw);
          const jp = Array.isArray(obj) ? obj.find(x => x['@type']==='JobPosting') : obj;
          if (!jp) continue;
    
          const title = jp.title || "";
          const companyName = jp.hiringOrganization?.name || jp.hiringOrganization?.legalName || "";
    
          // --- better location extraction
          const locParts = [
            jp?.jobLocation?.address?.addressLocality,
            jp?.jobLocation?.address?.addressRegion,
            jp?.jobLocation?.address?.addressCountry
          ].filter(Boolean);
          const location = locParts.join(", ");
    
          const description = (jp.description || "").replace(/<[^>]*>/g, " ").trim();
    
          // --- logo URL if present in JSON-LD
          const logoUrl =
            (jp?.hiringOrganization?.logo && (jp.hiringOrganization.logo.url || jp.hiringOrganization.logo)) ||
            (typeof jp?.image === "string" ? jp.image : jp?.image?.url) || "";
    
          return { title, companyName, location, description, logoUrl };
        }
      }catch{}
      return null;
    }
    

// tiny DOM helper that searches *inside a container*
function textIn(container, selectors, useInner=false){
  for (const sel of selectors){
    const el = container.querySelector(sel);
    if (el){
      const t = useInner ? el.innerText : el.textContent;
      const v = (t||"").trim();
      if (v) return v;
    }
  }
  return "";
}

async function captureLogo(topCard, companyId, data) {
  const img = topCard.querySelector(
    "img[alt*='logo' i], .artdeco-entity-lockup__image img, " +
    ".jobs-top-card__company-logo img, .jobs-unified-top-card__company-logo img, " +
    "img[src*='media.licdn.com']"
  );
  if (!img || !img.src) return;

  try {
    const res  = await fetch(img.src);
    const blob = await res.blob();
    const dataUrl = await new Promise(r => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result);
      fr.readAsDataURL(blob);
    });

    const id = `logo-${companyId}`;
    // read existing images bucket
    const images = await new Promise(res =>
      chrome.storage.local.get("oppliImages", o => res(o.oppliImages || { logos: [] }))
    );
    images.logos = (images.logos || []).filter(l => l.id !== id);
    images.logos.push({ id, type: blob.type || "image/png", dataUrl });

    // write bucket + connect company.logoId
    await new Promise(res => chrome.storage.local.set({ oppliImages: images }, res));
    const c = data.companies.find(c => c.id === companyId);
    if (c) c.logoId = id;
  } catch (e) {
    console.debug("[Oppli] logo capture failed:", e);
  }
}


  function text(selectors, useInner=false){
    for (const sel of selectors){
      const el = document.querySelector(sel);
      if (el){
        const t = useInner ? el.innerText : el.textContent;
        const v = (t || "").trim();
        if (v) return v;
      }
    } return "";
  }
  function guessCompanyFromTitle(title){
    const m = (title || "").match(/\bat\s+([A-Z][\w&.\- ]+)/i);
    return m ? m[1].trim() : "";
  }

  // --- small helpers for profiles ---
function cleanCompany(s){
  return (s || "").replace(/\blogo\b/gi, "").replace(/\s+/g, " ").trim();
}

// Clean helper reused in a few places
function _clean(s){
  return (s||"").replace(/\blogo\b/ig,"").replace(/\s+/g," ").trim();
}

// Looks like a date/duration (e.g., "Jun 2021 - Jun 2023", "2 yrs 1 mo")
function isDateish(s){
  const t = String(s||"").toLowerCase().trim();
  if (!t) return false;
  if (/\b\d{4}\b/.test(t) && /[-–—]/.test(t)) return true;          // year + dash
  if (/\b( jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec )/i.test(" " + t + " ")) return true; // month names
  if (/\b(yrs?|mos?|months?)\b/.test(t)) return true;               // durations
  return false;
}

// Strip employment type etc. ("Mastercard · Full-time" -> "Mastercard")
function companyDisplayOnly(s){
  return String(s||"")
    .replace(/\s*[•·|/].*$/, "")     // cut after first bullet/pipe/slash
    .replace(/\s*\([^)]*\)\s*$/, "") // drop trailing (...) dates
    .trim();
}

// Reject "Full-time", "Internship", etc.
function isEmploymentTypeish(s=""){
  s = String(s || "").toLowerCase();
  return /\b(full[-\s]?time|part[-\s]?time|intern(ship)?|contract|temporary|freelance|self[-\s]?employed|apprenticeship|co-?op|permanent)\b/i.test(s);
}

// Safer parent-card company getter
function headerCompanyOf(el){
  if (!el) return "";
  // 1) Prefer real /company/ link text (with hidden span if present)
  let txt =
    el.querySelector(":scope a[href*='/company/'] span[aria-hidden='true']")?.innerText ||
    el.querySelector(":scope a[href*='/company/']")?.textContent || "";

  // 2) Sometimes the logo <img alt="..."> carries the clean name
  if (!txt) txt = el.querySelector(":scope img[alt]")?.getAttribute("alt") || "";

  // 3) Very last resort: bold header inside the card head
  if (!txt) {
    txt =
      el.querySelector(":scope .t-bold span[aria-hidden='true']")?.innerText ||
      el.querySelector(":scope .t-bold")?.textContent || "";
  }

  txt = companyDisplayOnly(cutCompanyNoise((txt || "").replace(/\s+/g, " ").trim()));
  if (!txt || isDateish(txt) || isEmploymentTypeish(txt)) return "";
  return txt;
}


function pickBestCompany(el){
  // A. most reliable: the company link (with hidden span if present)
  const a = el.querySelector("a[href*='/company/'] span[aria-hidden='true'], a[href*='/company/']");
  const fromLink = _clean(a?.innerText || a?.textContent || "");
  if (fromLink) return fromLink;

  // B. common fallbacks in old/new UIs
  const fallbacks = [
    ".pv-entity__secondary-title",
    "[data-field='experience_company_name']",
    ".t-14.t-normal" // generic subtitle line that often holds company
  ];
  for (const sel of fallbacks){
    const t = _clean(el.querySelector(sel)?.innerText || el.querySelector(sel)?.textContent || "");
    if (t) return t;
  }

  // C. Composite header like "Role — Company · …"
  const header = el.querySelector(".display-flex.full-width") || el;
  const pieces = Array.from(header.querySelectorAll("span[aria-hidden='true'], .t-bold, .inline-show-more-text"))
    .map(n => _clean(n.innerText || n.textContent)).filter(Boolean);

  for (const s of pieces){
    if (!s || s.startsWith("—")) continue;
    if (s.includes("—")) {
      const [left, rightRaw=""] = s.split("—");
      const right = rightRaw.split("·")[0]; // drop employment type etc.
      const company = _clean(right);
      if (company) return company;
    }
  }
  return "";
}

// Pull role + company from a single experience block
function extractRoleCompany(el){
  // ROLE: prefer bold line; strip descriptions after "—" or "·"
  let role =
    el.querySelector(".t-bold span[aria-hidden='true']")?.innerText ||
    el.querySelector(".mr1.t-bold span[aria-hidden='true']")?.innerText ||
    el.querySelector(".mr1 span[aria-hidden='true']")?.innerText ||
    el.querySelector("[data-field='experience_position_title']")?.innerText ||
    el.querySelector(".pv-entity__summary-info h3 span:nth-child(2)")?.innerText ||
    el.querySelector(".pv-entity__summary-info h3")?.innerText ||
    el.querySelector(".t-bold")?.innerText || "";
  role = _clean(role);
  if (role.includes("—")) role = role.split("—")[0].trim();
  if (role.includes("·")) role = role.split("·")[0].trim();
  if (!role || role.startsWith("—")) role = "";

  // COMPANY: via robust picker first
  let company = cutCompanyNoise(pickBestCompany(el));

  // ---- NEW: subtitle fallback (only if still empty) ----
  if (!company) {
    // Typical LinkedIn subtitle under the role contains: "Open Market · Full-time"
    const subtitleEl =
      el.querySelector(".pvs-entity__subtitle") ||
      el.querySelector(".t-14.t-normal.t-black--light") ||
      el.querySelector(".inline-show-more-text");

    let subtitle = _clean(subtitleEl?.innerText || subtitleEl?.textContent || "");

    if (subtitle) {
      // Keep the part before the first bullet/pipe and strip employment type
      let cand = companyDisplayOnly(cutCompanyNoise(subtitle));
      // Extra safety: reject dates/employment-type and duplicates of the role
      if (cand &&
          !isDateish(cand) &&
          !isEmploymentTypeish(cand) &&
          cand.toLowerCase() !== (role || "").toLowerCase()) {
        company = cand;
      }
    }
  }
  // ------------------------------------------------------

  // If LinkedIn duplicated role into the company slot, drop it
  if (company && role && company.toLowerCase() === role.toLowerCase()) {
    company = "";
  }

  return { role, company };
}


function getProfileName(){
  // primary selectors
  const el = document.querySelector(
    "h1[data-test-id='hero-primary-heading'], " +
    "h1.text-heading-xlarge, " +
    ".pv-text-details__left-panel h1, " +
    "section.pv-top-card h1"
  );
  let name = visibleText(el);

  // fallback: OpenGraph <meta property="og:title" content="Name | LinkedIn">
  if (!name) {
    const og = document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
    if (og) name = og.split("|")[0].trim();
  }
  // fallback: document.title ("Name | LinkedIn")
  if (!name && document.title) {
    name = document.title.split("|")[0].trim();
  }
  
  // Clean the name: remove LinkedIn's "(1)", "(2)" prefixes and normalize whitespace
  name = (name || "").replace(/\s+/g, " ").trim();
  name = name.replace(/^\s*\(\d+\)\s*/, ""); // Remove "(1)", "(2)", etc. at the beginning
  name = name.replace(/\s*\(\d+\)\s*$/, ""); // Also remove "(1)", "(2)", etc. at the end (just in case)
  
  return name;
}

function getHeadline(){
  return (
    visibleText(document.querySelector(".pv-text-details__right-panel")) ||
    visibleText(document.querySelector(".text-body-medium.break-words")) ||
    visibleText(document.querySelector("[data-test-id='profile-rail-card-subtitle']")) ||
    ""
  );
}
// Parse Experience section into a few options {company, role, dates, current}
function parseExperiences(){
  const root =
    document.querySelector("section#experience") ||
    document.querySelector("section[aria-label='Experience']") ||
    document.querySelector("section[data-view-name*='profile-section-experience']");
  const items = [];
  if (!root) return items;

  // LinkedIn renders items as <li> in multiple variants
  const rows = root.querySelectorAll("li.pvs-list__paged-list-item, li.artdeco-list__item, li");
  for (const li of rows){
    // company
    const compEl =
      li.querySelector("a[href*='/company/']") ||
      li.querySelector(".pv-entity__secondary-title, [data-field='experience_company_name']");
    const company = (compEl?.innerText || compEl?.textContent || "").replace(/\blogo\b/gi,"").replace(/\s+/g," ").trim();
    if (!company) {
      const subEl = li.querySelector(".pvs-entity__subtitle, .t-14.t-normal.t-black--light");
      const subTxt = _clean(subEl?.innerText || subEl?.textContent || "");
      const cand = companyDisplayOnly(cutCompanyNoise(subTxt));
      if (cand && !isDateish(cand) && !isEmploymentTypeish(cand)) company = cand;
    }
    // role/title
    const roleEl =
      li.querySelector("[data-field='experience_position_title']") ||
      li.querySelector(".mr1.t-bold span, .t-bold span") ||
      li.querySelector(".pv-entity__summary-info h3 span:nth-child(2)") ||
      li.querySelector("h3") ||
      li.querySelector("span[aria-hidden='true']");
    const role = (roleEl?.innerText || roleEl?.textContent || "").replace(/\s+/g," ").trim();

    // dates
    const datesEl =
      li.querySelector(".pvs-entity__caption-wrapper, .t-14.t-normal.t-black--light, .pv-entity__date-range span:nth-child(2)");
    const datesRaw = (datesEl?.innerText || datesEl?.textContent || "").replace(/\s+/g," ").trim();
    const current = /present|current/i.test(datesRaw);

    items.push({ company, role, dates: datesRaw, current });
    if (items.length >= 6) break; // don't overwhelm
  }
  return items;
}

// Show a tiny picker; resolves to {company, role} or null on cancel
// Branded picker with top-mode toggle: "Select from profile" OR "Enter manually"
// Resolves to { company, role } or null on cancel
function showContactPicker(personName, options){
  // remove any previous modal
  document.getElementById("oppli-contact-picker")?.remove();

  // one-time styles
  if (!document.getElementById("oppli-picker-style")) {
    const s = document.createElement("style");
    s.id = "oppli-picker-style";
    s.textContent = `
/* helpers */
.hidden{display:none!important;}
.oppli-sheet{overflow:visible;} /* prevent select clipping */

/* Header */
.oppli-sheet header{
  position:relative;
  background:linear-gradient(90deg,#002B5B,#007F7F);
  color:#fff;
  border-bottom:none;
  padding:14px 16px;
}
.oppli-head-left{
  display:flex;
  align-items:center;
  gap:10px;
  font-weight:800;
  font-size:16px;
}
.oppli-head-left svg{width:22px;height:22px}

/* Close "X" */
.oppli-close{
  position:absolute;
  top:8px; right:8px;
  background:transparent;border:none;color:#fff;cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;
  width:32px;height:32px;border-radius:8px;opacity:.9
}
.oppli-close:hover{opacity:1;background:rgba(255,255,255,.08)}
.oppli-close svg{width:16px;height:16px}

/* Body */
.oppli-sheet main{padding:16px}
.oppli-section-title{
  font-size:14px;
  font-weight:700;
  color:#3A3A3A;
  margin-bottom:10px;
}
.oppli-label{display:block;font-size:13px;font-weight:600;color:#6b7280;margin:0 0 8px}

/* Segmented control */
.oppli-mode{
  display:inline-flex;
  border:1px solid #e5e7eb;
  border-radius:10px;
  overflow:hidden;
  margin:0 0 16px;
}
.oppli-mode button{
  appearance:none;background:#f8fafc;border:none;color:#3A3A3A;
  padding:8px 12px;font-size:13px;font-weight:600;cursor:pointer;min-width:150px
}
.oppli-mode button + button{border-left:1px solid #e5e7eb}
.oppli-mode button.active{background:#00B4D8;color:#fff}

/* Inputs */
.oppli-select,.oppli-input{
  width:100%;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;font-size:15px;background:#fff;margin-top:6px
}
.oppli-select{min-height:46px}

/* Manual block spacing */
.oppli-manual-wrap{padding:12px;border:1px solid #eef2f7;border-radius:12px;background:#fafcff}
.oppli-manual-wrap .oppli-input{margin-top:12px}

/* Error line */
.oppli-error{
  display:none;align-items:flex-start;gap:6px;color:#d72638;font-size:12.5px;margin-top:8px
}
.oppli-error svg{width:14px;height:14px;flex:0 0 14px}

/* Actions */
.oppli-actions{display:flex;justify-content:flex-end;gap:12px;padding:14px 16px;border-top:1px solid #eee}
.oppli-btn{border:1px solid #e5e7eb;background:#f8fafc;border-radius:10px;padding:12px 20px;font-size:16px;font-weight:700;cursor:pointer}
.oppli-btn.primary{background:#00B4D8;border-color:#00B4D8;color:#fff}
.oppli-btn.primary:hover{background:#009AC0;border-color:#009AC0}
.oppli-btn.cancel{background:#fff;color:#3A3A3A}
`;
    if (document.head) {
      document.head.appendChild(s);
    } else {
      // Fallback: wait for head to be available
      const waitForHead = () => {
        if (document.head) {
          document.head.appendChild(s);
        } else {
          setTimeout(waitForHead, 10);
        }
      };
      waitForHead();
    }
  }

  const hasOptions = Array.isArray(options) && options.length > 0;
  const tidyDisplayCompany = s => String(s||"").replace(/\s*[•·|/].*$/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  const optionsHtml = (hasOptions ? options : []).map((o, i) => {
    const label = `${o.role} — ${tidyDisplayCompany(o.company)}`;
    return `<option value="${i}">${escapeHtml(label)}</option>`;
  }).join("");

  const el = document.createElement("div");
  el.className = "oppli-sheet";
  el.id = "oppli-contact-picker";
  el.innerHTML = `
    <header>
      <div class="oppli-head-left">
        <svg viewBox="0 0 100 100" role="img" aria-label="Oppli">
          <rect x="10" y="10" width="80" height="80" rx="16" ry="16" fill="#00CED1"></rect>
          <path d="M25 50l15 15 35-35" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
        <span>Save to Oppli</span>
      </div>
      <button class="oppli-close" id="oppli-pick-close" aria-label="Close">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M18.3 5.7a1 1 0 0 0-1.4-1.4L12 9.17 7.1 4.3A1 1 0 1 0 5.7 5.7L10.6 10.6 5.7 15.5a1 1 0 1 0 1.4 1.4L12 12.03l4.9 4.87a1 1 0 0 0 1.4-1.4l-4.86-4.9 4.86-4.9Z"/>
        </svg>
      </button>
    </header>

    <main>
      <div class="oppli-section-title">
        Choose how you'd like to set Role & Company for ${personName ? escapeHtml(personName) : "this contact"}
      </div>

      <!-- Segmented control -->
      <div class="oppli-mode">
        <button type="button" id="mode-select" class="${hasOptions ? "active" : ""}">Select from profile</button>
        <button type="button" id="mode-manual" class="${hasOptions ? "" : "active"}">Enter manually</button>
      </div>

      <!-- SELECT BLOCK -->
      <section id="oppli-block-select" ${hasOptions ? "" : "style='display:none'"} >
        <label class="oppli-label" for="oppli-pick-select">Role — Company</label>
        <select class="oppli-select" id="oppli-pick-select">
          ${optionsHtml || `<option>(No experience entries found)</option>`}
        </select>
        <div class="oppli-error" id="oppli-select-error">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 15h2v2h-2zm0-8h2v6h-2z"/></svg>
          <span>There was an error. Please choose an item or switch to manual.</span>
        </div>
      </section>

      <!-- MANUAL BLOCK -->
      <section class="${hasOptions ? "hidden" : ""}" id="oppli-block-manual">
        <div class="oppli-manual-wrap">
          <label class="oppli-label" for="oppli-pick-company">Company</label>
          <input class="oppli-input" id="oppli-pick-company" placeholder="Company">
          <label class="oppli-label" for="oppli-pick-role" style="margin-top:12px">Role / Title</label>
          <input class="oppli-input" id="oppli-pick-role" placeholder="Role / Title">
          <div class="oppli-error" id="oppli-manual-error">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 15h2v2h-2zm0-8h2v6h-2z"/></svg>
            <span>Please enter at least a company or a role.</span>
          </div>
        </div>
      </section>
    </main>

    <div class="oppli-actions">
      <button class="oppli-btn cancel" id="oppli-pick-cancel">Cancel</button>
      <button class="oppli-btn primary" id="oppli-pick-save">Save Contact</button>
    </div>
  `;
  document.body.appendChild(el);

  // --- refs
  const $ = sel => el.querySelector(sel);
  const selectBlock = $("#oppli-block-select");
  const manualBlock = $("#oppli-block-manual");
  const selectEl    = $("#oppli-pick-select");
  const compEl      = $("#oppli-pick-company");
  const roleEl      = $("#oppli-pick-role");
  const btnSelect   = $("#mode-select");
  const btnManual   = $("#mode-manual");
  const errSelect   = $("#oppli-select-error");
  const errManual   = $("#oppli-manual-error");

  // --- mode toggle
  function setMode(mode){
    const isManual = mode === "manual";
    btnSelect.classList.toggle("active", !isManual);
    btnManual.classList.toggle("active", isManual);
    selectBlock.style.display = isManual ? "none" : "";
    manualBlock.classList.toggle("hidden", !isManual);
    // clear errors on switch
    errSelect.style.display = "none";
    errManual.style.display = "none";
    if (isManual) (compEl.value ? roleEl : compEl).focus();
    else if (hasOptions) selectEl.focus();
  }
  setMode(hasOptions ? "select" : "manual");
  btnSelect.onclick = () => setMode("select");
  btnManual.onclick = () => setMode("manual");

  // --- keyboard helpers
  const onKeyDown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); cleanup(); resolver(null); }
    if (e.key === "Enter" && el.contains(document.activeElement)) {
      e.preventDefault(); $("#oppli-pick-save").click();
    }
  };
  document.addEventListener("keydown", onKeyDown);

  function cleanup(){
    document.removeEventListener("keydown", onKeyDown);
    el.remove();
  }

  let resolver;
  const p = new Promise(res => { resolver = res; });

  $("#oppli-pick-close").onclick  =
  $("#oppli-pick-cancel").onclick = () => { cleanup(); resolver(null); };

  $("#oppli-pick-save").onclick = () => {
    const isManual = btnManual.classList.contains("active");
    errSelect.style.display = "none";
    errManual.style.display = "none";

    if (!isManual) {
      if (!hasOptions || !selectEl || selectEl.selectedIndex < 0) {
        errSelect.style.display = "flex";
        return;
      }
      const idx = parseInt(selectEl.value, 10);
      const picked = options[idx];
      cleanup();
      resolver({ company: picked.company, role: picked.role });
      return;
    }

    // manual validation
    const company = (compEl.value || "").trim();
    const role    = (roleEl.value || "").trim();
    if (!company && !role) {
      errManual.style.display = "flex";
      [compEl, roleEl].forEach(x => { x.style.transition="transform .08s"; x.style.transform="translateX(2px)"; setTimeout(()=>x.style.transform="",120); });
      return;
    }

    cleanup();
    resolver({ company, role });
  };

  return p;
}



// Prefer Experience section -> first company link (usually current)
// fallbacks: top-card company link, or guess from headline ("… at ACME")
function getCurrentCompany(){
  // 1) Experience section (new + old variants)
  const exp =
    document.querySelector("section#experience") ||
    document.querySelector("section[aria-label='Experience']") ||
    document.querySelector("section[data-view-name*='profile-section-experience']");

  if (exp) {
    // first company anchor inside experience list
    const as = exp.querySelectorAll("a[href*='/company/']");
    for (const a of as) {
      let txt = visibleText(a);
      if (!txt) {
        const hid = a.querySelector("[aria-hidden='true'], span");
        txt = visibleText(hid);
      }
      txt = cleanCompany(txt);
      if (txt) return txt;
    }
  }

  // 2) Top card company link (sometimes present)
  const topCardCompany = cleanCompany(
    visibleText(document.querySelector(".pv-text-details__left-panel a[href*='/company/'], .pv-top-card a[href*='/company/']"))
  );
  if (topCardCompany) return topCardCompany;

  // 3) Guess from headline ("@ ACME" / "at ACME")
  const guess = guessCompanyFromTitle(getHeadline());
  return cleanCompany(guess || "");
}



// --- 2) Insert the button right beside "More"
function insertOppliProfileButton(onClick){
  // no duplicates
  if (document.querySelector('.oppli-cta[data-scope="profile"]')) return true;
  if (!isProfile()) return false;

  // --- 1) Try to anchor to an existing top action (More / Message / Connect)
  const find = (sel) => document.querySelector(sel);

  // "More" has a very consistent id/aria on LI
  const moreBtn =
    find("button[id$='profile-overflow-action']") ||
    [...document.querySelectorAll("button[aria-label]")].find(b =>
      /(^|\s)more( actions| options)?(\s|$)/i.test(b.getAttribute("aria-label")||"")
    ) ||
    [...document.querySelectorAll("button, a")].find(b =>
      /(^|\s)more(\s|$)/i.test((b.innerText||b.textContent||"").trim())
    );

  const messageBtn =
    [...document.querySelectorAll("button[aria-label], a[aria-label], button, a")].find(b =>
      /message/i.test(b.getAttribute("aria-label")||"") ||
      /^message$/i.test((b.innerText||b.textContent||"").trim())
    );

  const connectBtn =
    [...document.querySelectorAll("button[aria-label], button, a")].find(b =>
      /connect/i.test(b.getAttribute("aria-label")||"") ||
      /^connect$/i.test((b.innerText||b.textContent||"").trim())
    );

  // build button without innerHTML (avoids LI sanitizer)
  const btn = makeOppliButton(onClick);
  btn.dataset.scope = "profile";

  // little wrapper to behave like native items (harmless if class unknown)
  const wrap = document.createElement("div");
  wrap.className = "pvs-profile-actions__action";
  wrap.style.display = "inline-flex";
  wrap.style.alignItems = "center";
  wrap.style.marginLeft = "8px";
  wrap.appendChild(btn);

  const anchor = moreBtn || messageBtn || connectBtn;
  if (anchor && anchor.parentElement) {
    anchor.parentElement.insertBefore(wrap, moreBtn ? anchor.nextSibling : anchor);
    console.log("[Oppli] Inserted next to", anchor);
    return true;
  }

  // --- 2) Fallback: inject into the top-card container
  const topCard =
    document.querySelector("section.pv-top-card") ||
    document.querySelector("[data-view-name='profile-header']") ||
    document.querySelector("#profile-content") ||
    document.querySelector("main");

  if (topCard) {
    const rail = document.createElement("div");
    rail.style.display = "flex";
    rail.style.gap = "8px";
    rail.style.margin = "8px 0";
    rail.appendChild(wrap);
    topCard.appendChild(rail);
    console.log("[Oppli] Appended into top-card", topCard);
    return true;
  }

  // --- 3) Last resort: floating button so you can SEE it no matter what
  if (!document.getElementById("oppli-float-profile")) {
    const flo = document.createElement("div");
    flo.id = "oppli-float-profile";
    flo.className = "oppli-float";
    flo.appendChild(makeOppliButton(onClick));
    document.body.appendChild(flo);
    console.log("[Oppli] Showing floating button (fallback).");
  }
  return true;
}

  // ------- JOB injection (with mutation watcher) -------
  let lastJobKey = "";
  const getJobKeyFromUrl = () => {
    const m = location.href.match(/jobs\/view\/(\d+)/);
    if (m) return m[1];
    const u = new URL(location.href);
    return u.searchParams.get("currentJobId") || u.searchParams.get("jobId") || "";
  };

  function tryInjectProfileButton(){
      if (!/linkedin\.com\/in\//.test(location.href)) return;
    
      const onClick = async () => {
        const personName = getProfileName();
        const options    = await scrapeExperienceOptions();
        const choice     = await showContactPicker(personName, options);
        if (!choice) return;
    
        const resp = await chrome.runtime.sendMessage({
          type: "saveContact",
          payload: {
            companyName: (choice.company || "").trim(),
            companyLogoUrl: "",                 // optional if you have one
            name: personName || "",
            role: (choice.role || "").trim(),
            linkedInUrl: location.href
          }
        });

        if (resp && resp.ok) {
          toast("Saved contact to Oppli");
        } else {
          toast("Error saving contact to Oppli");
          console.error("[Oppli] saveContact error:", resp?.error);
        }
      };
    
      // mount once + keep watching
      mountProfileButton(onClick);
      startProfileWatcher(onClick);
    }

    function mountProfileButton(onClick) {
      // if present already, done
      if (document.querySelector('.oppli-cta[data-scope="profile"]')) return true;
      if (!/linkedin\.com\/in\//.test(location.href)) return false;
    
      console.log('[Oppli] Attempting to inject button...');
    
      // Create the button first
      const btn = makeOppliButton(onClick);
      const wrap = document.createElement('div');
      wrap.className = 'pvs-profile-actions__action';
      wrap.style.cssText = 'display:inline-flex;align-items:center;margin-left:8px';
      wrap.appendChild(btn);
    
      // Strategy 1: Direct targeting of Message and More buttons
      const messageBtn = Array.from(document.querySelectorAll('button, a[role="button"]')).find(el => 
        /message/i.test(el.innerText || el.textContent || '') ||
        /message/i.test(el.getAttribute('aria-label') || '')
      );
      
      const moreBtn = Array.from(document.querySelectorAll('button, a[role="button"]')).find(el => 
        /more/i.test(el.innerText || el.textContent || '') ||
        /more/i.test(el.getAttribute('aria-label') || '')
      );
    
      console.log('[Oppli] Found Message button:', !!messageBtn);
      console.log('[Oppli] Found More button:', !!moreBtn);
    
      // Try to insert next to Message button first, then More button
      const targetBtn = messageBtn || moreBtn;
      if (targetBtn && targetBtn.parentElement) {
        targetBtn.parentElement.insertBefore(wrap, targetBtn.nextSibling);
        console.log('[Oppli] Successfully inserted next to:', targetBtn.innerText || targetBtn.textContent);
        return true;
      }
    
      // Strategy 2: Look for any container with Message and More buttons
      const allButtons = Array.from(document.querySelectorAll('button, a[role="button"]'));
      const messageAndMoreContainer = allButtons.find(btn => {
        const text = (btn.innerText || btn.textContent || '').toLowerCase();
        return /message|more/.test(text);
      })?.parentElement;
    
      if (messageAndMoreContainer) {
        // Find the last button in this container
        const buttonsInContainer = messageAndMoreContainer.querySelectorAll('button, a[role="button"]');
        const lastButton = buttonsInContainer[buttonsInContainer.length - 1];
        
        if (lastButton) {
          lastButton.parentElement.insertBefore(wrap, lastButton.nextSibling);
          console.log('[Oppli] Inserted in message/more container');
          return true;
        }
      }
    
      // Strategy 3: Look for any div that contains both Message and More buttons
      const containers = Array.from(document.querySelectorAll('div'));
      const actionContainer = containers.find(container => {
        const buttons = container.querySelectorAll('button, a[role="button"]');
        const buttonTexts = Array.from(buttons).map(btn => 
          (btn.innerText || btn.textContent || '').toLowerCase()
        );
        return buttonTexts.some(text => /message/.test(text)) && 
               buttonTexts.some(text => /more/.test(text));
      });
    
      if (actionContainer) {
        const buttons = actionContainer.querySelectorAll('button, a[role="button"]');
        const lastButton = buttons[buttons.length - 1];
        
        if (lastButton) {
          lastButton.parentElement.insertBefore(wrap, lastButton.nextSibling);
          console.log('[Oppli] Inserted in action container with Message and More');
          return true;
        }
      }
    
      // Strategy 4: Force insert into the top card area
      const topCard = 
        document.querySelector('section.pv-top-card') ||
        document.querySelector('[data-view-name="profile-header"]') ||
        document.querySelector('#profile-content') ||
        document.querySelector('main');
    
      if (topCard) {
        // Look for any existing button container in the top card
        const existingButtons = topCard.querySelectorAll('button, a[role="button"]');
        if (existingButtons.length > 0) {
          const lastExistingButton = existingButtons[existingButtons.length - 1];
          lastExistingButton.parentElement.insertBefore(wrap, lastExistingButton.nextSibling);
          console.log('[Oppli] Force inserted in top card next to existing button');
          return true;
        }
        
        // If no existing buttons, create a new container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display:flex;gap:8px;margin:8px 0;align-items:center';
        buttonContainer.appendChild(wrap);
        topCard.appendChild(buttonContainer);
        console.log('[Oppli] Created new button container in top card');
        return true;
      }
    
      // Strategy 5: Last resort - floating button
      console.log('[Oppli] All strategies failed, using floating button');
      return forceFloatProfileButton(onClick);
    }
    
    
    
    function startProfileWatcher(onClick){
      if (window.__oppliProfileObs) return;
    
      // Try immediately (in case DOM is already there)
      console.log('[Oppli] Starting profile button injection...');
      if (!mountProfileButton(onClick)) {
        // If nothing mounted yet, at least show the floating probe
        console.log('[Oppli] Primary injection failed, showing floating button');
        forceFloatProfileButton(onClick);
      }
    
      // Add retry mechanism
      let retryCount = 0;
      const maxRetries = 5;
      
      const obs = new MutationObserver(() => {
        if (!/linkedin\.com\/in\//.test(location.href)) return;
        
        // Check if button is already present
        if (document.querySelector('.oppli-cta[data-scope="profile"]')) {
          retryCount = 0; // Reset retry count if button is found
          return;
        }
        
        retryCount++;
        console.log(`[Oppli] Retry ${retryCount}/${maxRetries} - attempting to inject button`);
        
        if (!mountProfileButton(onClick)) {
          if (retryCount >= maxRetries) {
            console.log('[Oppli] Max retries reached, ensuring floating button is visible');
            forceFloatProfileButton(onClick);
          }
        } else {
          retryCount = 0; // Reset on success
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      window.__oppliProfileObs = obs;
      
      // Also ensure floating button is always available as backup
      setTimeout(() => {
        if (!document.querySelector('.oppli-cta[data-scope="profile"]')) {
          console.log('[Oppli] Ensuring floating button is available as backup');
          forceFloatProfileButton(onClick);
        }
      }, 2000);
    }
    
    
    

  // Continuous watcher: LinkedIn swaps the right pane without URL changes
  function watchJobPane(){
      if (window.__oppliJobObs || typeof tryInjectJobButton !== 'function') return;
      const target = document.querySelector('#artdeco-main') || document.querySelector('main') || document.body;
      if (!target) {
        console.log('[Oppli] ⚠️ No target found for job observer, skipping');
        return;
      }
      const handler = throttle(() => { try { tryInjectJobButton(); } catch(e){ console.debug('[Oppli] jobs injector:', e); } }, 300);
      const obs = new MutationObserver(handler);
      obs.observe(target, { childList: true, subtree: true });
      window.__oppliJobObs = obs;
    }


    
    
    
    
// ---- FAST BOOT + SPA URL HOOKS ----
function onReady(fn){
  if (document.readyState === "complete" || document.readyState === "interactive") {
    fn();
  } else {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  }
}

// Fire boot ASAP (document_start) and again when DOM is ready
onReady(() => boot());
setTimeout(() => boot(), 0);

// React to LinkedIn SPA navigations (pushState / replaceState / back/forward)
(function hookHistory(){
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  function trigger(){ 
    if (location.href !== lastUrl) { lastUrl = location.href; boot(); }
  }
  history.pushState = function(){ const r = origPush.apply(this, arguments); trigger(); return r; };
  history.replaceState = function(){ const r = origReplace.apply(this, arguments); trigger(); return r; };
  window.addEventListener("popstate", trigger);
})();


// Returns clean [{company, role, dateText, isCurrent}, ...]
// Returns clean [{company, role, dateText, isCurrent}, ...]
// Returns clean [{company, role, dateText, isCurrent}, ...]
async function scrapeExperienceOptions(){
  await ensureExperienceMounted();
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

  // pick a root that actually has rows
  const candidates = [
    document.querySelector("section[aria-label='Experience']"),
    document.querySelector("section[data-view-name*='experience']"),
    document.querySelector("#experience")?.closest("section"),
    document.querySelector(".scaffold-layout__detail"),
    Array.from(document.querySelectorAll("div,section")).find(n => /experience/i.test((n.querySelector("h2,h3")?.innerText || "")))
  ].filter(Boolean);

  let root = document;
  for (const c of candidates){
    if (c && c.querySelector("div.pvs-entity, li.pvs-entity, li.pvs-list__item, li.pvs-list__paged-list-item, li.artdeco-list__item")) {
      root = c; break;
    }
  }

  // 1) Expand ALL obvious "Show X roles" toggles (multi-pass for virtualization)
  for (let pass=0; pass<3; pass++){
    const toggles = root.querySelectorAll(
      "button[aria-expanded='false'], " +
      "button[aria-label*='Show' i], " +
      "button.pvs-entity__toggle-details-button, " +
      "a[aria-label*='Show' i]"
    );
    if (!toggles.length) break;
    toggles.forEach(b => b.click());
    await sleep(400);
  }

  const items = [];

  const dateOf = (el) => _clean(
    el.querySelector(".t-14.t-normal.t-black--light span[aria-hidden='true']")?.innerText ||
    el.querySelector(".pv-entity__date-range span:nth-child(2)")?.innerText ||
    el.querySelector(".t-14.t-normal.t-black--light")?.innerText || ""
  );

  const roleOfRow = (row) => {
    let n =
      row.querySelector(".t-bold span[aria-hidden='true']") ||
      row.querySelector(".mr1.t-bold span[aria-hidden='true']") ||
      row.querySelector("[data-field='experience_position_title']") ||
      row.querySelector(".pv-entity__summary-info h3 span:nth-child(2)") ||
      row.querySelector(".pv-entity__summary-info h3") ||
      row.querySelector(".t-bold");
    let r = _clean(n?.innerText || n?.textContent || "");
    if (r.includes("—")) r = r.split("—")[0].trim();
    if (r.includes("·")) r = r.split("·")[0].trim();
    if (!r || r.startsWith("—")) r = "";
    return r;
  };

  // helper: push item if valid (drops "Role — Role" accidents)
    const pushItem = async (company, role, holderEl) => {
    company = companyDisplayOnly(company || "");
    role = (role || "").trim();
    if (!role || !company) return;

    const norm = s => String(s).toLowerCase().replace(/\W+/g, "");
    if (norm(company) === norm(role)) return;                 // skip duplicates like "Product Manager — Product Manager"
    if (isDateish(company) || (typeof isEmploymentTypeish==='function' && isEmploymentTypeish(company))) return;

    const dateText = dateOf(holderEl);
    const isCurrent = /present|current/i.test(dateText);
  
  // Extract company logo
  let logoDataUrl = '';
  let logoType = '';
  
  try {
    const logoElement = holderEl.querySelector('img[alt*="logo"]') ||
                      holderEl.querySelector('img[src*="company"]') ||
                      holderEl.querySelector('.experience-logo img') ||
                      holderEl.querySelector('img');
    
    if (logoElement && logoElement.src && !logoElement.src.includes('data:image/gif')) {
      try {
        // Convert logo to data URL
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        logoDataUrl = await new Promise((resolve) => {
          img.onload = () => {
            try {
              canvas.width = img.naturalWidth || 100;
              canvas.height = img.naturalHeight || 100;
              ctx.drawImage(img, 0, 0);
              const dataUrl = canvas.toDataURL('image/png');
              resolve(dataUrl);
            } catch (canvasError) {
              console.log('[Oppli] ⚠️ Canvas error for', company, ':', canvasError);
              resolve('');
            }
          };
          img.onerror = () => resolve('');
          img.crossOrigin = 'anonymous';
          img.src = logoElement.src;
        });
        
        logoType = 'image/png';
        console.log('[Oppli] ✅ Logo extracted for', company, '- Size:', logoDataUrl.length, 'Preview:', logoDataUrl.substring(0, 50) + '...');
      } catch (logoError) {
        console.log('[Oppli] ⚠️ Could not extract logo for', company, ':', logoError.message);
      }
    }
  } catch (logoExtractionError) {
    console.log('[Oppli] ⚠️ Logo extraction error for', company, ':', logoExtractionError);
  }
  
  items.push({ company, role, dateText, isCurrent, logoDataUrl, logoType });
  };

  // 2) Iterate cards; handle grouped and single
  const cards = root.querySelectorAll("div.pvs-entity, li.pvs-entity, [data-view-name='profile-component-entity']");
  for (const card of cards){
    const headerCompany = headerCompanyOf(card);  // strict parent-company getter
    let sub = card.querySelector(":scope .pvs-entity__sub-components, :scope ul.pvs-list");

    // preferred child rows API
    let childRows = sub ? sub.querySelectorAll(":scope li.pvs-list__item, :scope li.pvs-list__paged-list-item, :scope li.artdeco-list__item") : [];

    // If it looks grouped but we still have <2 rows, try one more local expand
    if (sub && childRows.length < 2) {
      const localToggle =
        card.querySelector(":scope button[aria-expanded='false']") ||
        card.querySelector(":scope button[aria-label*='Show' i]") ||
        card.querySelector(":scope .pvs-entity__toggle-details-button") ||
        card.querySelector(":scope a[aria-label*='Show' i]");
      if (localToggle) {
        localToggle.click();
        await sleep(450);
        sub = card.querySelector(":scope .pvs-entity__sub-components, :scope ul.pvs-list");
        childRows = sub ? sub.querySelectorAll(":scope li.pvs-list__item, :scope li.pvs-list__paged-list-item, :scope li.artdeco-list__item") : [];
      }
    }

    if (childRows.length >= 2) {
      // GROUPED COMPANY with explicit rows → always use parent company
      for (const row of childRows){
        const role = roleOfRow(row);
        let company = headerCompany || ""; // force parent
        if (!company) {
          // ultra-defensive fallback if parent missing
          let tryRow = headerCompanyOf(row) || (extractRoleCompany(row)?.company || "");
          tryRow = companyDisplayOnly(tryRow || "");
          if (!tryRow || isDateish(tryRow) || (typeof isEmploymentTypeish==='function' && isEmploymentTypeish(tryRow))) tryRow = "";
          company = tryRow;
        }
      await pushItem(company, role, row);
      }

      // do NOT add a parent summary option

    } else {
      // Either a SINGLE row card, or a GROUPED card rendered without <li> items.

      // First try: normal single-row extraction.
      const rc = extractRoleCompany ? extractRoleCompany(card) : { role:"", company:"" };
      if (rc.role && rc.company && !isDateish(rc.company) && (!isEmploymentTypeish || !isEmploymentTypeish(rc.company))) {
      await pushItem(rc.company, rc.role, card);
        continue;
      }

      // Fallback for "grouped but no <li>" — scan role headlines inside the card
      const roleNodes = card.querySelectorAll(
        ":scope .pvs-entity__sub-components [data-field='experience_position_title'], " +
        ":scope .pvs-entity__sub-components .t-bold, " +
        ":scope ul.pvs-list [data-field='experience_position_title'], " +
        ":scope ul.pvs-list .t-bold"
      );

      if (roleNodes.length >= 2) {
        const company = headerCompany || companyDisplayOnly(rc.company || "");
      for (const n of roleNodes) {
          const holder = n.closest("li") || n.closest(".pvs-list__item") || n.closest(".artdeco-list__item") || n;
          const role = roleOfRow(holder);
        await pushItem(company, role, holder);
      }
      } else if (rc.role && headerCompany) {
        // As a last resort, attach the parent company to the single role we got
      await pushItem(headerCompany, rc.role, card);
      }
    }
  }

  // 3) Stray rows not inside a card (avoid duplicates)
  const strayRows = root.querySelectorAll("li.pvs-list__item, li.pvs-list__paged-list-item, li.artdeco-list__item");
  for (const li of strayRows){
    if (li.closest(".pvs-entity__sub-components, ul.pvs-list")?.closest("div.pvs-entity, li.pvs-entity")) continue;
    const rc = extractRoleCompany ? extractRoleCompany(li) : { role:"", company:"" };
    if (rc.role && rc.company && !isDateish(rc.company) && (!isEmploymentTypeish || !isEmploymentTypeish(rc.company))) {
    await pushItem(rc.company, rc.role, li);
    }
  }

  // Dedupe + current-first
  const seen = new Set();
  const unique = [];
  for (const it of items){
    const key = (it.company + "||" + it.role).toLowerCase();
    if (!seen.has(key)) { seen.add(key); unique.push(it); }
  }
  unique.sort((a,b) => (b.isCurrent?1:0) - (a.isCurrent?1:0));

// Debug: Log what experience options were found
console.log('[Oppli] 🔍 Experience scraping results:', {
  totalItems: items.length,
  uniqueItems: unique.length,
  itemsWithLogos: unique.filter(item => item.logoDataUrl).length
});

unique.forEach((item, idx) => {
  console.log(`[Oppli] 📋 Experience ${idx + 1}:`, {
    company: item.company,
    role: item.role,
    hasLogo: !!item.logoDataUrl,
    logoSize: item.logoDataUrl?.length || 0,
    isCurrent: item.isCurrent
  });
});

  return unique.slice(0, 20);
}


    
  
// Show a single picker; resolves to {company, role} or null on cancel
// Branded picker with top-mode toggle: "Select from profile" OR "Enter manually"
// Resolves to { company, role } or null on cancel
function showContactPicker(personName, options){
// remove any previous modal
document.getElementById("oppli-contact-picker")?.remove();

// one-time styles
if (!document.getElementById("oppli-picker-style")) {
  const s = document.createElement("style");
  s.id = "oppli-picker-style";
  s.textContent = `
/* helpers */
.hidden{display:none!important;}
.oppli-sheet{overflow:visible;} /* prevent select clipping */

/* Header */
.oppli-sheet header{
position:relative;
background:linear-gradient(90deg,#002B5B,#007F7F);
color:#fff;
border-bottom:none;
padding:14px 16px;
}
.oppli-head-left{
display:flex;
align-items:center;
gap:10px;
font-weight:800;
font-size:16px;
}
.oppli-head-left svg{width:22px;height:22px}

/* Close "X" */
.oppli-close{
position:absolute;
top:8px; right:8px;
background:transparent;border:none;color:#fff;cursor:pointer;
display:inline-flex;align-items:center;justify-content:center;
width:32px;height:32px;border-radius:8px;opacity:.9
}
.oppli-close:hover{opacity:1;background:rgba(255,255,255,.08)}
.oppli-close svg{width:16px;height:16px}

/* Body */
.oppli-sheet main{padding:16px}
.oppli-section-title{
font-size:14px;
font-weight:700;
color:#3A3A3A;
margin-bottom:10px;
}
.oppli-label{display:block;font-size:13px;font-weight:600;color:#6b7280;margin:0 0 8px}

/* Segmented control */
.oppli-mode{
display:inline-flex;
border:1px solid #e5e7eb;
border-radius:10px;
overflow:hidden;
margin:0 0 16px;
}
.oppli-mode button{
appearance:none;background:#f8fafc;border:none;color:#3A3A3A;
padding:8px 12px;font-size:13px;font-weight:600;cursor:pointer;min-width:150px
}
.oppli-mode button + button{border-left:1px solid #e5e7eb}
.oppli-mode button.active{background:#00B4D8;color:#fff}

/* Inputs */
.oppli-select,.oppli-input{
width:100%;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;font-size:15px;background:#fff;margin-top:6px
}
.oppli-select{min-height:46px}

/* Manual block spacing */
.oppli-manual-wrap{padding:12px;border:1px solid #eef2f7;border-radius:12px;background:#fafcff}
.oppli-manual-wrap .oppli-input{margin-top:12px}

/* Error line */
.oppli-error{
display:none;align-items:flex-start;gap:6px;color:#d72638;font-size:12.5px;margin-top:8px
}
.oppli-error svg{width:14px;height:14px;flex:0 0 14px}

/* Actions */
.oppli-actions{display:flex;justify-content:flex-end;gap:12px;padding:14px 16px;border-top:1px solid #eee}
.oppli-btn{border:1px solid #e5e7eb;background:#f8fafc;border-radius:10px;padding:12px 20px;font-size:16px;font-weight:700;cursor:pointer}
.oppli-btn.primary{background:#00B4D8;border-color:#00B4D8;color:#fff}
.oppli-btn.primary:hover{background:#009AC0;border-color:#009AC0}
.oppli-btn.cancel{background:#fff;color:#3A3A3A}
`;
  if (document.head) {
    document.head.appendChild(s);
  } else {
    // Fallback: wait for head to be available
    const waitForHead = () => {
      if (document.head) {
        document.head.appendChild(s);
      } else {
        setTimeout(waitForHead, 10);
      }
    };
    waitForHead();
  }
}

const hasOptions = Array.isArray(options) && options.length > 0;
const tidyDisplayCompany = s => String(s||"").replace(/\s*[•·|/].*$/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
const optionsHtml = (hasOptions ? options : []).map((o, i) => {
  const label = `${o.role} — ${tidyDisplayCompany(o.company)}${o.logoDataUrl ? ' 🖼️' : ''}`;
  return `<option value="${i}">${escapeHtml(label)}</option>`;
}).join("");

const el = document.createElement("div");
el.className = "oppli-sheet";
el.id = "oppli-contact-picker";
el.innerHTML = `
  <header>
    <div class="oppli-head-left">
      <svg viewBox="0 0 100 100" role="img" aria-label="Oppli">
        <rect x="10" y="10" width="80" height="80" rx="16" ry="16" fill="#00CED1"></rect>
        <path d="M25 50l15 15 35-35" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
      <span>Save to Oppli</span>
    </div>
    <button class="oppli-close" id="oppli-pick-close" aria-label="Close">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M18.3 5.7a1 1 0 0 0-1.4-1.4L12 9.17 7.1 4.3A1 1 0 1 0 5.7 5.7L10.6 10.6 5.7 15.5a1 1 0 1 0 1.4 1.4L12 12.03l4.9 4.87a1 1 0 0 0 1.4-1.4l-4.86-4.9 4.86-4.9Z"/>
      </svg>
    </button>
  </header>

  <main>
    <div class="oppli-section-title">
      Choose how you'd like to set Role & Company for ${personName ? escapeHtml(personName) : "this contact"}
    </div>

    <!-- Segmented control -->
    <div class="oppli-mode">
      <button type="button" id="mode-select" class="${hasOptions ? "active" : ""}">Select from profile</button>
      <button type="button" id="mode-manual" class="${hasOptions ? "" : "active"}">Enter manually</button>
    </div>

    <!-- SELECT BLOCK -->
    <section id="oppli-block-select" ${hasOptions ? "" : "style='display:none'"} >
      <label class="oppli-label" for="oppli-pick-select">Role — Company</label>
      <select class="oppli-select" id="oppli-pick-select">
        ${optionsHtml || `<option>(No experience entries found)</option>`}
      </select>
      <div class="oppli-error" id="oppli-select-error">
        <svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 15h2v2h-2zm0-8h2v6h-2z"/></svg>
        <span>There was an error. Please choose an item or switch to manual.</span>
      </div>
    </section>

    <!-- MANUAL BLOCK -->
    <section class="${hasOptions ? "hidden" : ""}" id="oppli-block-manual">
      <div class="oppli-manual-wrap">
        <label class="oppli-label" for="oppli-pick-company">Company</label>
        <input class="oppli-input" id="oppli-pick-company" placeholder="Company">
        <label class="oppli-label" for="oppli-pick-role" style="margin-top:12px">Role / Title</label>
        <input class="oppli-input" id="oppli-pick-role" placeholder="Role / Title">
        <div class="oppli-error" id="oppli-manual-error">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 15h2v2h-2zm0-8h2v6h-2z"/></svg>
          <span>Please enter at least a company or a role.</span>
        </div>
      </div>
    </section>
  </main>

  <div class="oppli-actions">
    <button class="oppli-btn cancel" id="oppli-pick-cancel">Cancel</button>
    <button class="oppli-btn primary" id="oppli-pick-save">Save Contact</button>
  </div>
`;
document.body.appendChild(el);

// --- refs
const $ = sel => el.querySelector(sel);
const selectBlock = $("#oppli-block-select");
const manualBlock = $("#oppli-block-manual");
const selectEl    = $("#oppli-pick-select");
const compEl      = $("#oppli-pick-company");
const roleEl      = $("#oppli-pick-role");
const btnSelect   = $("#mode-select");
const btnManual   = $("#mode-manual");
const errSelect   = $("#oppli-select-error");
const errManual   = $("#oppli-manual-error");

// Return promise for user interaction
return new Promise((resolve) => {
  // Mode switching
  btnSelect.addEventListener('click', () => {
    btnSelect.classList.add('active');
    btnManual.classList.remove('active');
    selectBlock.style.display = '';
    manualBlock.classList.add('hidden');
    errSelect.style.display = 'none';
    errManual.style.display = 'none';
  });

  btnManual.addEventListener('click', () => {
    btnManual.classList.add('active');
    btnSelect.classList.remove('active');
    selectBlock.style.display = 'none';
    manualBlock.classList.remove('hidden');
    errSelect.style.display = 'none';
    errManual.style.display = 'none';
  });

  // Close handlers
  $("#oppli-pick-close").addEventListener('click', () => {
    el.remove();
    resolve(null);
  });

  // Cancel handler
  $("#oppli-pick-cancel").addEventListener('click', () => {
    el.remove();
    resolve(null);
  });

  // Save handler
  $("#oppli-pick-save").addEventListener('click', () => {
    errSelect.style.display = 'none';
    errManual.style.display = 'none';

    const isSelectMode = btnSelect.classList.contains('active');
    
    if (isSelectMode) {
      const selectedIndex = selectEl.value;
      if (!selectedIndex || !options[parseInt(selectedIndex)]) {
        errSelect.style.display = 'flex';
        return;
      }
      
      const selectedOption = options[parseInt(selectedIndex)];
      console.log('[Oppli] ✅ Selected from dropdown:', {
        company: selectedOption.company,
        role: selectedOption.role,
        hasLogo: !!selectedOption.logoDataUrl,
        logoType: selectedOption.logoType
      });
      
      el.remove();
      resolve({
        company: selectedOption.company,
        role: selectedOption.role,
        logoDataUrl: selectedOption.logoDataUrl,
        logoType: selectedOption.logoType
      });
    } else {
      // Manual mode
      const company = compEl.value.trim();
      const role = roleEl.value.trim();
      
      if (!company && !role) {
        errManual.style.display = 'flex';
        return;
      }
      
      console.log('[Oppli] ℹ️ Manual entry - no logo data');
      el.remove();
      resolve({ company, role });
    }
  });
});
}
    
  // ------- boot + URL watcher -------
  function boot(){
      if (isProfile()) {
        // Create the real onClick handler
        const onClick = async () => {
          const personName = getProfileName();
        console.log('[Oppli] 🔍 Starting experience scraping for contact save...');
          const options    = await scrapeExperienceOptions();
        console.log('[Oppli] 🔍 Experience scraping completed, showing picker...');
          const choice     = await showContactPicker(personName, options);
          if (!choice) return;
    
        console.log('[Oppli] 🔍 Contact choice selected:', {
          company: choice.company,
          role: choice.role,
          hasLogo: !!choice.logoDataUrl,
          logoSize: choice.logoDataUrl?.length || 0,
          logoType: choice.logoType
        });
  
        const payload = {
              companyName: (choice.company || "").trim(),
          logoDataUrl: choice.logoDataUrl || "",     // Include logo data from experience
          logoType: choice.logoType || "",           // Include logo type
              name: personName || "",
              role: (choice.role || "").trim(),
              linkedInUrl: location.href
        };
        
        console.log('[Oppli] 📤 Sending to background.js:', {
          type: 'saveContact',
          companyName: payload.companyName,
          hasLogoData: !!payload.logoDataUrl,
          logoDataSize: payload.logoDataUrl?.length || 0,
          logoType: payload.logoType
        });
  
        const resp = await chrome.runtime.sendMessage({
          type: "saveContact",
          payload: payload
          });

          if (resp && resp.ok) {
            toast("Saved contact to Oppli");
          } else {
            toast("Error saving contact to Oppli");
            console.error("[Oppli] saveContact error:", resp?.error);
          }
        };
        
      // Use our new hybrid system instead of the old robust injector
        const injector = createRobustButtonInjector(onClick);
      injector.start(); // This will now use our hybrid approach
      }
      if (isJob()) {
        console.log('[Oppli] 🎯 Job page detected, starting job functionality...');
        watchJobPane();          // guarded in the function itself
        // Also try immediate injection
        setTimeout(() => {
          console.log('[Oppli] Trying immediate job injection...');
          tryInjectJobButton();
        }, 500);
      } else {
        console.log('[Oppli] ⚠️ Not a job page, skipping job functionality');
      }
    }
    
    // Job button injection function
    function tryInjectJobButton() {
        console.log('[Oppli] === JOB BUTTON INJECTION ===');
        
        // Remove any existing job buttons
        const existingButtons = document.querySelectorAll('.oppli-cta[data-scope="job"]');
        existingButtons.forEach(btn => btn.remove());
        console.log('[Oppli] Removed', existingButtons.length, 'existing job buttons');
        
        // Look for the job action buttons container - multiple strategies
        const jobActionsContainer = 
            document.querySelector('.jobs-unified-top-card__content--two-pane .jobs-unified-top-card__actions') ||
            document.querySelector('.jobs-unified-top-card__actions') ||
            document.querySelector('[data-job-id] .jobs-unified-top-card__actions') ||
            document.querySelector('.jobs-box__group--actions') ||
            document.querySelector('.job-details-jobs-unified-top-card_sticky-buttons-container') ||
            document.querySelector('.jobs-unified-top-card__content--two-pane') ||
            document.querySelector('.jobs-unified-top-card');
        
        console.log('[Oppli] Job actions container found:', !!jobActionsContainer);
        if (jobActionsContainer) {
            console.log('[Oppli] 🔍 Container classes:', jobActionsContainer.className);
            console.log('[Oppli] 🔍 Container HTML preview:', jobActionsContainer.outerHTML.substring(0, 300) + '...');
        }
        
        if (jobActionsContainer) {
            console.log('[Oppli] Found job actions container, looking for action buttons...');
            
            // Look for existing action buttons (Apply, Save, etc.)
            const actionButtons = jobActionsContainer.querySelectorAll('button, a[role="button"]');
            console.log('[Oppli] Found', actionButtons.length, 'action buttons in container');
            
            actionButtons.forEach((btn, i) => {
                const text = (btn.innerText || btn.textContent || '').trim();
                console.log(`[Oppli] Action button ${i}: "${text}"`);
            });
            
            // Create the job button
            const jobButton = makeOppliButton(async () => {
                await saveJobToOppli();
            });
            jobButton.setAttribute('data-scope', 'job');
            
            // Add vertical alignment to match other buttons
            jobButton.style.marginTop = '8px';
            jobButton.style.marginBottom = '4px';
            jobButton.style.marginLeft = '8px';
            
            // Debug: Check current button order
            const currentButtons = jobActionsContainer.querySelectorAll('button, a[role="button"]');
            console.log('[Oppli] 🔍 Current buttons before insertion:', currentButtons.length);
            currentButtons.forEach((btn, i) => {
                const text = (btn.innerText || btn.textContent || '').trim();
                console.log(`[Oppli] 🔍 Button ${i}: "${text}"`);
            });
            
            // Always insert as the last button in the container (rightmost position)
            console.log('[Oppli] Inserting Save to Oppli as the last button in container');
            jobActionsContainer.appendChild(jobButton);
            
            // Debug: Check final button order
            setTimeout(() => {
                const finalButtons = jobActionsContainer.querySelectorAll('button, a[role="button"]');
                console.log('[Oppli] 🔍 Final buttons after insertion:', finalButtons.length);
                finalButtons.forEach((btn, i) => {
                    const text = (btn.innerText || btn.textContent || '').trim();
                    console.log(`[Oppli] 🔍 Final button ${i}: "${text}"`);
                });
            }, 100);
            
            console.log('[Oppli] Successfully injected job button');
            return true;
        }
        
        // Fallback: look for any container with Apply/Save buttons
        console.log('[Oppli] Primary container not found, trying fallback...');
        const allButtons = document.querySelectorAll('button, a[role="button"]');
        const jobActionButtons = [];
        
        allButtons.forEach(button => {
            const text = (button.innerText || button.textContent || '').trim().toLowerCase();
            if (text.includes('apply') || text.includes('save')) {
                const rect = button.getBoundingClientRect();
                // Make sure it's in the main content area (not sidebar)
                if (rect.top > 100 && rect.left > 100 && rect.left < window.innerWidth * 0.8) {
                    jobActionButtons.push({ button, text, rect });
                }
            }
        });
        
        // Find the container that has both Apply and Save buttons
        const containersWithMultipleButtons = new Map();
        jobActionButtons.forEach(({ button }) => {
            const container = button.parentElement;
            if (container) {
                const containerKey = container.className || 'no-class';
                if (!containersWithMultipleButtons.has(containerKey)) {
                    containersWithMultipleButtons.set(containerKey, []);
                }
                containersWithMultipleButtons.get(containerKey).push(button);
            }
        });
        
        console.log('[Oppli] 🔍 Containers with multiple buttons:', containersWithMultipleButtons.size);
        for (const [className, buttons] of containersWithMultipleButtons) {
            console.log('[Oppli] 🔍 Container:', className, 'Buttons:', buttons.length);
            buttons.forEach(btn => {
                const text = (btn.innerText || btn.textContent || '').trim();
                console.log('[Oppli] 🔍   - Button:', text);
            });
        }
        
        console.log('[Oppli] Found', jobActionButtons.length, 'job action buttons in fallback search');
        
        if (jobActionButtons.length > 0) {
            // Find the best container to inject into (prefer containers with multiple buttons)
            let targetContainer = null;
            let targetButton = null;
            
            // First, try to find a container with both Apply and Save buttons
            for (const [className, buttons] of containersWithMultipleButtons) {
                if (buttons.length >= 2) {
                    targetContainer = buttons[0].parentElement;
                    targetButton = buttons[buttons.length - 1]; // Use the last button as reference
                    console.log('[Oppli] 🔍 Fallback: Found container with multiple buttons:', className);
                    break;
                }
            }
            
            // If no container with multiple buttons, prefer the Save button's container
            if (!targetContainer) {
                // Look for the Save button specifically
                const saveButton = jobActionButtons.find(({ text }) => text.includes('save'))?.button;
                if (saveButton) {
                    targetButton = saveButton;
                    targetContainer = saveButton.parentElement;
                    console.log('[Oppli] 🔍 Fallback: Using Save button container');
                } else {
                    // Fallback to first button
                    targetButton = jobActionButtons[0].button;
                    targetContainer = targetButton.parentElement;
                    console.log('[Oppli] 🔍 Fallback: Using first button container');
                }
            }
            
            console.log('[Oppli] 🔍 Fallback: Target button text:', (targetButton.innerText || targetButton.textContent || '').trim());
            console.log('[Oppli] 🔍 Fallback: Target container classes:', targetContainer?.className);
            
            const jobButton = makeOppliButton(async () => {
                console.log('[Oppli] 🎯 Job button clicked, starting save process...');
                await saveJobToOppli();
            });
            jobButton.setAttribute('data-scope', 'job');
            console.log('[Oppli] 🔍 Job button created with scope:', jobButton.getAttribute('data-scope'));
            
            // Add vertical alignment to match other buttons (same as primary injection)
            jobButton.style.marginTop = '8px';
            jobButton.style.marginBottom = '4px';
            jobButton.style.marginLeft = '8px';
            
            if (targetContainer) {
                // Debug: Check current button order in fallback
                const currentButtons = targetContainer.querySelectorAll('button, a[role="button"]');
                console.log('[Oppli] 🔍 Fallback: Current buttons before insertion:', currentButtons.length);
                currentButtons.forEach((btn, i) => {
                    const text = (btn.innerText || btn.textContent || '').trim();
                    console.log(`[Oppli] 🔍 Fallback: Button ${i}: "${text}"`);
                });
                
                // Insert as the last button in the container
                targetContainer.appendChild(jobButton);
                console.log('[Oppli] Successfully injected job button via fallback as last button');
                
                // Debug: Check final button order in fallback
                setTimeout(() => {
                    const finalButtons = targetContainer.querySelectorAll('button, a[role="button"]');
                    console.log('[Oppli] 🔍 Fallback: Final buttons after insertion:', finalButtons.length);
                    finalButtons.forEach((btn, i) => {
                        const text = (btn.innerText || btn.textContent || '').trim();
                        console.log(`[Oppli] 🔍 Fallback: Final button ${i}: "${text}"`);
                    });
                }, 100);
                
                return true;
            }
        }
        
        console.log('[Oppli] Job button injection failed');
        return false;
    }
    
    // Save job to Oppli
    async function saveJobToOppli() {
        try {
            console.log('[Oppli] 🚀 Starting job save process...');
            console.log('[Oppli] Current URL:', location.href);
            console.log('[Oppli] Is job page?', isJob());
            
            // Validate we're on a job page
            if (!isJob()) {
                console.error('[Oppli] ❌ Not on a job page, cannot save job');
                toast('Please navigate to a job page to save jobs');
                return;
            }
            
            // Scrape job data
            console.log('[Oppli] 📋 Attempting to scrape job data...');
            const jobData = await scrapeJobData();
            console.log('[Oppli] 📊 Scraped job data:', jobData);
            
            if (!jobData) {
                console.error('[Oppli] ❌ No job data returned from scraping');
                toast('Could not extract job information');
                return;
            }
            
            // Validate required fields - be more lenient
            if (!jobData.title) {
                console.error('[Oppli] ❌ Missing job title');
                toast('Could not extract job title');
                console.log('[Oppli] Missing job title:', jobData);
                return;
            }
            
            console.log('[Oppli] ✅ Job data validation passed');
            
            // Use companyName if available, otherwise fall back to company
            const companyToProcess = jobData.companyName || jobData.company || "";
            
            // Get company logo URL if available and convert to data URL
            let companyLogoUrl = "";
            let logoDataUrl = "";
            let logoType = null; // Declare logoType in the correct scope
            
          // Find the specific job container to get the correct logo
          const currentJobId = location.href.match(/currentJobId=(\d+)/)?.[1];
          const jobContainer = document.querySelector(`[data-job-id="${currentJobId}"]`) ||
                             document.querySelector(`[data-entity-urn*="${currentJobId}"]`) ||
                             document.querySelector(`[data-entity-urn*="job-${currentJobId}"]`);
          
          console.log('[Oppli] 🔍 Looking for logo in job container:', !!jobContainer);
          if (jobContainer) {
            console.log('[Oppli] 🔍 Job container classes:', jobContainer.className);
          }
          
          // Look for logo within the specific job container first, then fallback to document-wide search
          let logoImg = null;
          
          // First, try to find logo within the specific job container
          if (jobContainer) {
            console.log('[Oppli] 🔍 Searching for logo within specific job container...');
            
            // Try specific selectors in order of preference
            const containerSelectors = [
              'img[alt*="logo" i]',
              'img[alt*="company" i]',
              'img[alt*="organization" i]',
              '.job-card-container__company-logo img',
              '.job-card-container__company-name img',
              '.job-card-container__subtitle img',
              '.artdeco-entity-lockup__image img',
              'img[src*="media.licdn.com"]' // LinkedIn media URLs
            ];
            
                             for (const selector of containerSelectors) {
               const found = jobContainer.querySelector(selector);
               if (found && found.src && !found.src.includes('data:') && 
                   found.offsetWidth > 0 && found.offsetHeight > 0) { // Avoid data URLs and hidden images
                 logoImg = found;
                 console.log('[Oppli] ✅ Found logo in job container with selector:', selector);
                 console.log('[Oppli] ✅ Logo dimensions:', found.offsetWidth, 'x', found.offsetHeight);
                 break;
               }
             }
          }
          
          // If not found in specific container, fallback to document-wide search
          if (!logoImg) {
            console.log('[Oppli] 🔍 Logo not found in specific container, trying document-wide search...');
            
            const documentSelectors = [
              '.jobs-unified-top-card img',
              '[data-test-id="company-logo"] img',
              '.jobs-unified-top-card__company-logo img',
              '.artdeco-entity-lockup__image img',
              '.job-card-container__company-logo img',
              '.job-card-container__company-name img',
              '.job-card-container__subtitle img',
              'img[alt*="logo" i]',
              'img[alt*="company" i]',
              'img[alt*="organization" i]'
            ];
            
                             for (const selector of documentSelectors) {
               const found = document.querySelector(selector);
               if (found && found.src && !found.src.includes('data:') && 
                   found.offsetWidth > 0 && found.offsetHeight > 0) { // Avoid data URLs and hidden images
                 logoImg = found;
                 console.log('[Oppli] ⚠️ Found logo with document-wide selector:', selector);
                 console.log('[Oppli] ⚠️ Logo dimensions:', found.offsetWidth, 'x', found.offsetHeight);
                 break;
               }
             }
          }

            if (logoImg && logoImg.src) {
              companyLogoUrl = logoImg.src;
              console.log('[Oppli] 🖼️ Found company logo:', companyLogoUrl);
            console.log('[Oppli] 🖼️ Logo found in container:', jobContainer ? 'Specific job container' : 'Document-wide search');
            console.log('[Oppli] 🖼️ Logo alt text:', logoImg.alt || 'No alt text');
            console.log('[Oppli] 🖼️ Logo parent classes:', logoImg.parentElement?.className || 'No parent');
            
            // Additional verification: check if the logo is associated with the correct company
            const logoContainer = logoImg.closest('[data-job-id], .job-card-container, .jobs-unified-top-card');
            if (logoContainer && jobContainer && logoContainer !== jobContainer) {
              console.log('[Oppli] ⚠️ Warning: Logo found in different container than job data');
              console.log('[Oppli] ⚠️ Job container:', jobContainer.className);
              console.log('[Oppli] ⚠️ Logo container:', logoContainer.className);
            }
              
              // Convert logo to data URL for storage
              try {
                const response = await fetch(logoImg.src);
                const blob = await response.blob();
                logoDataUrl = await new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result);
                  reader.readAsDataURL(blob);
                });
                console.log('[Oppli] 🖼️ Converted logo to data URL');
                
                // Detect actual format from data URL
                if (logoDataUrl.startsWith('data:image/jpeg')) {
                  logoType = 'image/jpeg';
                } else if (logoDataUrl.startsWith('data:image/png')) {
                  logoType = 'image/png';
                } else if (logoDataUrl.startsWith('data:image/webp')) {
                  logoType = 'image/webp';
                } else {
                  logoType = 'image/jpeg'; // fallback
                }
                console.log('[Oppli] 🖼️ Detected logo type:', logoType);
              } catch (error) {
                console.error('[Oppli] ❌ Error converting logo to data URL:', error);
              }
            }
            
            console.log('[Oppli] 🔍 DEBUG: Final job data being sent:', {
              title: jobData.title || "Unknown Job",
              companyName: companyToProcess || "Unknown Company",
              location: jobData.location || "",
              sourceUrl: jobData.url || location.href,
              notes: jobData.description || "",
              logoDataUrl: logoDataUrl ? '✅ Present' : '❌ Missing',
              logoType: logoType
            });
            
            // Log the actual logo data being sent
            console.log('[Oppli] 🖼️ Logo data details:', {
              logoImgFound: !!logoImg,
              logoImgSrc: logoImg?.src,
              logoDataUrlLength: logoDataUrl?.length || 0,
              logoType: logoType
            });
            
            const resp = await chrome.runtime.sendMessage({
              type: "saveJob",
              payload: {
                title: jobData.title || "Unknown Job",
                companyName: companyToProcess || "Unknown Company",
                location: jobData.location || "",
                sourceUrl: jobData.url || location.href,
                notes: jobData.description || "",
                companyLogoUrl,
                logoDataUrl,
                logoType: logoType
              }
            });

            if (resp && resp.ok) {
              console.log('[Oppli] ✅ Job saved successfully!');
              toast("Job saved to Oppli!");
            } else {
              console.error('[Oppli] 💥 Error saving job:', resp?.error);
              toast("Error saving job to Oppli");
            }
            
            // Only refresh the Inspector if it's already open (don't auto-open it)
            if (document.getElementById('oppli-inspector')) {
                window.__oppliRenderInspector && window.__oppliRenderInspector();
            }
            
        } catch (error) {
            console.error('[Oppli] 💥 Error saving job:', error);
            console.error('[Oppli] Error stack:', error.stack);
            toast('Error saving job to Oppli');
        }
    }
    
    // Scrape job data from the page - using the working functions
    async function scrapeJobData() {
        try {
            console.log('[Oppli] 🔍 Starting job data scraping with working functions...');
            console.log('[Oppli] Current URL:', location.href);
            
            // Get the current job ID from URL
            const currentJobId = location.href.match(/currentJobId=(\d+)/)?.[1];
            console.log('[Oppli] 🔍 Current job ID from URL:', currentJobId);
            
            if (!currentJobId) {
                console.log('[Oppli] ❌ No job ID found in URL');
                return null;
            }
            
            // Find the main job content - be more specific to avoid job list cards
            let topCard = null;
            
            // First, try to find the job container that matches the current job ID
            const jobContainer = document.querySelector(`[data-job-id="${currentJobId}"]`) ||
                               document.querySelector(`[data-entity-urn*="${currentJobId}"]`) ||
                               document.querySelector(`[data-entity-urn*="job-${currentJobId}"]`);
            
            if (jobContainer) {
                console.log('[Oppli] 🎯 Found job container with ID:', currentJobId);
                console.log('[Oppli] Job container classes:', jobContainer.className);
                
                // Look for the job content within this specific container
                const jobContent = jobContainer.querySelector('.jobs-unified-top-card__content') ||
                                 jobContainer.querySelector('.jobs-unified-top-card__header') ||
                                 jobContainer.querySelector('.job-card-container__content') ||
                                 jobContainer;
                
                if (jobContent) {
                    topCard = jobContent;
                    console.log('[Oppli] 🎯 Using job-specific content container');
                }
            }
            
            // If we still don't have a topCard, try the main job area
            if (!topCard) {
                console.log('[Oppli] ⚠️ No job-specific container found, trying main job area...');
                topCard = document.querySelector('.jobs-unified-top-card__content') ||
                         document.querySelector('.jobs-unified-top-card') ||
                         document.querySelector('.jobs-details-top-card') ||
                         document.querySelector('main');
            }
            
            console.log('[Oppli] 🎯 Top card element found:', !!topCard);
            if (topCard) {
                console.log('[Oppli] Top card classes:', topCard.className);
                console.log('[Oppli] Top card HTML preview:', topCard.outerHTML.substring(0, 300) + '...');
            }
            
            if (!topCard) {
                console.log('[Oppli] ❌ No top card found');
                return null;
            }
            
            // Use the working scrapeJobDom function
            console.log('[Oppli] 📋 Calling scrapeJobDom function...');
            const jobData = scrapeJobDom(topCard);
            console.log('[Oppli] 📊 scrapeJobDom returned:', jobData);
            
            // If we still got "Unknown Job", try a more direct approach
            if (!jobData.title || jobData.title === 'Unknown Job') {
                console.log('[Oppli] ⚠️ Title not found, trying direct selectors...');
                
                // Try to find the job title directly
                const titleSelectors = [
                    'h1[data-test-job-title]',
                    'h1.jobs-unified-top-card__job-title',
                    'h1.top-card-layout__title',
                    '.jobs-details-top-card__job-title',
                    'h1',
                    '.jobs-unified-top-card__job-title',
                    '.jobs-unified-top-card__title'
                ];
                
                for (const selector of titleSelectors) {
                    const titleEl = document.querySelector(selector);
                    if (titleEl && titleEl.innerText.trim()) {
                        jobData.title = titleEl.innerText.trim();
                        console.log('[Oppli] ✅ Found title with selector:', selector, jobData.title);
                        break;
                    }
                }
                
                // Try to find company name directly - be more precise to avoid wrong companies
                console.log('[Oppli] 🔍 Looking for company name with precise selectors...');
                
                // Since we're in a job list view, we need to look within the specific job card
                const jobCard = document.querySelector(`[data-job-id="${currentJobId}"]`);
                console.log('[Oppli] 🔍 Looking for job card with ID:', currentJobId);
                console.log('[Oppli] 🔍 Job card found:', !!jobCard);
                
                if (jobCard) {
                    console.log('[Oppli] 🎯 Found specific job card for company search');
                    console.log('[Oppli] 🔍 Job card element:', jobCard);
                    console.log('[Oppli] 🔍 Job card HTML preview:', jobCard.outerHTML.substring(0, 200));
                    
                    // FLEXIBLE APPROACH: Find company name by analyzing all company links in the job card
                    console.log('[Oppli] 🔍 Using flexible company extraction approach...');
                    
                    // Get all company links within this job card
                    const companyLinks = jobCard.querySelectorAll('a[href*="/company/"], a[href*="/school/"]');
                    console.log('[Oppli] 🔍 Found', companyLinks.length, 'company links in job card');
                    
                    // Analyze each company link to find the best candidate
                    for (const link of companyLinks) {
                        const companyText = link.innerText.trim();
                        console.log('[Oppli] 🔍 Analyzing company link:', companyText, '| URL:', link.href);
                        
                        // Skip empty, generic, or non-company text
                        if (companyText && 
                            companyText.length > 2 && 
                            companyText.length < 100 &&
                            !/^(logo|apply|save|share|remote|hybrid|full-time|part-time|contract|show more|view all|learn more|see all)$/i.test(companyText) &&
                            !companyText.includes('logo') &&
                            !companyText.includes('Logo') &&
                            !companyText.includes('Show more') &&
                            !companyText.includes('View all') &&
                            !companyText.includes('Learn more') &&
                            !companyText.includes('See all') &&
                            // Must be a company URL
                            (link.href.includes('/company/') || link.href.includes('/school/'))) {
                            
                            jobData.companyName = companyText;
                            console.log('[Oppli] ✅ Company name extracted (flexible):', companyText);
                            break;
                        }
                    }
                    
                    // If no company found in links, try to find any text that looks like a company name
                    if (!jobData.companyName) {
                        console.log('[Oppli] 🔍 No company links found, trying text analysis...');
                        console.log('[Oppli] 🔍 Current jobData.companyName:', jobData.companyName);
                        
                        // Get all text content from the job card
                        const cardText = jobCard.innerText || jobCard.textContent || '';
                        const lines = cardText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                        
                        console.log('[Oppli] 🔍 Job card text lines:', lines.slice(0, 10));
                        
                        // Look for lines that might be company names
                        for (const line of lines) {
                            if (line.length > 3 && line.length < 50 && 
                                !/^(logo|apply|save|share|remote|hybrid|full-time|part-time|contract|show more|view all|learn more|see all|product manager|founder|analyst|engineer|developer|designer|marketing|sales|hr|finance|operations|business|strategy|consultant|manager|director|executive|ceo|cto|cfo|vp|senior|junior|lead|principal|staff|associate|intern|trainee|apprentice|freelance|contractor|consultant|advisor|specialist|coordinator|supervisor|administrator|assistant|representative|agent|officer|clerk|technician|analyst|researcher|scientist|architect|planner|coordinator|facilitator|liaison|ambassador|advocate|champion|expert|guru|ninja|rockstar|wizard|hero|star|pro|master|senior|junior|lead|principal|staff|associate|intern|trainee|apprentice|freelance|contractor|consultant|advisor|specialist|coordinator|supervisor|administrator|assistant|representative|agent|officer|clerk|technician|analyst|researcher|scientist|architect|planner|coordinator|facilitator|liaison|ambassador|advocate|champion|expert|guru|ninja|rockstar|wizard|hero|star|pro|master)$/i.test(line) &&
                                !line.includes('logo') &&
                                !line.includes('Logo') &&
                                !line.includes('Show more') &&
                                !line.includes('View all') &&
                                !line.includes('Learn more') &&
                                !line.includes('See all') &&
                                // Must contain at least one letter
                                /[a-zA-Z]/.test(line)) {
                                
                                jobData.companyName = line;
                                console.log('[Oppli] ✅ Company name extracted (text analysis):', line);
                                break;
                            }
                        }
                    }
                    
                    // If still no company found, try to extract from logo alt text
                    if (!jobData.companyName) {
                        console.log('[Oppli] 🔍 No company found in text, trying logo alt text...');
                        
                        // Look for logo with company name in alt text
                        const logoImg = jobCard.querySelector('img[alt*="logo" i]');
                        if (logoImg && logoImg.alt) {
                            const altText = logoImg.alt.trim();
                            console.log('[Oppli] 🔍 Logo alt text:', altText);
                            
                            // Extract company name from alt text (e.g., "Coople UK logo" -> "Coople UK")
                            const companyMatch = altText.match(/^(.+?)\s+logo$/i);
                            if (companyMatch && companyMatch[1]) {
                                const companyName = companyMatch[1].trim();
                                if (companyName.length > 2 && companyName.length < 100) {
                                    jobData.companyName = companyName;
                                    console.log('[Oppli] ✅ Company name extracted from logo alt text:', companyName);
                                }
                            }
                        }
                    }
                } else {
                    console.log('[Oppli] ❌ No job card found for company extraction');
                }
                
                console.log('[Oppli] 🔍 Company extraction completed. Final companyName:', jobData.companyName);
                
                // If still no company found in the job card, try the main job area
                if (!jobData.companyName || jobData.companyName === 'MANUAL') {
                    console.log('[Oppli] ⚠️ No company found in job card, trying main job area...');
                    
                    const mainJobContainer = document.querySelector('.jobs-unified-top-card') ||
                                           document.querySelector('.jobs-details-top-card') ||
                                           document.querySelector('main');
                    
                    if (mainJobContainer) {
                        console.log('[Oppli] 🎯 Found main job container:', mainJobContainer.className);
                        
                        // FLEXIBLE APPROACH: Find company name by analyzing all company links in the main container
                        console.log('[Oppli] 🔍 Using flexible company extraction in main container...');
                        
                        // Get all company links within the main job container
                        const companyLinks = mainJobContainer.querySelectorAll('a[href*="/company/"], a[href*="/school/"]');
                        console.log('[Oppli] 🔍 Found', companyLinks.length, 'company links in main container');
                        
                        // Analyze each company link to find the best candidate
                        for (const link of companyLinks) {
                            const companyText = link.innerText.trim();
                            console.log('[Oppli] 🔍 Analyzing main container company link:', companyText, '| URL:', link.href);
                            
                            // Skip empty, generic, or non-company text
                            if (companyText && 
                                companyText.length > 2 && 
                                companyText.length < 100 &&
                                !/^(logo|apply|save|share|remote|hybrid|full-time|part-time|contract|show more|view all|learn more|see all)$/i.test(companyText) &&
                                !companyText.includes('logo') &&
                                !companyText.includes('Logo') &&
                                !companyText.includes('Show more') &&
                                !companyText.includes('View all') &&
                                !companyText.includes('Learn more') &&
                                !companyText.includes('See all') &&
                                // Must be a company URL
                                (link.href.includes('/company/') || link.href.includes('/school/'))) {
                                
                                jobData.companyName = companyText;
                                console.log('[Oppli] ✅ Company name extracted from main container (flexible):', companyText);
                                break;
                            }
                        }
                    }
                }
                
                // If still no company found, try a different approach
                if (!jobData.companyName || jobData.companyName === 'MANUAL') {
                    console.log('[Oppli] ⚠️ No company found in main container, trying alternative approach...');
                    
                    // Look for company name near the job title
                    const titleElement = document.querySelector('h1[data-test-job-title]') ||
                                       document.querySelector('h1.jobs-unified-top-card__job-title') ||
                                       document.querySelector('h1');
                    
                    if (titleElement) {
                        // Look for company name in the next few elements after the title
                        let currentElement = titleElement.nextElementSibling;
                        let attempts = 0;
                        
                        while (currentElement && attempts < 5) {
                            // Look for company links in this element
                            const companyLink = currentElement.querySelector('a[href*="/company/"]') ||
                                              currentElement.querySelector('a[href*="/school/"]');
                            
                            if (companyLink && companyLink.innerText.trim()) {
                                const companyText = companyLink.innerText.trim();
                                if (companyText.length > 2 && !/^(logo|apply|save|share)$/i.test(companyText)) {
                                    jobData.companyName = companyText;
                                    console.log('[Oppli] ✅ Found company near title:', companyText);
                                    break;
                                }
                            }
                            
                            currentElement = currentElement.nextElementSibling;
                            attempts++;
                        }
                    }
                }
                
                // Final fallback - if still no company, try to extract from URL
                if (!jobData.companyName || jobData.companyName === 'MANUAL') {
                    console.log('[Oppli] ⚠️ Still no company found, trying aggressive search...');
                    
                    // Look for any company link that might be the right one
                    const allCompanyLinks = document.querySelectorAll('a[href*="/company/"]');
                    for (const link of allCompanyLinks) {
                        const text = link.innerText.trim();
                        if (text && text.length > 2 && !/^(logo|apply|save|share|MANUAL)$/i.test(text)) {
                            // Check if this link is close to the job title
                            const titleElement = document.querySelector('h1');
                            if (titleElement) {
                                const distance = Math.abs(link.getBoundingClientRect().top - titleElement.getBoundingClientRect().top);
                                if (distance < 200) { // Within 200px of title
                                    jobData.companyName = text;
                                    console.log('[Oppli] ✅ Found company by proximity to title:', text);
                                    break;
                                }
                            }
                        }
                    }
                    
                    // If still no company, try to extract from the job card's text content
                    if (!jobData.companyName || jobData.companyName === 'MANUAL') {
                        console.log('[Oppli] ⚠️ Trying to extract company from job card text...');
                        
                        if (jobCard) {
                            // Get all text content from the job card
                            const cardText = jobCard.innerText || jobCard.textContent || '';
                            console.log('[Oppli] 🔍 Job card text preview:', cardText.substring(0, 500));
                            
                            // Look for patterns that might indicate a company name
                            const lines = cardText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                            console.log('[Oppli] 🔍 Job card lines:', lines.slice(0, 10));
                            
                            // Look for lines that might be company names (not too short, not common words)
                            for (const line of lines) {
                                if (line.length > 3 && line.length < 50 && 
                                    !/^(logo|apply|save|share|remote|hybrid|full-time|part-time|contract|senior|manager|product|engineer|designer|analyst|specialist|coordinator|associate|junior|lead|principal|staff|director|vp|head|chief|executive|officer|president|ceo|cto|cfo|coo)$/i.test(line) &&
                                    !/^\d+$/.test(line) && // Not just numbers
                                    !/^[A-Za-z\s]+$/.test(line) || line.includes(' ') // Has spaces or special chars
                                    ) {
                                    // This might be a company name
                                    jobData.companyName = line;
                                    console.log('[Oppli] ✅ Extracted potential company name from text:', line);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            
            // Get the job URL
            let jobUrl = location.href;
            if (jobUrl.includes('currentJobId=')) {
                const jobIdMatch = jobUrl.match(/currentJobId=(\d+)/);
                if (jobIdMatch && jobIdMatch[1]) {
                    const jobId = jobIdMatch[1];
                    jobUrl = `https://www.linkedin.com/jobs/view/${jobId}/`;
                    console.log('[Oppli] 🔗 Extracted job ID:', jobId);
                    console.log('[Oppli] 🔗 Final job URL:', jobUrl);
                }
            }
            
            // Return the data in the expected format
            const finalData = {
                title: jobData.title || 'Unknown Job',
                company: jobData.companyName || 'Unknown Company',
                location: jobData.location || '',
                description: jobData.description || '',
                datePosted: '',
                salary: '',
                remote: false,
                jobType: '',
                url: jobUrl
            };
            
            console.log('[Oppli] 🎯 Final job data to return:', finalData);
            
            // Final validation: if we got wrong data, try one more aggressive approach
            if (finalData.company === 'Samsara' || finalData.company === 'PayPal' || finalData.company === 'MANUAL') {
                console.log('[Oppli] ⚠️ Detected wrong company data, trying aggressive fix...');
                
                // Look for any company link that's NOT from the job list
                const allCompanyLinks = document.querySelectorAll('a[href*="/company/"]');
                let foundCompany = null;
                
                for (const link of allCompanyLinks) {
                    const text = link.innerText.trim();
                    if (text && text.length > 2 && !/^(logo|apply|save|share|MANUAL|Samsara|PayPal)$/i.test(text)) {
                        // Check if this link is in the main job area (not the job list)
                        const rect = link.getBoundingClientRect();
                        const titleElement = document.querySelector('h1');
                        
                        if (titleElement) {
                            const titleRect = titleElement.getBoundingClientRect();
                            const distance = Math.abs(rect.top - titleRect.top);
                            
                            // If it's close to the title and not in the top job list area
                            if (distance < 300 && rect.top > 200) {
                                foundCompany = text;
                                console.log('[Oppli] ✅ Found company with aggressive search:', text);
                                break;
                            }
                        }
                    }
                }
                
                if (foundCompany) {
                    finalData.company = foundCompany;
                    console.log('[Oppli] 🔄 Updated company to:', foundCompany);
                }
            }
            
            return finalData;
            
        } catch (error) {
            console.error('[Oppli] 💥 Error scraping job data:', error);
            console.error('[Oppli] Error stack:', error.stack);
            return null;
        }
    }
    
    // Helper function: robust text getter (handles nested spans, aria-label, title)
    function visibleText(el) {
        if (!el) return "";
        // Prefer human-visible text
        let t = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
        if (t) return t;
        // Try common nested span used by LinkedIn
        const hid = el.querySelector("[aria-hidden='true'], [aria-hidden=true]");
        if (hid) {
            t = (hid.innerText || hid.textContent || "").replace(/\s+/g, " ").trim();
            if (t) return t;
        }
        // Fallback to aria-label / title
        return (el.getAttribute("aria-label") || el.getAttribute("title") || "").trim();
    }
    
    // Helper function: normalize location
    function normalizeLocation(raw) {
        if (!raw) return "";
        // Split on bullets or pipes, trim pieces
        let parts = raw.split(/·|\|/).map(s => s.trim()).filter(Boolean);
        if (!parts.length) parts = [raw.trim()];
        // Drop work-mode noise
        parts = parts.filter(p => !/remote|hybrid|on-?site|full-?time|part-?time|contract/i.test(p));
        // Heuristic: prefer the last token that looks like a place
        const place = parts.findLast
            ? parts.findLast(p => /,|United|Kingdom|USA|City|County|State|Province|Emirates/i.test(p) || p.split(/\s+/).length >= 2)
            : parts.reverse().find(p => /,|United|Kingdom|USA|City|County|State|Province|Emirates/i.test(p) || p.split(/\s+/).length >= 2);
        return (place || parts[0] || "").trim();
    }
    
    // Helper function: text extraction with multiple selectors
    function textIn(topCard, selectors, fullText = false) {
        for (const selector of selectors) {
            const el = topCard.querySelector(selector);
            if (el) {
                if (fullText) {
                    return (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
                } else {
                    return visibleText(el);
                }
            }
        }
        return "";
    }
    
    // Working scrapeJobDom function
    function scrapeJobDom(topCard) {
        // --- TITLE ---
        const title =
            textIn(topCard, [
                "h1[data-test-job-title]",
                "h1.jobs-unified-top-card__job-title",
                "h1.top-card-layout__title",
                ".jobs-details-top-card__job-title",
                "h1"
            ]) || "";

        // --- COMPANY ---
        let companyName = "";

        // FLEXIBLE APPROACH: Find company name by analyzing all company links
        console.log('[Oppli] 🔍 scrapeJobDom: Using flexible company extraction...');
        
        // Get all company links within the top card
        const companyLinks = topCard.querySelectorAll('a[href*="/company/"], a[href*="/school/"]');
        console.log('[Oppli] 🔍 scrapeJobDom: Found', companyLinks.length, 'company links');
        
        // Analyze each company link to find the best candidate
        for (const link of companyLinks) {
            const companyText = link.innerText.trim();
            console.log('[Oppli] 🔍 scrapeJobDom: Analyzing company link:', companyText, '| URL:', link.href);
            
            // Skip empty, generic, or non-company text
            if (companyText && 
                companyText.length > 2 && 
                companyText.length < 100 &&
                !/^(logo|apply|save|share|remote|hybrid|full-time|part-time|contract|show more|view all|learn more|see all)$/i.test(companyText) &&
                !companyText.includes('logo') &&
                !companyText.includes('Logo') &&
                !companyText.includes('Show more') &&
                !companyText.includes('View all') &&
                !companyText.includes('Learn more') &&
                !companyText.includes('See all') &&
                // Must be a company URL
                (link.href.includes('/company/') || link.href.includes('/school/'))) {
                
                companyName = companyText;
                console.log('[Oppli] ✅ scrapeJobDom: Company name extracted:', companyText);
                break;
            }
        }
        
        // If no company found in links, try to extract from logo alt text
        if (!companyName) {
            console.log('[Oppli] 🔍 scrapeJobDom: No company links found, trying logo alt text...');
            
            // Look for logo with company name in alt text
            const logoImg = topCard.querySelector('img[alt*="logo" i]');
            if (logoImg && logoImg.alt) {
                const altText = logoImg.alt.trim();
                console.log('[Oppli] 🔍 scrapeJobDom: Logo alt text:', altText);
                
                // Extract company name from alt text (e.g., "Coople UK logo" -> "Coople UK")
                const companyMatch = altText.match(/^(.+?)\s+logo$/i);
                if (companyMatch && companyMatch[1]) {
                    const extractedCompanyName = companyMatch[1].trim();
                    if (extractedCompanyName.length > 2 && extractedCompanyName.length < 100) {
                        companyName = extractedCompanyName;
                        console.log('[Oppli] ✅ scrapeJobDom: Company name extracted from logo alt text:', extractedCompanyName);
                    }
                }
            }
        }

        if (!companyName) companyName = "Unknown Company";

        // --- LOCATION ---
        let location =
            textIn(topCard, [
                "[data-test-meta-location]",
                "[data-test-job-details-location]",
                ".jobs-unified-top-card__primary-description li",
                ".jobs-unified-top-card__bullet",
                ".jobs-details-top-card__primary-description li",
                ".jobs-details-top-card__primary-description",
                ".topcard__flavor-row",
                // NEW: subtitle secondary often carries location in some UIs
                ".jobs-unified-top-card__subtitle-secondary-grouping li",
                ".jobs-unified-top-card__subtitle-secondary-grouping",
                "[data-test-details-subtitle] li",
                "[data-test-details-subtitle]"
            ]) || "";

        if (!location) {
            // parse "secondary subtitle" and drop Remote/Hybrid/On-site tokens
            const secondary = Array.from(topCard.querySelectorAll(
                ".jobs-unified-top-card__subtitle-secondary-grouping, [data-test-details-subtitle]"
            ))[0];
            if (secondary) {
                const tokens = (secondary.innerText || secondary.textContent || "")
                    .split("·")
                    .map(s => s.trim())
                    .filter(Boolean)
                    .filter(t => !/remote|hybrid|on-?site/i.test(t));
                if (tokens[0]) location = tokens[0];
            }
        }

        if (!location) {
            const lis = topCard.querySelectorAll(
                ".jobs-unified-top-card__primary-description li, .topcard__flavor-row li, .jobs-details-top-card__primary-description li"
            );
            if (lis.length) location = (lis[lis.length - 1].innerText || lis[lis.length - 1].textContent || "").trim();
        }

        // description/notes (best-effort)
        const description =
            textIn(topCard, [
                "[data-test-description]",
                "#job-details",
                ".jobs-description__container",
                ".description__text",
                ".jobs-box__html-content",
                ".jobs-description-content__text",
                ".jobs-box__content",
                ".jobs-description__content",
                ".jobs-box__description",
                ".jobs-unified-top-card__content .jobs-description",
                ".jobs-unified-top-card__content .jobs-box__html-content",
                ".jobs-unified-top-card__content .jobs-description-content__text",
                ".jobs-unified-top-card__content .jobs-box__content",
                ".jobs-unified-top-card__content .jobs-description__content",
                ".jobs-unified-top-card__content .jobs-box__description"
            ], true) || "";

        // DEBUG: see what we captured for your exact variant
        console.log("[Oppli] DOM scrape:", { title, companyName, location, description });

        return { title, companyName, location, description };
    }
    
    // Company logo capture function
    async function captureLogo(topCard, companyId, data) {
        console.log('[Oppli] 🖼️ Starting logo capture for company ID:', companyId);
        console.log('[Oppli] 🎯 Top card element:', topCard);
        
        // More specific logo selectors for the current job
        const logoSelectors = [
            // Job card specific selectors
            '.job-card-container__company-logo img',
            '.job-card-container__company-name img',
            '.job-card-container__subtitle img',
            // Main job view selectors
            '.jobs-unified-top-card__company-logo img',
            '.jobs-unified-top-card__company-name img',
            '.artdeco-entity-lockup__image img',
            // Generic but more specific
            'img[alt*="logo" i]',
            'img[alt*="company" i]',
            'img[alt*="organization" i]'
        ];
        
        let img = null;
        for (const selector of logoSelectors) {
            const foundImg = topCard.querySelector(selector);
            if (foundImg && foundImg.src) {
                console.log('[Oppli] 🎯 Found logo with selector:', selector);
                console.log('[Oppli] 🖼️ Logo src:', foundImg.src);
                console.log('[Oppli] 🖼️ Logo alt:', foundImg.alt);
                img = foundImg;
                break;
            }
        }
        
        if (!img || !img.src) {
            console.log('[Oppli] ⚠️ No logo found in topCard');
            return;
        }

        try {
            console.log('[Oppli] 🖼️ Fetching logo from:', img.src);
            const res = await fetch(img.src);
            const blob = await res.blob();
            console.log('[Oppli] 🖼️ Logo blob size:', blob.size, 'bytes, type:', blob.type);
            
            const dataUrl = await new Promise(r => {
                const fr = new FileReader();
                fr.onload = () => r(fr.result);
                fr.readAsDataURL(blob);
            });

            const id = `logo-${companyId}`;
            console.log('[Oppli] 🖼️ Logo ID:', id);
            
            // read existing images bucket
            const images = await new Promise(res =>
                chrome.storage.local.get("oppliImages", o => res(o.oppliImages || { logos: [] }))
            );
            images.logos = (images.logos || []).filter(l => l.id !== id);
            images.logos.push({ id, type: blob.type || "image/png", dataUrl });
            
            console.log('[Oppli] 🖼️ Total logos after save:', images.logos.length);

            // write bucket + connect company.logoId
            await new Promise(res => chrome.storage.local.set({ oppliImages: images }, res));
            const c = data.companies.find(c => c.id === companyId);
            if (c) {
                c.logoId = id;
                console.log('[Oppli] ✅ Logo connected to company:', c.name);
            }
            console.log('[Oppli] ✅ Logo capture completed successfully');
        } catch (e) {
            console.error("[Oppli] ❌ Logo capture failed:", e);
        }
    }
    
  let lastUrl = location.href;
  boot();
  setInterval(() => { 
    if (location.href !== lastUrl) { 
      console.log('[Oppli] URL changed, cleaning up and restarting...');
      cleanupOppliInjectors();
      lastUrl = location.href; 
      boot(); 
    } 
  }, 500);
  window.addEventListener('message', (e) => {
      if (e.source !== window) return;
      const msg = e.data && e.data.oppli;
      if (msg === 'dump') {
        chrome.storage.local.get('oppliData', ({oppliData}) => {
          console.log('[Oppli] dump:', oppliData);
          window.postMessage({ oppli: 'dump:done' }, '*');
        });
      }
      if (msg === 'clear') {
        chrome.storage.local.remove('oppliData', () => {
          console.log('[Oppli] cleared');
          window.postMessage({ oppli: 'clear:done' }, '*');
        });
      }
    });

    // === Oppli inline inspector (toggle: Alt+Shift+O) ===
(() => {
  if (window.__oppliInspectorInstalled) return;
  window.__oppliInspectorInstalled = true;

  const getData = () => new Promise(res => chrome.storage.local.get('oppliData', o => res(o.oppliData || { companies:[], jobs:[], contacts:[], chats:[], actions:[] })));

  function companyNameById(data, id){
    const c = data.companies.find(c => c.id === id);
    return c ? c.name : "";
  }
  function companyById(data, id){
    return data.companies.find(c => c.id === id) || {};
  }

  function ensureStyle(){
    if (document.getElementById('oppli-inspector-style')) return;
    const s = document.createElement('style');
    s.id = 'oppli-inspector-style';
    s.textContent = `
      #oppli-inspector{position:fixed;inset:auto 12px 12px auto;width:520px;max-height:70vh;overflow:auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);z-index:2147483647;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}
      #oppli-inspector header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #eee;position:sticky;top:0;background:#fff;}
      #oppli-inspector h1{font-size:14px;margin:0;font-weight:700}
      #oppli-inspector main{padding:10px 12px}
      #oppli-inspector table{width:100%;border-collapse:collapse;margin:8px 0}
      #oppli-inspector th,#oppli-inspector td{font-size:12px;border-bottom:1px solid #f1f5f9;padding:6px 4px;text-align:left;vertical-align:top}
      #oppli-inspector .muted{color:#64748b;font-size:12px}
      #oppli-inspector .btn{border:1px solid #e5e7eb;background:#f8fafc;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer}
      #oppli-inspector .row{display:flex;gap:8px;align-items:center}
    `;
    if (document.head) {
      document.head.appendChild(s);
    } else {
      // Fallback: wait for head to be available
      const waitForHead = () => {
        if (document.head) {
          document.head.appendChild(s);
        } else {
          setTimeout(waitForHead, 10);
        }
      };
      waitForHead();
    }
  }

  async function render(){
    ensureStyle();
    const data = await getData();
    
    // Get logo information
    const images = await new Promise(res => chrome.storage.local.get("oppliImages", o => res(o.oppliImages || { logos: [] })));
    let el = document.getElementById('oppli-inspector');
    if (!el){
      el = document.createElement('div');
      el.id = 'oppli-inspector';
      document.body.appendChild(el);
    }
    const lastJobs = [...data.jobs].slice(-5).reverse();
    const lastContacts = [...data.contacts].slice(-5).reverse();

    el.innerHTML = `
      <header>
        <h1>Oppli Inspector</h1>
        <div class="row">
          <span class="muted">${data.companies.length} companies • ${data.jobs.length} jobs • ${data.contacts.length} contacts</span>
          <button class="btn" id="oppli-refresh">Refresh</button>
          <button class="btn" id="oppli-clear">Clear</button>
          <button class="btn" id="oppli-debug">Debug</button>
          <button class="btn" id="oppli-close">Close</button>
        </div>
      </header>
      <main>
        <h3 style="margin:8px 0 4px;font-size:13px">Latest jobs</h3>
        <table>
          <thead><tr><th>Title</th><th>Company</th><th>Location</th><th>URL</th></tr></thead>
          <tbody>
            ${lastJobs.map(j=>{
              const comp = companyById(data, j.companyId);
              console.log('[Oppli Inspector] Job:', j.title, 'companyId:', j.companyId, 'company:', comp);
              return `<tr>
                <td>${escapeHtml(j.title)}</td>
                <td>${escapeHtml(comp.name||"")}</td>
                <td>${escapeHtml(j.location||"")}</td>
                <td><a href="${j.sourceLink}" target="_blank">open</a></td>
              </tr>`;
            }).join('') || `<tr><td colspan="4" class="muted">No jobs saved yet.</td></tr>`}
          </tbody>
        </table>

        <h3 style="margin:12px 0 4px;font-size:13px">Latest contacts</h3>
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Company</th><th>Profile</th></tr></thead>
          <tbody>
            ${lastContacts.map(c=>{
              const comp = companyById(data, c.companyId);
              return `<tr>
                <td>${escapeHtml(c.name)}</td>
                <td>${escapeHtml(c.role)}</td>
                <td>${escapeHtml(comp.name||"")}</td>
                <td><a href="${c.linkedIn}" target="_blank">open</a></td>
              </tr>`;
            }).join('') || `<tr><td colspan="4" class="muted">No contacts saved yet.</td></tr>`}
          </tbody>
        </table>

        <div class="muted">Tip: press <b>Alt + Shift + O</b> anytime to toggle this panel.</div>
        
        <details style="margin-top: 12px;">
          <summary style="cursor: pointer; font-size: 12px; color: #64748b;">Debug: Raw Data</summary>
          <pre style="font-size: 10px; background: #f8fafc; padding: 8px; border-radius: 4px; overflow: auto; max-height: 200px;">
            ${JSON.stringify({jobs: lastJobs, companies: data.companies.slice(-3)}, null, 2)}
          </pre>
        </details>
        
        <details style="margin-top: 8px;">
          <summary style="cursor: pointer; font-size: 12px; color: #64748b;">Logos (${images.logos?.length || 0})</summary>
          <div style="font-size: 11px; background: #f8fafc; padding: 8px; border-radius: 4px;">
            ${images.logos?.map(logo => `
              <div style="margin-bottom: 8px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px; background: white;">
                <div style="margin-bottom: 4px;">
                  <strong>${logo.id}</strong> (${logo.type}) - ${logo.dataUrl ? '✅ Saved' : '❌ No data'}
                </div>
                ${logo.dataUrl ? `
                  <img src="${logo.dataUrl}" alt="Company logo" style="max-width: 100px; max-height: 60px; border: 1px solid #d1d5db; border-radius: 4px; object-fit: contain;">
                  <div style="margin-top: 4px; font-size: 10px; color: #6b7280;">
                    <button onclick="navigator.clipboard.writeText('${logo.dataUrl}')" style="background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 3px; padding: 2px 6px; font-size: 10px; cursor: pointer;">Copy URL</button>
                    <button onclick="window.open('${logo.dataUrl}', '_blank')" style="background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 3px; padding: 2px 6px; font-size: 10px; cursor: pointer; margin-left: 4px;">Open</button>
                  </div>
                ` : '<div style="color: #ef4444;">No image data available</div>'}
              </div>
            `).join('') || 'No logos saved yet.'}
          </div>
        </details>
      </main>
    `;

    el.querySelector('#oppli-close').onclick = () => el.remove();
    el.querySelector('#oppli-refresh').onclick = render;
    el.querySelector('#oppli-clear').onclick = async () => {
      await chrome.storage.local.remove('oppliData');
      render();
    };
    el.querySelector('#oppli-debug').onclick = async () => {
      const data = await getData();
      const images = await new Promise(res => chrome.storage.local.get("oppliImages", o => res(o.oppliImages || { logos: [] })));
      console.log('[Oppli Debug] Full data:', data);
      console.log('[Oppli Debug] Images:', images);
      console.log('[Oppli Debug] Latest job:', data.jobs[data.jobs.length - 1]);
      console.log('[Oppli Debug] Companies:', data.companies);
    };
  }

  function toggle(){
    const el = document.getElementById('oppli-inspector');
    if (el) { el.remove(); } else { render(); }
  }

  window.__oppliRenderInspector = render; // (optional) let other code refresh it
  window.addEventListener('keydown', (e) => {
      // allow Option OR Control OR Command + Shift + O
      const hasModifier = e.altKey || e.ctrlKey || e.metaKey;
      const keyIsO = (e.code === 'KeyO') || (typeof e.key === 'string' && e.key.toLowerCase() === 'o');
      if (hasModifier && e.shiftKey && keyIsO) {
        e.preventDefault();
        toggle();
      }
      
      // Debug shortcut: Alt+Shift+D
      const keyIsD = (e.code === 'KeyD') || (typeof e.key === 'string' && e.key.toLowerCase() === 'd');
      if (e.altKey && e.shiftKey && keyIsD) {
        e.preventDefault();
        console.log('[Oppli] Manual debug trigger');
        debugProfileStructure();
        debugButtonStructure();
        if (isProfile() && window.__oppliInjector) {
          window.__oppliInjector.inject();
        }
      }
    
    // Logo debug shortcut: Option+Shift+L (Mac) / Alt+Shift+L (PC)
    const keyIsL = (e.code === 'KeyL') || (typeof e.key === 'string' && e.key.toLowerCase() === 'l');
    if (e.altKey && e.shiftKey && keyIsL) {
      e.preventDefault();
      console.log('[Oppli] 🖼️ Manual logo debug trigger - Option+Shift+L pressed');
      if (isProfile()) {
        console.log('[Oppli] ✅ Profile page detected, starting logo test...');
        (async () => {
          try {
            console.log('[Oppli] 🔍 Testing experience scraping...');
            const options = await scrapeExperienceOptions();
            console.log('[Oppli] 🔍 Scraped options:', options);
            console.log('[Oppli] 🖼️ Options with logos:', options.filter(opt => opt.logoDataUrl).length);
            
            // Test logo extraction for each option
            options.forEach((opt, idx) => {
              console.log(`[Oppli] 📋 Option ${idx + 1}:`, {
                company: opt.company,
                role: opt.role,
                hasLogo: !!opt.logoDataUrl,
                logoSize: opt.logoDataUrl?.length || 0,
                logoType: opt.logoType
              });
              
              if (opt.logoDataUrl) {
                console.log(`[Oppli] 🖼️ Logo preview for ${opt.company}:`, opt.logoDataUrl.substring(0, 100) + '...');
              }
            });
          } catch (error) {
            console.error('[Oppli] ❌ Logo debug error:', error);
          }
        })();
      } else {
        console.log('[Oppli] ❌ Not on a profile page');
      }
    }
      
      // Force position shortcut: Alt+Shift+P
      const keyIsP = (e.code === 'KeyP') || (typeof e.key === 'string' && e.key.toLowerCase() === 'p');
      if (e.altKey && e.shiftKey && keyIsP) {
        e.preventDefault();
        console.log('[Oppli] Manual robust injection trigger');
        if (isProfile()) {
        // Function to scrape experience options from LinkedIn profile
        async function scrapeExperienceOptions() {
          console.log('[Oppli] 🔍 Scraping experience options from profile...');
          const options = [];
          
          try {
            // Look for experience section
            const experienceSection = document.querySelector('[data-section="experience"]') ||
                                     document.querySelector('#experience') ||
                                     document.querySelector('[id*="experience"]') ||
                                     document.querySelector('section[aria-labelledby*="experience"]') ||
                                     document.querySelector('section').querySelector('h2')?.textContent?.includes('Experience') ? document.querySelector('section') : null;
            
            if (!experienceSection) {
              console.log('[Oppli] ⚠️ No experience section found');
              return options;
            }
            
            // Find all experience entries
            const experienceEntries = experienceSection.querySelectorAll('[data-view-name="profile-component-entity"]') ||
                                     experienceSection.querySelectorAll('.pv-entity__summary-info') ||
                                     experienceSection.querySelectorAll('.experience-item') ||
                                     experienceSection.querySelectorAll('li');
            
            console.log('[Oppli] 🔍 Found', experienceEntries.length, 'experience entries');
            
            for (const entry of experienceEntries) {
              try {
                // Extract role/title
                const roleElement = entry.querySelector('h3') || 
                                  entry.querySelector('[data-field="title"]') ||
                                  entry.querySelector('.pv-entity__summary-info-v2 h3') ||
                                  entry.querySelector('div[aria-hidden="true"]');
                const role = roleElement?.textContent?.trim() || '';
                
                // Extract company name
                const companyElement = entry.querySelector('h4') ||
                                     entry.querySelector('[data-field="company"]') ||
                                     entry.querySelector('.pv-entity__secondary-title') ||
                                     entry.querySelector('span[aria-hidden="true"]');
                const company = companyElement?.textContent?.trim() || '';
                
                // Extract company logo
                const logoElement = entry.querySelector('img[alt*="logo"]') ||
                                  entry.querySelector('img[src*="company"]') ||
                                  entry.querySelector('.experience-logo img') ||
                                  entry.querySelector('img');
                
                let logoDataUrl = '';
                let logoType = '';
                
                if (logoElement && logoElement.src && !logoElement.src.includes('data:image/gif')) {
                  try {
                    // Convert logo to data URL
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    
                    logoDataUrl = await new Promise((resolve, reject) => {
                      img.onload = () => {
                        try {
                          canvas.width = img.naturalWidth || 100;
                          canvas.height = img.naturalHeight || 100;
                          ctx.drawImage(img, 0, 0);
                          const dataUrl = canvas.toDataURL('image/png');
                          resolve(dataUrl);
                        } catch (canvasError) {
                          console.log('[Oppli] ⚠️ Canvas error for', company, ':', canvasError);
                          resolve('');
                        }
                      };
                      img.onerror = () => resolve('');
                      img.crossOrigin = 'anonymous';
                      img.src = logoElement.src;
                    });
                    
                    logoType = 'image/png';
                    console.log('[Oppli] ✅ Logo extracted for', company, '- Size:', logoDataUrl.length);
                  } catch (logoError) {
                    console.log('[Oppli] ⚠️ Could not extract logo for', company, ':', logoError.message);
                    logoDataUrl = '';
                    logoType = '';
                  }
                }
                
                if (role && company) {
                  options.push({
                    role: role,
                    company: company,
                    logoDataUrl: logoDataUrl,
                    logoType: logoType
                  });
                  console.log('[Oppli] ✅ Added experience option:', { role, company, hasLogo: !!logoDataUrl });
                }
              } catch (entryError) {
                console.log('[Oppli] ⚠️ Error processing experience entry:', entryError);
              }
            }
            
            console.log('[Oppli] 🔍 Total experience options found:', options.length);
            return options;
            
          } catch (error) {
            console.error('[Oppli] ❌ Error scraping experience options:', error);
            return options;
          }
        }
        
        // Function to show contact picker with role/company options
        async function showContactPicker(personName, options) {
          return new Promise((resolve) => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.className = 'oppli-sheet';
            overlay.innerHTML = `
              <header>
                <h1>Save ${personName} to Oppli</h1>
                <button id="oppli-close" style="background:none;border:none;font-size:18px;cursor:pointer;">×</button>
              </header>
              <div style="padding:16px;">
                <div style="margin-bottom:16px;">
                  <label style="display:block;margin-bottom:8px;font-weight:600;">Select Role & Company:</label>
                  <select id="oppli-experience-select" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;">
                    <option value="">Choose from experience...</option>
                    ${options.map((opt, idx) => 
                      `<option value="${idx}">${opt.role} at ${opt.company}</option>`
                    ).join('')}
                  </select>
                </div>
                <div style="margin-bottom:16px;">
                  <label style="display:block;margin-bottom:8px;font-weight:600;">Or enter manually:</label>
                  <input id="oppli-manual-role" placeholder="Role/Title" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin-bottom:8px;">
                  <input id="oppli-manual-company" placeholder="Company" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;">
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                  <button id="oppli-cancel" style="padding:8px 16px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;">Cancel</button>
                  <button id="oppli-save" style="padding:8px 16px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer;">Save</button>
                </div>
              </div>
            `;
            
            document.body.appendChild(overlay);
            
            // Handle selection change
            const selectElement = overlay.querySelector('#oppli-experience-select');
            const manualRole = overlay.querySelector('#oppli-manual-role');
            const manualCompany = overlay.querySelector('#oppli-manual-company');
            
            selectElement.addEventListener('change', () => {
              if (selectElement.value) {
                const selectedOption = options[parseInt(selectElement.value)];
                manualRole.value = selectedOption.role;
                manualCompany.value = selectedOption.company;
              }
            });
            
            // Handle buttons
            overlay.querySelector('#oppli-close').addEventListener('click', () => {
              overlay.remove();
              resolve(null);
            });
            
            overlay.querySelector('#oppli-cancel').addEventListener('click', () => {
              overlay.remove();
              resolve(null);
            });
            
            overlay.querySelector('#oppli-save').addEventListener('click', () => {
              const selectedIndex = selectElement.value;
              const role = manualRole.value.trim();
              const company = manualCompany.value.trim();
              
              if (!role || !company) {
                alert('Please enter both role and company');
                return;
              }
              
              let result = { role, company };
              
              // If user selected from dropdown, include logo data
              if (selectedIndex && options[parseInt(selectedIndex)]) {
                const selectedOption = options[parseInt(selectedIndex)];
                result.logoDataUrl = selectedOption.logoDataUrl;
                result.logoType = selectedOption.logoType;
                console.log('[Oppli] ✅ Including logo data from selected experience');
              } else {
                console.log('[Oppli] ℹ️ Manual entry - no logo data');
              }
              
              overlay.remove();
              resolve(result);
            });
          });
        }
        
          const onClick = async () => {
            const personName = getProfileName();
            const options    = await scrapeExperienceOptions();
            const choice     = await showContactPicker(personName, options);
            if (!choice) return;
      
            const resp = await chrome.runtime.sendMessage({
              type: "saveContact",
              payload: {
                companyName: (choice.company || "").trim(),
              logoDataUrl: choice.logoDataUrl || "",     // Include logo data from experience
              logoType: choice.logoType || "",           // Include logo type
                name: personName || "",
                role: (choice.role || "").trim(),
                linkedInUrl: location.href
              }
            });

            if (resp && resp.ok) {
              toast("Saved contact to Oppli");
            } else {
              toast("Error saving contact to Oppli");
              console.error("[Oppli] saveContact error:", resp?.error);
            }
          };
          
          // Create new injector and try injection
          const injector = createRobustButtonInjector(onClick);
          injector.inject();
        
        // TEMPORARY: Add a debug button for logo testing
        setTimeout(() => {
          if (document.querySelector('.oppli-cta[data-scope="profile"]') && !document.getElementById('oppli-debug-logo')) {
            const debugBtn = document.createElement('button');
            debugBtn.id = 'oppli-debug-logo';
            debugBtn.textContent = '🖼️ Test Logo';
            debugBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;background:#ff4444;color:white;border:none;padding:8px;border-radius:4px;cursor:pointer;';
            debugBtn.onclick = async () => {
              console.log('[Oppli] 🖼️ Debug button clicked - testing logo scraping...');
              try {
                const options = await scrapeExperienceOptions();
                console.log('[Oppli] 🔍 Debug test results:', options);
                alert(`Found ${options.length} experience options, ${options.filter(opt => opt.logoDataUrl).length} with logos`);
              } catch (error) {
                console.error('[Oppli] ❌ Debug test error:', error);
                alert('Error: ' + error.message);
              }
            };
            document.body.appendChild(debugBtn);
            console.log('[Oppli] 🖼️ Added debug logo button (top-right corner)');
          }
        }, 1000);
        }
      }
    }, true);
    
})();

// Cleanup function to stop observers when navigating away
function cleanupOppliInjectors() {
  console.log('[Oppli] 🧹 Starting cleanup...');
  
  if (window.__oppliInjector) {
    window.__oppliInjector.stop();
    window.__oppliInjector = null;
    console.log('[Oppli] 🧹 Stopped profile injector');
  }
  if (window.__oppliProfileObs) {
    window.__oppliProfileObs.disconnect();
    window.__oppliProfileObs = null;
    console.log('[Oppli] 🧹 Disconnected profile observer');
  }
  
  // Remove any existing floating buttons
  const existingFloat = document.getElementById('oppli-float-profile');
  if (existingFloat) {
    existingFloat.remove();
    console.log('[Oppli] 🧹 Removed floating profile button');
  }
  
  // Remove any profile buttons (both floating and injected)
  const existingProfileButtons = document.querySelectorAll('.oppli-cta[data-scope="profile"]');
  existingProfileButtons.forEach(btn => {
    btn.remove();
    console.log('[Oppli] 🧹 Removed profile button');
  });
  
  // Also remove any job buttons
  const existingJobButtons = document.querySelectorAll('.oppli-cta[data-scope="job"]');
  existingJobButtons.forEach(btn => {
    btn.remove();
    console.log('[Oppli] 🧹 Removed job button');
  });
  
  console.log('[Oppli] 🧹 Cleanup completed');
}

// Helper function to safely append styles to document.head
function safeAppendStyle(styleElement) {
  if (document.head) {
    document.head.appendChild(styleElement);
  } else {
    // Fallback: wait for head to be available
    const waitForHead = () => {
      if (document.head) {
        document.head.appendChild(styleElement);
      } else {
        setTimeout(waitForHead, 10);
      }
    };
    waitForHead();
  }
}

// === Oppli Chrome Extension Content Script ===

// DEBUG FUNCTION: Help identify the correct container
function debugProfileStructure() {
  console.log('[Oppli] === DEBUG: LinkedIn Profile Structure ===');
  
  // Find all buttons that might be profile action buttons
  const allButtons = document.querySelectorAll('button');
  console.log('[Oppli] Total buttons found:', allButtons.length);
  
  // Look for Message and More buttons specifically
  const messageButtons = Array.from(allButtons).filter(btn => 
    btn.textContent.includes('Message') || 
    btn.getAttribute('aria-label')?.includes('Message')
  );
  
  const moreButtons = Array.from(allButtons).filter(btn => 
    btn.textContent.includes('More') || 
    btn.getAttribute('aria-label')?.includes('More')
  );
  
  console.log('[Oppli] Message buttons found:', messageButtons.length);
  console.log('[Oppli] More buttons found:', moreButtons.length);
  
  // For each Message button, trace its container structure
  messageButtons.forEach((btn, index) => {
    console.log(`[Oppli] Message button ${index}:`, {
      text: btn.textContent,
      aria: btn.getAttribute('aria-label'),
      classes: btn.className,
      parent: btn.parentElement?.className,
      grandparent: btn.parentElement?.parentElement?.className,
      greatGrandparent: btn.parentElement?.parentElement?.parentElement?.className
    });
  });
  
  // For each More button, trace its container structure
  moreButtons.forEach((btn, index) => {
    console.log(`[Oppli] More button ${index}:`, {
      text: btn.textContent,
      aria: btn.getAttribute('aria-label'),
      classes: btn.className,
      parent: btn.parentElement?.className,
      grandparent: btn.parentElement?.parentElement?.className,
      greatGrandparent: btn.parentElement?.parentElement?.parentElement?.className
    });
  });
  
  console.log('[Oppli] === END DEBUG ===');
}

     // Call debug function immediately
 debugProfileStructure();
 
})();
