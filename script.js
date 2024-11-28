const cropForm = document.getElementById('cropForm');
const previewCanvas = document.getElementById('previewCanvas');
const zoomCanvas = document.getElementById('zoomCanvas');
const pdfStatus = document.getElementById('status');
let pdf = null;
let pdfDoc = null;
let scale = 1;
let pdfRendered = false;
let page = null;
let previewImage = null;
// Zoom variables
let startX, startY, zoomX = 0, zoomY = 0;
let isDragging = false;

// Load the uploaded PDF using pdf.js
document.getElementById('pdfFile').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        const fileReader = new FileReader();
        fileReader.onload = async function () {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.mjs';
            // Load the PDF file using pdf.js for rendering page previews
            const pdfData = new Uint8Array(this.result);
            const loadingTask = pdfjsLib.getDocument({ data: pdfData });
            pdf = await loadingTask.promise;

            const startingPage = parseInt(document.getElementById('startingPage').value, 10) || 1;

            // Render the first page of the PDF
            await renderPage(pdf, startingPage);

            // Store the loaded PDF for cropping using PDFLib
            const pdfBytes = await file.arrayBuffer();
            pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);

            // Draw the grid after rendering the PDF
            renderPreview();
        };
        fileReader.readAsArrayBuffer(file);
    }
});

document.getElementById('startingPage').addEventListener('input', async (event) => {
    if (!pdfDoc) return;

    const startingPage = parseInt(event.target.value, 10) || 1;
    await renderPage(pdf, startingPage);
    renderPreview();
});

// Add event listeners for live preview updates
[
    'rows', 'columns', 'topMargin', 'bottomMargin',
    'leftMargin', 'rightMargin', 'rowMargin', 'columnMargin',
].forEach((id) => {
    document.getElementById(id).addEventListener('input', renderPreview);
});

async function renderPage(pdf, pageNumber) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });

    // Set canvas size
    scale = Math.min(previewCanvas.width / viewport.width, previewCanvas.height / viewport.height);
    const scaledViewport = page.getViewport({ scale: scale });
    previewCanvas.width = scaledViewport.width;
    previewCanvas.height = scaledViewport.height;
    zoomCanvas.width = scaledViewport.width / 5;
    zoomCanvas.height = scaledViewport.height / 5;

    // Render page into canvas
    const context = previewCanvas.getContext('2d');
    const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
    };
    await page.render(renderContext).promise;
    // Store rendered pdf as bitmap
    previewImage = await createImageBitmap(previewCanvas);
    // Mark PDF as rendered
    pdfRendered = true;
}

// Function to overlay the grid without clearing the PDF
async function renderPreview() {
    if (!pdfRendered) return;

    const rows = parseInt(document.getElementById('rows').value, 10) || 1;
    const columns = parseInt(document.getElementById('columns').value, 10) || 1;
    const topMargin = parseFloat(document.getElementById('topMargin').value) || 0;
    const bottomMargin = parseFloat(document.getElementById('bottomMargin').value) || 0;
    const leftMargin = parseFloat(document.getElementById('leftMargin').value) || 0;
    const rightMargin = parseFloat(document.getElementById('rightMargin').value) || 0;
    const rowMargin = parseFloat(document.getElementById('rowMargin').value) || 0;
    const columnMargin = parseFloat(document.getElementById('columnMargin').value) || 0;

    const context = previewCanvas.getContext('2d');

    // Clear the canvas and redraw the PDF page
    context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    context.drawImage(previewImage, 0, 0);

    // Draw the grid
    drawGrid(context, rows, columns, topMargin, bottomMargin, leftMargin, rightMargin, rowMargin, columnMargin);
    // Draw the blue zoom rect
    // Zoom rect is /4 of the size of the preview canvas because were zooming in 4x
    drawZoomRect(context, zoomX, zoomY, zoomCanvas.width / 4, zoomCanvas.height / 4);
    
    // Draw the zoomed in area
    let zoomCtx = zoomCanvas.getContext("2d");
    zoomCtx.fillStyle = "white";
    zoomCtx.fillRect(0, 0, zoomCanvas.width, zoomCanvas.height);
    // 4x zoom
    zoomCtx.drawImage(previewCanvas, zoomX, zoomY, 100, 100, 0, 0, 400, 400);
}

