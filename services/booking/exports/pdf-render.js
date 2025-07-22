const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

const RenderPDF = async ({ htmlTemplatePath, pdfData, pdfPath, withLetterHead = false }) => {

    // begin pdf generation process
    console.log('initializing browser instances...')
    const browser = await puppeteer.launch({
        args: ['--force-color-profile=srgb'],
        headless: 'chrome',
    });
    const page = await browser.newPage();

    // serializing required data
    const filePath = path.resolve(htmlTemplatePath);
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    const resolvedPdfPath = path.resolve(pdfPath);

    console.log('generating pdf...')
    const template = handlebars.compile(htmlContent)(pdfData);
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36 WAIT_UNTIL=load")
    await page.setContent(template, { waitUntil: 'networkidle2' });
    await page.emulateMediaType('screen');
    let pdfOptions = {
        path: resolvedPdfPath, format: 'A4', margin: {
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