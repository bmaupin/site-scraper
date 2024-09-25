# TODO: Could/should we move this into a separate project? Or maybe there's no good way to automate it ...

# Script to fix an already-built EPUB with no source

# Allow game directory to be overridden as a command-line parameter
if [ -z "${1}" ]; then
    echo "Error: please provide EPUB file to fix"
    echo "Usage: ${0} EPUB_FILE"
    exit 1
fi

epub_file="$1"

# TODO: for testing
# temp_dir=$(pwd)/tmp
temp_dir=$(mktemp -d -p $(pwd))

unzip "${epub_file}" -d "${temp_dir}"
pushd "${temp_dir}" > /dev/null

# Put any needed changes here
# Remove value attribute from li elements
find . -iname "*.html" -exec sed -i 's/\(\<li[^\>]*\) value="[0-9]*"/\1/g' "{}" \;
# Removes whitespace and classes from blockquotes and adds inner <p> tags
find . -iname "*.html" -exec perl -0777 -pi -e 's/<blockquote[^>]*>\s*\n\s*/<blockquote>/g; s/\s*\n\s*<\/blockquote>/<\/blockquote>/g; s/<blockquote>(.*?)<\/blockquote>/<blockquote><p>\1<\/p><\/blockquote>/g' "{}" \;

# Package the fixed EPUB
zip -X ../"${epub_file%.epub}-fixed.epub" mimetype
zip -rX ../"${epub_file%.epub}-fixed.epub" * -x mimetype

popd > /dev/null
rm -rf "${temp_dir}"
