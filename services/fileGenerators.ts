import JSZip from 'jszip';
import { Chapter, ProcessedOutput, VirtualFile } from '../types';

export const generateEpubBlob = async (title: string, author: string, chapters: Chapter[], coverUrl?: string): Promise<Blob> => {
  const zip = new JSZip();

  // 1. mimetype (must be first, uncompressed)
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  // 2. META-INF/container.xml
  zip.folder("META-INF")?.file("container.xml", `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
   <rootfiles>
      <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
   </rootfiles>
</container>`);

  // 3. OEBPS folder
  const oebps = zip.folder("OEBPS");
  if (!oebps) throw new Error("Failed to create OEBPS folder");

  // Handle Cover Image
  let coverImageItem = '';
  let coverImageRef = '';
  let coverPageItem = '';
  let coverPageRef = '';

  if (coverUrl) {
    try {
        // Fetch the image to add to zip
        // Note: This relies on the image server having CORS enabled or being a proxy.
        // If fetch fails, we skip the cover.
        const imgResp = await fetch(coverUrl);
        if (imgResp.ok) {
            const imgBlob = await imgResp.blob();
            const extension = imgBlob.type.split('/')[1] || 'jpeg';
            const coverFilename = `cover.${extension}`;
            oebps.file(coverFilename, imgBlob);

            coverImageItem = `<item id="cover-image" href="${coverFilename}" media-type="${imgBlob.type}" properties="cover-image"/>`;
            
            // Create a cover XHTML page
            const coverXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Cover</title><style>img { max-width: 100%; height: auto; }</style></head>
<body><div style="text-align: center; padding-top: 20px;"><img src="${coverFilename}" alt="Cover Image"/></div></body>
</html>`;
            oebps.file("cover.xhtml", coverXhtml);
            coverPageItem = `<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`;
            coverPageRef = `<itemref idref="cover" linear="yes"/>`;
        }
    } catch (e) {
        console.warn("Failed to fetch cover image", e);
    }
  }

  // CSS
  oebps.file("styles.css", `body { font-family: sans-serif; line-height: 1.6; padding: 1em; } h1, h2 { color: #202124; } p { color: #3c4043; margin-bottom: 1em; } img { max-width: 100%; }`);

  // Content Files (XHTML)
  chapters.forEach((chapter, index) => {
    const filename = `chapter_${index + 1}.xhtml`;
    // Basic Markdown-to-HTML conversion for the EPUB body
    const htmlBody = chapter.content
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('# ')) return `<h1>${trimmed.substring(2)}</h1>`;
        if (trimmed.startsWith('## ')) return `<h2>${trimmed.substring(3)}</h2>`;
        if (trimmed.startsWith('### ')) return `<h3>${trimmed.substring(4)}</h3>`;
        if (trimmed.startsWith('- ')) return `<li>${trimmed.substring(2)}</li>`;
        return `<p>${trimmed}</p>`;
      })
      .join('\n');

    const content = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${chapter.title}</title>
  <link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body>
  ${htmlBody}
</body>
</html>`;
    oebps.file(filename, content);
  });

  // TOC.ncx (Navigation)
  let navPoints = '';
  let playOrder = 1;
  
  if (coverPageRef) {
      navPoints += `
    <navPoint id="navPoint-cover" playOrder="${playOrder++}">
      <navLabel><text>Cover</text></navLabel>
      <content src="cover.xhtml"/>
    </navPoint>`;
  }

  chapters.forEach((chapter, index) => {
    navPoints += `
    <navPoint id="navPoint-${index + 1}" playOrder="${playOrder++}">
      <navLabel><text>${chapter.title}</text></navLabel>
      <content src="chapter_${index + 1}.xhtml"/>
    </navPoint>`;
  });

  oebps.file("toc.ncx", `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN"
 "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:12345" />
    <meta name="dtb:depth" content="1" />
    <meta name="dtb:totalPageCount" content="0" />
    <meta name="dtb:maxPageNumber" content="0" />
  </head>
  <docTitle><text>${title}</text></docTitle>
  <navMap>${navPoints}</navMap>
</ncx>`);

  // Content.opf (Manifest)
  let manifestItems = `
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />
    <item id="css" href="styles.css" media-type="text/css" />
    ${coverImageItem}
    ${coverPageItem}`;

  let spineItems = `${coverPageRef}`;
  
  chapters.forEach((_, index) => {
    manifestItems += `<item id="chapter_${index+1}" href="chapter_${index+1}.xhtml" media-type="application/xhtml+xml" />\n`;
    spineItems += `<itemref idref="chapter_${index+1}" />\n`;
  });

  oebps.file("content.opf", `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="BookId" opf:scheme="UUID">urn:uuid:12345</dc:identifier>
    ${coverImageRef ? '<meta name="cover" content="cover-image" />' : ''}
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine toc="ncx">
    ${spineItems}
  </spine>
</package>`);

  return await zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
};

export const generateSplitZipBlob = async (data: ProcessedOutput): Promise<Blob> => {
  const zip = new JSZip();
  // Create a root folder named after the book to keep things tidy when extracting
  const root = zip.folder(data.baseDir);
  if (!root) throw new Error("Failed to create root folder");

  // Helper to add files recursively
  const addFiles = (folder: any, files: VirtualFile[]) => {
    files.forEach(f => {
      if (f.type === 'file' && f.content) {
        folder.file(f.name, f.content);
      }
    });
  };

  // Add Full Files in the book folder root
  if (data.fullMarkdown.content) root.file(data.fullMarkdown.name, data.fullMarkdown.content);
  if (data.fullTxt.content) root.file(data.fullTxt.name, data.fullTxt.content);

  // Folders
  const htmlFolder = root.folder("html");
  if (htmlFolder) addFiles(htmlFolder, data.htmlDir);

  const mdFolder = root.folder("markdown");
  if (mdFolder) {
    addFiles(mdFolder, data.markdownDir);
    // Index md
    if (data.indexMd.content) mdFolder.file(data.indexMd.name, data.indexMd.content);
  }

  const txtFolder = root.folder("txt");
  if (txtFolder) {
    addFiles(txtFolder, data.txtDir);
    // Index txt
    if (data.indexTxt.content) txtFolder.file(data.indexTxt.name, data.indexTxt.content);
  }

  return await zip.generateAsync({ type: "blob" });
};