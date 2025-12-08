const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function convertToPDF() {
    console.log('🚀 Starting PDF conversion...');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Read the HTML file
    const htmlPath = path.join(__dirname, 'MIRA-System-Documentation.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    // Set content with base URL for images
    await page.setContent(htmlContent, {
        waitUntil: 'networkidle0',
        timeout: 60000
    });
    
    // Wait for images to load
    await page.evaluate(async () => {
        const images = document.querySelectorAll('img');
        await Promise.all(Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve, reject) => {
                img.addEventListener('load', resolve);
                img.addEventListener('error', resolve); // Continue even if image fails
            });
        }));
    });
    
    console.log('📄 Generating PDF...');
    
    // Generate PDF
    const pdfPath = path.join(__dirname, 'MIRA-System-Documentation.pdf');
    await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px'
        },
        displayHeaderFooter: false
    });
    
    await browser.close();
    
    console.log('✅ PDF created successfully!');
    console.log('📁 Location:', pdfPath);
}

convertToPDF().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});

