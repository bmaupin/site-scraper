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
  'div.mainContent div.stages:has(div.spacer)',
  'div.mainContent .ng-hide',
  'div.mainContent div[data-lazy-bg-image]',
  'div.mainContent .viewToggle',
  'div.mainContent .expansionLink',
  'div.mainContent .gif-player .loading',
  'div.mainContent .gif-player .preview',
  'div.mainContent .gif-player .stop',
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

  // Remove embedded style from all elements
  const elementsWithStyle = document.querySelectorAll('[style]');
  for (const elementWithStyle of elementsWithStyle) {
    elementWithStyle.removeAttribute('style');
  }

  // Conditionally remove some elements if they exist at same time as other elements
  const copySmElements = document.querySelectorAll('div.mainContent p.copy.sm');
  const copyM6Elements = document.querySelectorAll('div.mainContent p.copy.m6');
  if (copySmElements.length > 0 && copyM6Elements.length > 0) {
    copySmElements.forEach((element) => {
      element.remove();
    });
  }
  const topSmElements = document.querySelectorAll('div.mainContent div.top.sm');
  const topXlElements = document.querySelectorAll('div.mainContent div.top.xl');
  if (topSmElements.length > 0 && topXlElements.length > 0) {
    topSmElements.forEach((element) => {
      element.remove();
    });
  }
  const quoteM7Elements = document.querySelectorAll(
    'div.mainContent div.topQuote p.quote.m7'
  );
  const quoteElements = document.querySelectorAll(
    'div.mainContent div.topQuote p.quote'
  );
  if (quoteM7Elements.length > 0 && quoteElements.length > 0) {
    quoteM7Elements.forEach((element) => {
      element.remove();
    });
  }
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
  const gifMovieElements = document.querySelectorAll(
    'div.mainContent .gif-player .gif-movie'
  );
  const gifStillElements = document.querySelectorAll(
    'div.mainContent .gif-player .gif-still'
  );
  if (gifMovieElements.length > 0 && gifStillElements.length > 0) {
    gifMovieElements.forEach((element) => {
      element.remove();
    });
  }

  const divLazyBgImageElements = document.querySelectorAll(
    'div.quoteBlock div[data-lazy-bg-image]'
  );
  for (const divLazyBgImageElement of divLazyBgImageElements) {
    const h2Element = divLazyBgImageElement.querySelector('h2');
    if (divLazyBgImageElement && h2Element) {
      const blockquote = document.createElement('blockquote');
      blockquote.textContent = h2Element.textContent;
      divLazyBgImageElement.replaceWith(blockquote);
    }
  }

  // Insert a horizontal row if an element has a 'separator' class
  const elementsWithSeparator = document.querySelectorAll(
    'div.mainContent .separator'
  );
  for (const elementWithSeparator of elementsWithSeparator) {
    const hr = document.createElement('hr');
    elementWithSeparator.parentNode?.insertBefore(
      hr,
      elementWithSeparator.nextSibling
    );
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
