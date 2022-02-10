import { JSDOM } from 'jsdom';
import invariant from 'tiny-invariant';

// First URL to scrape
const FIRST_URL = 'https://offqc1.rssing.com/chan-7703398/article1.html';

// DOM selector of the parent element containing the main content to scrape
const CONTENT_ELEMENT_SELECTOR = 'div.cs-single-post-content > div';

// Any elements to remove from the content element
const ELEMENTS_TO_REMOVE = [
  {
    selector: 'img[data-src]',
    attribute: 'data-src',
    content: 'stats.wordpress.com/b.gif',
  },
] as HtmlElementProperties[];

// DOM selector matching the next URL to scrape
const NEXT_URL_SELECTOR = 'a[title="Next Article"]';

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
    // get all content of first url
    let { title, content, nextUrl } = await scrapePage(urlToScrape);

    content = cleanUpContent(content);

    // TODO: do something with the content; save to an HTML file for now?
    console.log('title=', title);
    console.log('content=', content.innerHTML);
    console.log('nextUrl=', nextUrl);

    if (nextUrl) {
      // TODO: uncomment this
      // urlToScrape = nextUrl;
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
    `Content parent node not found: ${CONTENT_ELEMENT_SELECTOR}`
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
  // remove everything from NODES_TO_REMOVE
  for (const nodeToRemove of ELEMENTS_TO_REMOVE) {
    const element = content.querySelector(nodeToRemove.selector);
    invariant(element, `Node to remove not found: ${nodeToRemove.selector}`);

    if (nodeToRemove.content && nodeToRemove.attribute) {
      if (
        element
          ?.getAttribute(nodeToRemove.attribute)
          ?.includes(nodeToRemove.content)
      ) {
        element.remove();
      }
    } else {
      element.remove();
    }
  }

  // remove trailing newlines
  const lastElement = content.children[content.children.length - 1];
  if (lastElement.tagName.toLowerCase() === 'br') {
    lastElement.remove();
  }

  return content;
};

main();
