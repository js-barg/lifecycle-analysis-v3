// Run this in browser console on Phase 3 page

console.log('=== Checkbox Diagnostic ===');

// 1. Check current page
console.log('1. Current URL:', window.location.href);
console.log('   Are you on Phase 3 page?', window.location.href.includes('phase3') || document.body.innerText.includes('Phase 3: AI-Enhanced'));

// 2. Check if Phase3Results component rendered
const phase3Header = Array.from(document.querySelectorAll('*')).find(el => 
    el.textContent?.includes('Phase 3: AI-Enhanced Lifecycle Analysis') ||
    el.textContent?.includes('Phase 3')
);
console.log('2. Phase 3 header found:', !!phase3Header);

// 3. Check for "Start AI Research" button (should be in same component)
const startButton = Array.from(document.querySelectorAll('button')).find(btn => 
    btn.textContent?.trim().includes('Start AI Research')
);
console.log('3. Start AI Research button found:', !!startButton);

if (startButton) {
    console.log('   Button parent:', startButton.parentElement.className);
    console.log('   Siblings:', Array.from(startButton.parentElement.children).map(c => c.tagName + (c.id ? '#' + c.id : '')));
    
    // Checkbox should be before this button
    const siblings = Array.from(startButton.parentElement.children);
    const checkboxContainer = siblings.find(el => 
        el.textContent?.includes('Use Cached Research') ||
        el.querySelector('input[type="checkbox"]')
    );
    console.log('4. Checkbox container found:', !!checkboxContainer);
    
    if (checkboxContainer) {
        const checkbox = checkboxContainer.querySelector('#use-cached-research-checkbox');
        console.log('   Checkbox element:', checkbox);
    }
} else {
    console.log('   ❌ Phase 3 component may not be rendered');
}

// 4. Check all checkboxes on page
const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
console.log('5. Total checkboxes on page:', allCheckboxes.length);
allCheckboxes.forEach((cb, i) => {
    console.log(`   Checkbox ${i+1}:`, cb.id || 'no-id', 'Parent:', cb.parentElement?.textContent?.substring(0, 50));
});

// 5. Search for checkbox text
const hasCheckboxText = document.body.innerText.includes('Use Cached Research');
console.log('6. Checkbox text found in page:', hasCheckboxText);

// 6. Check JS file
const scripts = Array.from(document.querySelectorAll('script[src*="index-"]'));
console.log('7. Loaded JS files:', scripts.map(s => s.src.split('/').pop()));

// 7. Check for errors
console.log('8. Check console for any red errors above');

console.log('');
console.log('=== Summary ===');
if (startButton && !hasCheckboxText) {
    console.log('⚠️ Phase 3 component rendered but checkbox missing');
    console.log('   Possible: Conditional rendering or React state issue');
} else if (!startButton) {
    console.log('⚠️ Phase 3 component not rendered');
    console.log('   Action: Navigate to Phase 3 page');
} else if (hasCheckboxText && !document.querySelector('#use-cached-research-checkbox')) {
    console.log('⚠️ Text exists but element missing');
    console.log('   Possible: React hydration issue');
}


