const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

// --- CONFIGURATION ---
// We navigate up one level from the script's directory to get to the project root, then into `app`.
const pathToGetterClubApp = path.resolve(__dirname, '../app'); 
const fatLossPath = path.join(pathToGetterClubApp, 'fat-loss');
const outputDir = path.join(__dirname, 'docs'); // Output to a /docs folder for GitHub Pages

// --- MAIN EXECUTION ---
async function main() {
    console.log('Starting conversion...');
    await fs.ensureDir(outputDir);
    await fs.emptyDir(outputDir);

    const chapterDirs = glob.sync(path.join(fatLossPath, '*/'));

    for (const dir of chapterDirs) {
        const slug = path.basename(dir);
        if (slug === 'disclaimer') {
            console.log('Skipping disclaimer...');
            continue; 
        }

        const pagePath = path.join(dir, 'page.jsx');
        if (fs.existsSync(pagePath)) {
            console.log(`Processing: ${slug}`);

            const rawJsx = fs.readFileSync(pagePath, 'utf-8');
            
            // 1. Extract the main content block
            let content = extractContent(rawJsx);
            if (!content) {
                console.warn(`Could not extract content for ${slug}. Skipping.`);
                continue;
            }

            // 2. Convert JSX components to Markdown
            content = convertJsxToMarkdown(slug, content);

            // 3. Create the final Markdown file with SEO header
            const finalMarkdown = createFinalMarkdown(slug, content);

            // 4. Write the file
            await fs.writeFile(path.join(outputDir, `${slug}.md`), finalMarkdown);
        }
    }

    // Create the layout file
    await createLayoutFile();

    // Create the index file
    await createIndexFile(chapterDirs);

    console.log('Conversion complete! The `docs` folder is ready.');
}

// --- HELPER FUNCTIONS ---

function extractContent(jsx) {
    // New, most robust regex: find the main return statement's fragment
    const match = jsx.match(/return\s*\(\s*<>([\s\S]*?)<\/>\s*\);/);
    if (!match) return null;

    let content = match[1];

    // Now, remove known non-content components from this block
    content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
    content = content.replace(/<ChapterHeader[^>]*\/>/g, '');
    content = content.replace(/<ContentHeader[^>]*\/>/g, '');
    content = content.replace(/<ChapterNavigation[^>]*\/>/g, '');
    content = content.replace(/<AuthorBox[^>]*\/>/g, '');

    return content;
}

function convertJsxToMarkdown(slug, content) {
    let md = content;

    // Remove specific complex components first
    md = md.replace(/<GetterProductBox[^>]*>[\s\S]*?<\/GetterProductBox>/g, '');
    md = md.replace(/<AuthorBox \/>/g, '');
    md = md.replace(/<ChapterNavigation[^>]*>[\s\S]*?<\/ChapterNavigation>/g, '');

    // Component Replacements
    md = md.replace(/<SectionDivider \/>/g, '\n---\n');
    
    // Handle LiquidGlassTable by just showing the title for simplicity
    md = md.replace(/<LiquidGlassTable headers=\{[^}]+\} rows=\{[^}]+\} \/>/g, (match) => {
        // This is a simplified placeholder. A more advanced parser would be needed for full table conversion.
        return '\n*A detailed table is available in the original article.*\n';
    });

    // Handle InfoBlock - extract title and content
    md = md.replace(/<InfoBlock[^>]*title="([^"]+)"[^>]*>([\s\S]*?)<\/InfoBlock>/g, (match, title, inner) => `\n### ${title}\n\n${inner.replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').trim()}\n`);

    // Handle LiquidGlassBox - treat as a blockquote
    md = md.replace(/<LiquidGlassBox[^>]*>([\s\S]*?)<\/LiquidGlassBox>/g, (match, inner) => `> ${inner.replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').trim()}`);

    // Handle StyledBlockquote
    md = md.replace(/<StyledBlockquote[^>]*>([\s\S]*?)<\/StyledBlockquote>/g, (match, inner) => `> ${inner.replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').trim()}`);
    
    // Basic tag replacements
    md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, '## $1');
    md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, '### $1');
    md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, '\n$1\n');
    md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/g, '$1');
    md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/g, '- $1\n');
    md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/g, '**$1**');
    md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/g, '*$1*');
    md = md.replace(/<br \/>/g, '\n');
    
    // Link replacement
    md = md.replace(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, '[$2]($1)');

    // Cleanup & Simplification
    md = md.replace(/\{[^}]*\}/g, ''); // Remove final JSX expressions
    md = md.replace(/<[^>]+>/g, ''); // Remove any remaining tags
    md = md.replace(/&\w+;/g, ''); // Remove HTML entities like &nbsp;
    md = md.replace(/^\s*[\r\n]/gm, '\n'); // Normalize newlines

    return md.trim();
}

function createFinalMarkdown(slug, content) {
    const title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const canonicalUrl = `https://getter.club/fat-loss/${slug}`;
    
    const header = `---
layout: default
title: "Getter Manual: ${title}"
permalink: /${slug}/
canonical_url: ${canonicalUrl}
---
`;
    
    const backlink = `> ✨ **This is a syndicated chapter of the official [Getter Fat Loss Manual](${canonicalUrl}). Read the original, fully-styled version for the best experience.**\n\n---\n\n`;

    return `${header}${backlink}${content}`;
}

async function createLayoutFile() {
    const layoutDir = path.join(outputDir, '_layouts');
    await fs.ensureDir(layoutDir);
    const layoutContent = `<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ page.title }}</title>
    <!-- THIS IS THE CRITICAL SEO TAG -->
    <link rel="canonical" href="{{ page.canonical_url }}" />
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
        h1, h2, h3 { line-height: 1.2; }
        blockquote { border-left: 3px solid #ccc; padding-left: 15px; margin-left: 0; color: #666; }
        code { background-color: #f0f0f0; padding: 2px 4px; border-radius: 3px; }
        pre { background-color: #f0f0f0; padding: 15px; border-radius: 5px; overflow-x: auto; }
        a { color: #8A2BE2; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <header>
        <h1>{{ page.title }}</h1>
    </header>
    <main>
      {{ content }}
    </main>
  </body>
</html>
`;
    await fs.writeFile(path.join(layoutDir, 'default.html'), layoutContent);
}

async function createIndexFile(chapterDirs) {
    const indexPath = path.join(outputDir, 'index.md');
    let indexContent = `---
layout: default
title: "The Getter Manual - Table of Contents"
---

# The Getter Fat Loss Manual

This is an open-source, syndicated version of the official [Getter Fat Loss Manual](https://getter.club/fat-loss). The content is provided here for discoverability. For the best reading experience, please view the original version.

---

## Table of Contents

`;

    const chapterLinks = chapterDirs.map(dir => {
        const slug = path.basename(dir);
        if (slug === 'disclaimer') return null;
        const title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `- [${title}](./${slug})`;
    }).filter(Boolean).join('\n');

    indexContent += chapterLinks;

    await fs.writeFile(indexPath, indexContent);
}

main(); 