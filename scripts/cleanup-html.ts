// Work in progress ...

// To run this script:
// npx tsx scripts/cleanup-html.ts input.html output.html

// The idea of this script is to clean up HTML after downloading it, before creating an
// EPUB, for these advantages:
// - Separate download from cleanup so we only need to download once
// - Allow working with already downloaded sites from other sources
// - Allow using other tools for packaging EPUB files, such as pandoc or percollate
//   e.g.
//   - `pandoc -o title.epub file.html`
//   - `percollate epub -o title.epub $(find . -name "*.html" -type f | sort | awk '{printf "\"%s\" ", $0}')`

// Before running this script, open the page in Firefox and then switch to reader mode. If
// that works well, we could potentially integrate it here since it's available as a
// library: https://github.com/mozilla/readability

import fs from 'fs/promises';
import { JSDOM } from 'jsdom';

const blacklistSelectors: string[] = [
  // If any selectors are added here, any matching elements will be removed from the final HTML
  'style',
  'script',
  'header',
  'div.mainContent svg.icon.hollow',
  'div.mainContent div.noCarousel div.video-container',
  'div.mainContent #carousel div.video-container',
  'div.mainContent #carousel div.moreVideos',
  'div.mainContent div.textBelow',
  'div.mainContent .ng-hide',
  'div.mainContent div[data-lazy-bg-image]',
  'div.mainContent .viewToggle',
  'div.mainContent div.expansionBlock div.blockVid',
  'div.mainContent div.expansionBlock span.blockVid',
  'div.mainContent div.expansionBlock div.blockTouch',
  'div.mainContent div.expansionBlock svg.icon-arrow-thin',
  'div.mainContent div.expandedContent span.blockVid',
  'div[onload]',
  'footer',
];

const whitelistSelectors: string[] = [
  // If any selectors are added here, only matching elements will end up in the final HTML
];

// Add any extra site-specific logic to apply here
const applyExtraLogic = (document: Document) => {
  // Override HTML title
  document.title = document.querySelector('h1.pageTitle')?.textContent ?? '';

  // Remove external links
  const anchorElements = document.querySelectorAll('a');
  anchorElements.forEach((anchor) => {
    anchor.setAttribute('href', '');
  });

  const statisticAfterElements = document.querySelectorAll(
    'div.mainContent span.statistic.after'
  );
  const statisticBeforeElements = document.querySelectorAll(
    'div.mainContent span.statistic.before'
  );
  if (statisticAfterElements.length > 0 && statisticBeforeElements.length > 0) {
    statisticAfterElements.forEach((element) => {
      element.remove();
    });
  }

  // Remove all existing h1 elements to prepare for the next section
  const h1Elements = document.querySelectorAll('h1');
  h1Elements.forEach((h1) => h1.remove());

  // Then insert a custom h1 element just after the body; this prevents pandoc from
  // creating an extra one and allows pages to be properly split using --split-level=1
  const h1 = document.createElement('h1');
  h1.textContent = document.title;
  const body = document.body;
  if (body.firstChild) {
    body.insertBefore(h1, body.firstChild);
  }
};

const main = async () => {
  let htmlInputPath = undefined;
  let htmlOutputPath = undefined;
  if (process.argv.length === 4) {
    htmlInputPath = process.argv[2];
    htmlOutputPath = process.argv[3];
  } else {
    console.log(
      `Usage: ${process.argv[0]} ${process.argv[1]} HTML_INPUT_FILE HTML_OUTPUT_FILE`
    );
    process.exit(1);
  }

  const htmlInputContents = await fs.readFile(htmlInputPath);

  // TODO: integrate https://github.com/mozilla/readability
  // NOTE: percollate uses mozilla/readability internally, so we can skip this step if
  //       we'll be using percollate
  // let htmlOutputContents = applyReadability(htmlInputContents)

  let htmlOutputContents = cleanHtml(htmlInputContents);

  await fs.writeFile(htmlOutputPath, htmlOutputContents);
};

const cleanHtml = (htmlInputContents: Buffer): string => {
  // Parse the HTML using jsdom
  let dom = new JSDOM(htmlInputContents);
  let document = dom.window.document;

  // If any whitelist selectors are defined, create a new HTML document with only those
  // matching elements
  if (whitelistSelectors.length > 0) {
    let selectedElements = [];
    for (const whiteListSelector of whitelistSelectors) {
      selectedElements.push(document.querySelectorAll(whiteListSelector));
    }

    const newDom = new JSDOM(
      `<!DOCTYPE html><html><head><title>${document.title}</title></head><body></body></html>`
    );
    const newDocument = newDom.window.document;

    for (const selectedSubElements of selectedElements) {
      for (const selectedSubElement of selectedSubElements) {
        newDocument.body.appendChild(selectedSubElement.cloneNode(true));
      }
    }

    dom = newDom;
    document = newDocument;
  }

  applyExtraLogic(document);

  for (const blacklistSelector of blacklistSelectors) {
    const elementsToRemove = document.querySelectorAll(blacklistSelector);

    elementsToRemove.forEach((element) => element.remove());
  }

  const newHtml = dom.serialize();

  return newHtml;
};

main().then(() => {});
