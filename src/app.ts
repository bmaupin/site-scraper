import fs from 'fs/promises';
import { JSDOM } from 'jsdom';
import invariant from 'tiny-invariant';

// First URL to scrape
const FIRST_URL = 'https://offqc1.rssing.com/chan-7703398/article490.html';

// DOM selector of the parent element containing the main content to scrape
const CONTENT_ELEMENT_SELECTOR = 'div.cs-single-post-content > div';

// Any elements to remove from the content element
const ELEMENTS_TO_REMOVE = [
  {
    selector: 'img[data-src]',
    attribute: 'data-src',
    content: 'stats.wordpress.com/b.gif',
  },
  {
    selector: 'img[data-src]',
    attribute: 'data-src',
    content: 'pixel.wp.com/b.gif',
  },
] as HtmlElementProperties[];

// DOM selector matching the next URL to scrape
const NEXT_URL_SELECTOR = 'a[title="Next Article"]';

const WAIT_SECONDS = 5;

interface HtmlElementProperties {
  // DOM selector
  selector: string;
  // An optional attribute of the element whose content will be matched
  attribute?: string;
  // Optional content that will be checked for a partial match
  content?: string;
}

const main = async () => {
  let urlToScrape = FIRST_URL;

  while (true) {
    let { title, content, nextUrl } = await scrapePage(urlToScrape);

    content = cleanUpContent(content);

    await savePage(title, content);

    if (nextUrl) {
      urlToScrape = nextUrl;
      // uncomment this for testing to process just one page
      // break;
      // be a good citizen and wait a little bit in between pages
      await new Promise((resolve) => setTimeout(resolve, WAIT_SECONDS * 1000));
    } else {
      break;
    }
  }
};

// get the page title and content
const scrapePage = async (
  url: string
): Promise<{
  title: string;
  content: Element;
  nextUrl: string | null | undefined;
}> => {
  const dom = await JSDOM.fromURL(url);

  const title = dom.window.document.getElementsByTagName('title')[0].innerHTML;

  const content = dom.window.document.querySelector(CONTENT_ELEMENT_SELECTOR);
  invariant(
    content,
    `Content element not found: ${CONTENT_ELEMENT_SELECTOR} in ${url}`
  );

  let nextUrl = dom.window.document
    .querySelector(NEXT_URL_SELECTOR)
    ?.getAttribute('href');
  if (nextUrl?.startsWith('//')) {
    nextUrl = `http:${nextUrl}`;
  }

  return { title, content, nextUrl };
};

// remove any undesired nodes from the content
const cleanUpContent = (content: Element) => {
  for (const elementProperties of ELEMENTS_TO_REMOVE) {
    for (const matchingElement of content.querySelectorAll(
      elementProperties.selector
    )) {
      if (!matchingElement) {
        continue;
      }

      if (elementProperties.content && elementProperties.attribute) {
        if (
          matchingElement
            ?.getAttribute(elementProperties.attribute)
            ?.includes(elementProperties.content)
        ) {
          matchingElement.remove();
        }
      } else {
        matchingElement.remove();
      }
    }
  }

  // remove trailing newlines
  const lastElement = content.children[content.children.length - 1];
  if (lastElement.tagName.toLowerCase() === 'br') {
    lastElement.remove();
  }

  return content;
};

// TODO: replace this with code to add to EPUB
const savePage = async (title: string, content: Element) => {
  const html = `<!doctype html>
  <html>
    <head>
      <title>${title}</title>
    </head>
    <body>
      ${content.innerHTML.trim()}
    </body>
  </html>`;

  // TODO: this is very specific to Offqc; we'll want something more generic
  const filename = `${title
    // start at the last "("
    .slice(title.lastIndexOf('('))
    // drop everything except the numbers
    .replace(/[^\d]/g, '')}.html`;

  console.log(`Saving ${title}`);
  await fs.writeFile(`output/${filename}`, html);
};

main();
