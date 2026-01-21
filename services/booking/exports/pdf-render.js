const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

const RenderPDF = async ({ htmlTemplatePath, pdfData, pdfPath, withLetterHead = false, helpers = {} }) => {

    // Register custom helpers if provided
    if (helpers && typeof helpers === 'object') {
        Object.keys(helpers).forEach(helperName => {
            handlebars.registerHelper(helperName, helpers[helperName]);
        });
    }

    // begin pdf generation process
    console.log('initializing browser instances...')
    const browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: [
            '--force-color-profile=srgb',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security'
        ],
        headless: 'new',
    });
    const page = await browser.newPage();

    // Increase timeout for image loading
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(60000);

    // serializing required data
    const filePath = path.resolve(htmlTemplatePath);
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    const resolvedPdfPath = path.resolve(pdfPath);

    console.log('generating pdf...')
    const template = handlebars.compile(htmlContent)(pdfData);
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    // Set content with longer timeout for image loading
    await page.setContent(template, { 
        waitUntil: ['networkidle0', 'load'],
        timeout: 60000 
    });
    
    await page.emulateMediaType('screen');
    
    // Wait for images to load
    await page.evaluate(() => {
        return Promise.all(
            Array.from(document.images)
                .filter(img => !img.complete)
                .map(img => new Promise(resolve => {
                    img.onload = img.onerror = resolve;
                }))
        );
    });

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
            margin: {
                top: '0',
                bottom: '0',
                left: '0',
                right: '0'
            },
            preferCSSPageSize: true
        };
    }

    await page.pdf(pdfOptions);
    console.log('pdf generated successfully!')
    await browser.close();

}

module.exports = {
    RenderPDF
};