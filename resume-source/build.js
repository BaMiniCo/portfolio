// Prints resume-source/resume.html to Abhishek_Gupta_Resume.pdf (A4) with page headers and numbers.
// Usage: node resume-source/build.js
const path = require("path");
const { chromium } = require("playwright");

(async () => {
  const root = path.resolve(__dirname, "..");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("file://" + path.join(__dirname, "resume.html"), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const small = 'style="width:100%;margin:0 18mm;font:7pt Arial,sans-serif;color:#6B6B6B;"';
  await page.pdf({
    path: path.join(root, "Abhishek_Gupta_Resume.pdf"),
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div ${small}>Abhishek Gupta — Resume (ATS, 2026)</div>`,
    footerTemplate: `<div ${small}><div style="text-align:right">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div></div>`,
    margin: { top: "16mm", bottom: "18mm", left: "18mm", right: "18mm" },
    tagged: true,
  });
  await browser.close();
})();
