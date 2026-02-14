const matter = require('gray-matter');

function calculateLineOffset(content) {
    const result = matter(content);
    const rawFrontmatter = result.matter;
    console.log('GrayMatter Result:', JSON.stringify(result));
    if (rawFrontmatter) {
        return rawFrontmatter.trim().split('\n').length + 2;
    }
    return 0;
}

function check(content, name) {
    const { content: body, matter: rawFrontmatter } = matter(content);
    const rawLines = content.split(/\r?\n/);
    const bodyLines = body.split(/\r?\n/);

    console.log(`--- ${name} ---`);
    console.log('Total Raw Lines:', rawLines.length);
    console.log('Body Lines:', bodyLines.length);

    const offset = calculateLineOffset(content);
    console.log('Calculated Offset:', offset);

    const target = "Line";
    let rawTargetLine = -1;
    for(let i=0; i<rawLines.length; i++) {
        if (rawLines[i].includes(target)) {
            rawTargetLine = i + 1; // 1-based
            break;
        }
    }
    console.log('Target found at Raw Line:', rawTargetLine);

    let bodyTargetLine = -1;
    for(let i=0; i<bodyLines.length; i++) {
        if (bodyLines[i].includes(target)) {
            bodyTargetLine = i + 1; // 1-based
            break;
        }
    }
    console.log('Target found at Body Line:', bodyTargetLine);

    const expectedBodyLine = rawTargetLine - offset;
    console.log('Expected Body Line (Raw - Offset):', expectedBodyLine);

    console.log('Is Correct?', bodyTargetLine === expectedBodyLine);
    console.log('----------------');
}

// Case 1: Standard LF
check(`---
title: test
---
Line 1 is here`, "Standard LF");

// Case 2: Newline after fence LF
check(`---
title: test
---

Line 1 is here`, "Newline after fence LF");

// Case 3: CRLF
check(`---\r
title: test\r
---\r
Line 1 is here`, "Standard CRLF");

// Case 4: Internal empty lines
check(`---
title: test

description: foo
---
Line 1 is here`, "Internal empty lines");

// Case 5: Empty line after fence CRLF
check(`---\r
title: test\r
---\r
\r
Line 1 is here`, "Newline after fence CRLF");
