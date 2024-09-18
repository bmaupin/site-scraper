// Work in progress ...

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

const main = () => {
  // TODO: integrate https://github.com/mozilla/readability
  // NOTE: percollate uses mozilla/readability internally, so we can skip this step if
  //       we'll be using percollate
  // applyReadability()
};
