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

// Element where the page title will come from. Leave empty to use the HTML page title
const titleSelector = 'h1.pageTitle';

const blacklistSelectors = [
  'style',
  'script',
  'header',
  'div.mainContent svg.icon.hollow',
  'div.mainContent div.noCarousel div.video-container',
  'div.mainContent #carousel div.video-container',
  'div.mainContent #carousel div.moreVideos',
  'div.mainContent div.textBelow',
  'div.mainContent div.quoteBlock div.top',
  'div.mainContent .ng-hide',
  'div.mainContent span.statistic.after',
  'div.mainContent div.graph',
  'div.mainContent .viewToggle',
  'div.mainContent div.expansionBlock div.blockVid',
  'div.mainContent div.expansionBlock span.blockVid',
  'div.mainContent div.expansionBlock div.blockTouch',
  'div.mainContent div.expansionBlock svg.icon-arrow-thin',
  'div.mainContent div.expandedContent span.blockVid',
  'div.mainContent div.expandedContent div.img:has(div.labels)',
  'div[onload]',
  'footer',
];

const whitelistSelectors = [
  'div.mainContent h1.pageTitle',
  'div.mainContent p.pageSubtitle',
  'div.mainContent div.text h3.title',
  'div.mainContent div.text p.copy',
  'div.mainContent div.expansionBlock.variation1 h3',
  'div.mainContent div.expansionBlock.variation1 div.expandedContent',
  'div.mainContent div.expansionBlock.variation2 h3',
  'div.mainContent div.expansionBlock.variation2 div.expandedContent',
  'div.mainContent div.expansionBlock.variation3 h3',
  'div.mainContent div.expansionBlock.variation3 div.expandedContent',
  'div.mainContent div.extra div.section',
];

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
  const dom = new JSDOM(htmlInputContents);
  const document = dom.window.document;

  if (titleSelector) {
    document.title = document.querySelector(titleSelector)?.textContent ?? '';
  }

  // let title = document.title;
  // if (titleSelector) {
  //   title = document.querySelector(titleSelector)?.textContent ?? '';
  // }

  const anchorElements = document.querySelectorAll('a');

  anchorElements.forEach((anchor) => {
    anchor.setAttribute('href', ''); // Set the href attribute to an empty string
  });

  for (const blacklistSelector of blacklistSelectors) {
    const elementsToRemove = document.querySelectorAll(blacklistSelector);

    elementsToRemove.forEach((element) => element.remove());
  }

  const newHtml = dom.serialize();

  // let selectedElements = [];
  // for (const whiteListSelector of whitelistSelectors) {
  //   selectedElements.push(document.querySelectorAll(whiteListSelector));
  // }

  // // Create a new document for the output HTML
  // const outputDom = new JSDOM(
  //   `<!DOCTYPE html><html><head><title>${title}</title></head><body></body></html>`
  // );
  // const outputDocument = outputDom.window.document;

  // for (const selectedSubElements of selectedElements) {
  //   for (const selectedSubElement of selectedSubElements) {
  //     outputDocument.body.appendChild(selectedSubElement.cloneNode(true)); // Use cloneNode(true) to copy element with its children
  //   }
  // }

  // // Serialize the new HTML content
  // const newHtml = outputDom.serialize();

  return newHtml;
};

main().then(() => {});