// Function to draw the grid
function drawGrid(context, rows, columns, topMargin, bottomMargin, leftMargin, rightMargin, rowMargin, columnMargin) {
    context.strokeStyle = 'red';
    context.lineWidth = 1;

    const cardWidth = (previewCanvas.width - leftMargin * scale - rightMargin * scale - (columns - 1) * columnMargin * scale) / columns;
    const cardHeight = (previewCanvas.height - topMargin * scale - bottomMargin * scale - (rows - 1) * rowMargin * scale) / rows;

    for (let col = 0; col < columns; col++) {
        const xStart = leftMargin * scale + col * (cardWidth + columnMargin * scale);
        const xEnd = xStart + cardWidth;

        context.beginPath();
        context.moveTo(xStart, topMargin * scale);
        context.lineTo(xStart, previewCanvas.height - bottomMargin * scale);
        context.stroke();

        context.beginPath();
        context.moveTo(xEnd, topMargin * scale);
        context.lineTo(xEnd, previewCanvas.height - bottomMargin * scale);
        context.stroke();
    }

    for (let row = 0; row < rows; row++) {
        const yStart = topMargin * scale + row * (cardHeight + rowMargin * scale);
        const yEnd = yStart + cardHeight;

        context.beginPath();
        context.moveTo(leftMargin * scale, yStart);
        context.lineTo(previewCanvas.width - rightMargin * scale, yStart);
        context.stroke();

        context.beginPath();
        context.moveTo(leftMargin * scale, yEnd);
        context.lineTo(previewCanvas.width - rightMargin * scale, yEnd);
        context.stroke();
    }
}

function drawZoomRect(context, x, y, width, height) {
    context.strokeStyle = 'blue';
    context.lineWidth = 1;
    context.beginPath();
    context.rect(x, y, width, height);
    context.stroke();
}

previewCanvas.addEventListener("mousedown", function(e) {
    isDragging = true;
    startX = e.offsetX;
    startY = e.offsetY;
});

previewCanvas.addEventListener("mouseup", function() {
    isDragging = false;
});

previewCanvas.addEventListener("mousemove", function(e){
    if (isDragging) {
        zoomX += (e.offsetX - startX);
        zoomY += (e.offsetY - startY);
        startX = (e.offsetX);
        startY = (e.offsetY);
    }

    zoomCanvas.style.top = e.pageY + 20 + "px"
    zoomCanvas.style.left = e.pageX + 20 + "px"
    zoomCanvas.style.display = "block";

    renderPreview();
});

previewCanvas.addEventListener("mouseout", function(){
    //zoomCanvas.style.display = "none";
    isDragging = false;
});

