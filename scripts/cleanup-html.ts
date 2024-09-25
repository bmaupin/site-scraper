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

const blacklistSelectorsBeforeCustomLogic: string[] = [
  // If any selectors are added here, any matching elements will be removed from the final HTML before custom logic
  'style',
  'script',
  'header',
  '.hint-popups',
  '.technique-side-nav',
  '.technique-top-nav',
  'div.main-content svg[class*="-icon"]',
  'div.main-content .carousel #carousel',
  'div.main-content .carousel .top-video__carousel-block',
  'div.main-content div.no-carousel .top-video__container',
  'div.main-content .basic-video-block',
  'div.main-content .slick-list .slick-cloned',
  'div.main-content .slider-controls',
  'div.main-content .gif-player .gif-ctrl',
  'div.main-content .custom-gif-player .gif-ctrl',
  'div.main-content .gif-block .play-custom-gif',
  'div.main-content .gif-block .gif-toggle',
  'div.main-content .gif-container .link',
  'div.main-content .main-content-container.first.last .sm-only',
  'div.main-content .expansion-link',
  'div.main-content .ng-hide',
  'div.main-content .feedback-banner',
  'div[onload]',
  'footer',
];

const blacklistSelectorsAfterCustomLogic: string[] = [
  // If any selectors are added here, any matching elements will be removed from the final HTML after custom logic
];

const whitelistSelectors: string[] = [
  // If any selectors are added here, only matching elements will end up in the final HTML
];

// Add any extra site-specific logic to apply here
const applyCustomLogic = (document: Document) => {
  // Override HTML title
  document.title =
    document.querySelector('h1.page-heading__title')?.textContent ?? '';

  // Remove external links
  const anchorElements = document.querySelectorAll('a');
  for (const anchorElement of anchorElements) {
    const textContent = anchorElement.textContent;
    if (textContent) {
      // Create a text node with the link's text
      const textNode = document.createTextNode(textContent);
      anchorElement.replaceWith(textNode);
    } else {
      // If the link has no text, remove it altogether
      anchorElement.remove();
    }
  }

  // Remove embedded style from all elements
  const elementsWithStyle = document.querySelectorAll('[style]');
  for (const elementWithStyle of elementsWithStyle) {
    elementWithStyle.removeAttribute('style');
  }
  const elementsWithAriaDescribedBy =
    document.querySelectorAll('[aria-describedby]');
  for (const elementWithAriaDescribedBy of elementsWithAriaDescribedBy) {
    elementWithAriaDescribedBy.removeAttribute('aria-describedby');
  }

  // Set inline styles for specific elements
  const images = document.querySelectorAll('img');
  for (const image of images) {
    image.style.marginRight = '50px';
  }

  // Remove all svg elements that aren't icons
  const svgs = document.querySelectorAll('svg');
  for (const svg of svgs) {
    const svgElement = svg as SVGElement;
    if (svgElement.className.baseVal.includes('icon')) {
      svgElement.style.height = '26px';
    } else {
      svg.remove();
    }
  }

  // Conditionally remove some elements if they exist at same time as other elements
  removeDuplicateElements(
    document,
    'div.main-content .gif-player .gif-still',
    'div.main-content .gif-player .gif-movie'
  );
  removeDuplicateElements(
    document,
    'div.main-content .gif-block .gif-still',
    'div.main-content .gif-block .gif-movie'
  );
  removeDuplicateElements(
    document,
    'div.main-content .copy-block__heading.for-smaller',
    'div.main-content .copy-block__heading.for-larger'
  );
  removeDuplicateElements(
    document,
    'div.main-content .slick-list .for-smaller',
    'div.main-content .slick-list .for-larger'
  );

  // Replace h2 copy block headings with h4
  const copyBlockHeadings = document.querySelectorAll('h2.copy-block__heading');
  for (const h2 of copyBlockHeadings) {
    const h4 = document.createElement('h4'); // Create a new h4 element
    h4.className = h2.className;
    h4.innerHTML = h2.innerHTML;
    h2.replaceWith(h4);
  }

  const divLazyBgImageElements = document.querySelectorAll(
    'div.quote-banner[data-lazy-bg-image]'
  );
  for (const divLazyBgImageElement of divLazyBgImageElements) {
    const h2Element = divLazyBgImageElement.querySelector('h2');
    if (divLazyBgImageElement && h2Element) {
      const blockquote = document.createElement('blockquote');
      blockquote.textContent = h2Element.textContent;
      divLazyBgImageElement.replaceWith(blockquote);
    }
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

const removeDuplicateElements = (
  document: Document,
  toKeepSelector: string,
  toRemoveSelector: string
) => {
  const elementsToKeep = document.querySelectorAll(toKeepSelector);
  const elementsToRemove = document.querySelectorAll(toRemoveSelector);
  if (elementsToKeep.length > 0 && elementsToRemove.length > 0) {
    elementsToRemove.forEach((element) => {
      element.remove();
    });
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

  for (const blacklistSelector of blacklistSelectorsBeforeCustomLogic) {
    const elementsToRemove = document.querySelectorAll(blacklistSelector);

    elementsToRemove.forEach((element) => element.remove());
  }

  applyCustomLogic(document);

  for (const blacklistSelector of blacklistSelectorsAfterCustomLogic) {
    const elementsToRemove = document.querySelectorAll(blacklistSelector);

    elementsToRemove.forEach((element) => element.remove());
  }

  const newHtml = dom.serialize();

  return newHtml;
};

main().then(() => {});
