const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

const RenderPDF = async ({ htmlTemplatePath, pdfData, pdfPath, withLetterHead = false, helpers = {}, headerTemplate = null, footerTemplate = null, margin = null }) => {

    // Register custom helpers if provided
    if (helpers && typeof helpers === 'object') {
        Object.keys(helpers).forEach(helperName => {
            handlebars.registerHelper(helperName, helpers[helperName]);
        });
    }

    let browser = null;
    try {
        // begin pdf generation process
        console.log('initializing browser instances...')
        browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
            ],
            headless: 'new',
            timeout: 60000,
            protocolTimeout: 120000,
        });

        const page = await browser.newPage();

        // serializing required data
        const filePath = path.resolve(htmlTemplatePath);
        const htmlContent = fs.readFileSync(filePath, 'utf8');
        const resolvedPdfPath = path.resolve(pdfPath);

        console.log('generating pdf from template:', filePath)
        const template = handlebars.compile(htmlContent)(pdfData);
        
        // Set content and wait for it to load
        await page.setContent(template, { 
            waitUntil: 'networkidle0',
            timeout: 60000 
        });
        
        await page.emulateMediaType('screen');

        let pdfOptions = {
            path: resolvedPdfPath, 
            format: 'A4', 
            margin: {
                top: "1.5cm",
                right: "1.5cm",
                bottom: "1.5cm",
                left: "1.5cm"
            },
            printBackground: true
        }

        if (withLetterHead) {
            pdfOptions = {
                path: resolvedPdfPath,
                format: 'A4',
                printBackground: true,
                margin: margin || {
                    top: '0',
                    bottom: '0',
                    left: '0',
                    right: '0'
                },
                preferCSSPageSize: true,
            };
        }

        // Native Puppeteer repeating header/footer: Chromium reserves this
        // margin on EVERY printed page and repeats the templates correctly.
        // Distinct from the position:fixed CSS approach other templates use
        // (which only reserves space at the very start/end of a single
        // continuous flow, not on each page break) - use this path when a
        // template's content is dynamic-length and can't be pre-chunked
        // into fixed .page blocks. Caller must supply a margin sized to fit
        // both templates or content will render underneath them.
        if (headerTemplate || footerTemplate) {
            pdfOptions.displayHeaderFooter = true;
            pdfOptions.headerTemplate = headerTemplate || '<span></span>';
            pdfOptions.footerTemplate = footerTemplate || '<span></span>';
            if (margin) {
                pdfOptions.margin = margin;
            }
            // withLetterHead sets preferCSSPageSize: true above, which tells
            // Chromium to prefer the template's own @page rule for page
            // setup (including margin) - that conflicts with the margin we
            // just set here for the header/footer to have room, causing
            // inconsistent margin/header rendering between the first page
            // and subsequent ones. The JS margin above must be the sole
            // source of truth when native header/footer are in play.
            pdfOptions.preferCSSPageSize = false;
        }

        await page.pdf(pdfOptions);
        console.log('pdf generated successfully at:', resolvedPdfPath);

        // Verify the PDF was created
        if (!fs.existsSync(resolvedPdfPath)) {
            throw new Error('PDF file was not created');
        }

        const stats = fs.statSync(resolvedPdfPath);
        console.log('PDF file size:', stats.size, 'bytes');
        
        if (stats.size === 0) {
            throw new Error('PDF file is empty');
        }

    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

module.exports = {
    RenderPDF
};