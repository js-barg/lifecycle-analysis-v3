// Deep search for checkbox - run in browser console on Phase 3 page

console.log('=== Deep Checkbox Search ===');

// 1. Search for the exact text
const hasText = document.body.innerText.includes('Use Cached Research');
console.log('1. Checkbox text in page:', hasText);

// 2. Search in HTML source
const htmlContent = document.documentElement.innerHTML;
const hasTextInHTML = htmlContent.includes('Use Cached Research');
const hasIdInHTML = htmlContent.includes('use-cached-research-checkbox');
console.log('2. Text in HTML source:', hasTextInHTML);
console.log('3. Checkbox ID in HTML source:', hasIdInHTML);

// 3. Search for the Info icon (should be next to checkbox)
const infoIcons = Array.from(document.querySelectorAll('svg')).filter(svg => {
    const parent = svg.parentElement;
    return parent && (
        parent.textContent?.includes('Use Cached Research') ||
        parent.textContent?.includes('Cached')
    );
});
console.log('4. Info icons near checkbox text:', infoIcons.length);

// 4. Search for the parent container classes
const controlPanels = Array.from(document.querySelectorAll('[class*="p-6 border-b bg-gray-50"]'));
console.log('5. Control Panel divs found:', controlPanels.length);

if (controlPanels.length > 0) {
    controlPanels.forEach((panel, i) => {
        console.log(`   Panel ${i+1} content (first 200 chars):`, panel.textContent.substring(0, 200));
        
        // Check for checkbox in this panel
        const checkbox = panel.querySelector('#use-cached-research-checkbox');
        console.log(`   Checkbox in panel ${i+1}:`, !!checkbox);
        
        // Check for any checkbox
        const anyCheckbox = panel.querySelector('input[type="checkbox"]');
        console.log(`   Any checkbox in panel ${i+1}:`, !!anyCheckbox);
    });
}

// 5. Search for elements with similar styling (the checkbox container)
const whiteBoxes = Array.from(document.querySelectorAll('[class*="bg-white rounded-lg border"]')).filter(el => 
    el.textContent?.includes('Use') || el.textContent?.includes('Cache')
);
console.log('6. Potential checkbox containers:', whiteBoxes.length);
whiteBoxes.forEach((box, i) => {
    console.log(`   Box ${i+1}:`, box.textContent.substring(0, 100));
});

// 6. Check if useCacheEnabled state might be causing issues
// Search for the function that should handle the checkbox
console.log('7. Checking if checkbox-related code executed...');
// This is harder to check, but we can see if React rendered it

// 7. Check React DevTools if available
if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('8. React DevTools available - inspect Phase3Results component');
} else {
    console.log('8. React DevTools not available');
}

// 8. Final check - search for any label with the checkbox text
const labels = Array.from(document.querySelectorAll('label'));
const checkboxLabel = labels.find(label => 
    label.textContent?.includes('Use Cached Research') ||
    label.getAttribute('for') === 'use-cached-research-checkbox'
);
console.log('9. Checkbox label found:', !!checkboxLabel);
if (checkboxLabel) {
    console.log('   Label text:', checkboxLabel.textContent);
    console.log('   Label for:', checkboxLabel.getAttribute('for'));
    console.log('   Associated input:', document.querySelector('#' + checkboxLabel.getAttribute('for')));
}

console.log('');
console.log('=== Summary ===');
if (hasTextInHTML) {
    console.log('⚠️ Checkbox text is in HTML but element not rendered');
    console.log('   Possible: React error preventing render or conditional not met');
} else if (hasIdInHTML) {
    console.log('⚠️ Checkbox ID exists but may be hidden or not rendered');
} else {
    console.log('❌ Checkbox code not in HTML at all');
    console.log('   The JS file might have it, but React isn\'t rendering it');
}