// Form submission for cropping the PDF
cropForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const startingPage = parseInt(document.getElementById('startingPage').value, 10) || 1;
    const isNoBack = document.getElementById('page_no_back').checked;
    const isDuplex = document.getElementById('page_duplex').checked;
    const isFoldVertical = document.getElementById('page_fold_vertical').checked;
    const isFoldHorizontal = document.getElementById('page_fold_horizontal').checked;
    const rows = parseInt(document.getElementById('rows').value, 10);
    const columns = parseInt(document.getElementById('columns').value, 10);
    const topMargin = parseFloat(document.getElementById('topMargin').value);
    const bottomMargin = parseFloat(document.getElementById('bottomMargin').value);
    const leftMargin = parseFloat(document.getElementById('leftMargin').value);
    const rightMargin = parseFloat(document.getElementById('rightMargin').value);
    const rowMargin = parseFloat(document.getElementById('rowMargin').value);
    const columnMargin = parseFloat(document.getElementById('columnMargin').value);

    if (!pdfDoc || !rows || !columns) {
        alert('Please upload a PDF and set the grid parameters.');
        return;
    }

    pdfStatus.textContent = 'Processing...';

    const frontPdf = await PDFLib.PDFDocument.create();
    const backPdf = await PDFLib.PDFDocument.create();

    const pages = pdfDoc.getPages().slice(startingPage - 1);
    let currentPage = 0;
    for (const page of pages) {
        const { width, height } = page.getSize();
        const totalRowMargin = rowMargin * (rows - 1);
        const totalColumnMargin = columnMargin * (columns - 1);
        const cardWidth = (width - leftMargin - rightMargin - totalColumnMargin) / columns;
        const cardHeight = (height - topMargin - bottomMargin - totalRowMargin) / rows;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < columns; col++) {
                const x0 = leftMargin + col * (cardWidth + columnMargin);
                const y0 = height - topMargin - (row + 1) * (cardHeight + rowMargin);

                // Embed the page and set the cropping area
                if (isNoBack) {
                    const embeddedPage = await frontPdf.embedPage(page, {
                        left: x0,
                        bottom: y0 + rowMargin,
                        right: x0 + cardWidth,
                        top: y0 + cardHeight + rowMargin,
                    });

                    // Add a new page for each crop
                    const cardPage = frontPdf.addPage([cardWidth, cardHeight]);
                    cardPage.drawPage(embeddedPage, {
                        x: 0,
                        y: 0,
                        width: cardWidth,
                        height: cardHeight,
                    });
                }
                else if (isDuplex) {
                    if (currentPage % 2 === 0) {
                        const embeddedPage = await frontPdf.embedPage(page, {
                            left: x0,
                            bottom: y0 + rowMargin,
                            right: x0 + cardWidth,
                            top: y0 + cardHeight + rowMargin,
                        });

                        // Add a new page for each crop
                        const cardPage = frontPdf.addPage([cardWidth, cardHeight]);
                        cardPage.drawPage(embeddedPage, {
                            x: 0,
                            y: 0,
                            width: cardWidth,
                            height: cardHeight,
                        });
                    }
                    else {
                        const x0 = leftMargin + ((columns - 1) - col) * (cardWidth + columnMargin);
                        const embeddedPage = await backPdf.embedPage(page, {
                            left: x0,
                            bottom: y0 + rowMargin,
                            right: x0 + cardWidth,
                            top: y0 + cardHeight + rowMargin,
                        });

                        // Add a new page for each crop
                        const cardPage = backPdf.addPage([cardWidth, cardHeight]);
                        cardPage.drawPage(embeddedPage, {
                            x: 0,
                            y: 0,
                            width: cardWidth,
                            height: cardHeight,
                        });
                    }
                }
                else if(isFoldVertical) {
                    if (col % 2 === 0) {
                        const embeddedPage = await frontPdf.embedPage(page, {
                            left: x0,
                            bottom: y0 + rowMargin,
                            right: x0 + cardWidth,
                            top: y0 + cardHeight + rowMargin,
                        });

                        // Add a new page for each crop
                        const cardPage = frontPdf.addPage([cardWidth, cardHeight]);
                        cardPage.drawPage(embeddedPage, {
                            x: 0,
                            y: 0,
                            width: cardWidth,
                            height: cardHeight,
                        });
                    }
                    else {
                        const embeddedPage = await backPdf.embedPage(page, {
                            left: x0,
                            bottom: y0 + rowMargin,
                            right: x0 + cardWidth,
                            top: y0 + cardHeight + rowMargin,
                        });

                        // Add a new page for each crop
                        const cardPage = backPdf.addPage([cardWidth, cardHeight]);
                        cardPage.drawPage(embeddedPage, {
                            x: 0,
                            y: 0,
                            width: cardWidth,
                            height: cardHeight,
                        });
                    }
                }
                else if(isFoldHorizontal) {
                    if (row % 2 === 0) {
                        const embeddedPage = await frontPdf.embedPage(page, {
                            left: x0,
                            bottom: y0 + rowMargin,
                            right: x0 + cardWidth,
                            top: y0 + cardHeight + rowMargin,
                        });

                        // Add a new page for each crop
                        const cardPage = frontPdf.addPage([cardWidth, cardHeight]);
                        cardPage.drawPage(embeddedPage, {
                            x: 0,
                            y: 0,
                            width: cardWidth,
                            height: cardHeight,
                        });
                    }
                    else {
                        const embeddedPage = await backPdf.embedPage(page, {
                            left: x0,
                            bottom: y0 + rowMargin,
                            right: x0 + cardWidth,
                            top: y0 + cardHeight + rowMargin,
                        });

                        // Add a new page for each crop
                        const cardPage = backPdf.addPage([cardWidth, cardHeight]);
                        cardPage.drawPage(embeddedPage, {
                            x: 0,
                            y: 0,
                            width: cardWidth,
                            height: cardHeight,
                        });
                    }
                }
            }
        }
        currentPage++;
    }

    // Save the cropped PDF
    if (isDuplex || isFoldVertical || isFoldHorizontal) {
        const frontBytes = await frontPdf.save();
        const backBytes = await backPdf.save();

        // Create a download link
        const frontBlob = new Blob([frontBytes], { type: 'application/pdf' });
        const frontUrl = URL.createObjectURL(frontBlob);

        const frontLink = document.getElementById('downloadFrontLink');
        frontLink.href = frontUrl;
        frontLink.download = 'front_cards.pdf';
        frontLink.textContent = 'Download Front PDF';
        frontLink.style.display = 'block';

        const backBlob = new Blob([backBytes], { type: 'application/pdf' });
        const backUrl = URL.createObjectURL(backBlob);

        const backLink = document.getElementById('downloadBackLink');
        backLink.href = backUrl;
        backLink.download = 'back_cards.pdf';
        backLink.textContent = 'Download Back PDF';
        backLink.style.display = 'block';

        pdfStatus.textContent = 'Done! Click the links to download your files.';
    }
    else {
        const outputBytes = await frontPdf.save();

        // Create a download link
        const blob = new Blob([outputBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const link = document.getElementById('downloadLink');
        link.href = url;
        link.download = 'cropped_cards.pdf';
        link.textContent = 'Download Cropped PDF';
        link.style.display = 'block';

        pdfStatus.textContent = 'Done! Click the link to download your file.';
    }
});
 