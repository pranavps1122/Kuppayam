// controllers/salesReportController.js

const Order = require('../../model/orderSchema');
const exceljs = require('exceljs');
const PDFDocument = require('pdfkit');

exports.salesreport = async (req, res) => {
    try {
        res.render('salesReport', {
            admin: req.session.admin,
            active: 'sales-report',
        });
    } catch (error) {
        console.log('error while load sales', error);
        res.status(500).send('Internal Server Error');
    }
};

exports.generateSalesReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.body;
        let query = {};

        // Set date range based on report type
        switch (reportType) {
            case 'daily': {
                const today = new Date();
                query.date = {
                    $gte: new Date(today.setHours(0, 0, 0, 0)),
                    $lte: new Date(today.setHours(23, 59, 59, 999))
                };
                break;
            }
            case 'weekly': {
                const today = new Date();
                query.date = {
                    $gte: new Date(today.setDate(today.getDate() - today.getDay())),
                    $lte: new Date(today.setDate(today.getDate() + 6))
                };
                break;
            }
            case 'monthly': {
                const today = new Date();
                query.date = {
                    $gte: new Date(today.getFullYear(), today.getMonth(), 1),
                    $lte: new Date(today.getFullYear(), today.getMonth() + 1, 0)
                };
                break;
            }
            case 'custom': {
                query.date = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
                break;
            }
        }

        const orders = await Order.find(query).populate('userId', 'name email');

        const summary = {
            totalSales: orders.reduce((acc, order) => acc + order.orderAmount, 0),
            totalOrders: orders.length,
            totalDiscounts: orders.reduce((acc, order) => acc + (order.couponDiscount || 0), 0),
            netRevenue: orders.reduce((acc, order) => acc + order.orderAmount - (order.couponDiscount || 0), 0)
        };

        res.status(200).json({
            status: 'success',
            data: {
                summary,
                orders: orders.map(order => ({
                    date: order.date,
                    orderId: order._id,
                    amount: order.orginalPrice,
                    discount: order.couponDiscount || 0,
                    couponCode: order.couponCode || 'No Coupon',
                    finalAmount: order.orginalPrice - (order.couponDiscount || 0),
                })),
            },
        });
    } catch (error) {
        console.error('Generate Sales Report Error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message,
        });
    }
};
exports.exportSalesPDF = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.body;
        let query = {};

        // Set date range based on report type
        switch (reportType) {
            case 'daily': {
                const today = new Date();
                query.date = {
                    $gte: new Date(today.setHours(0, 0, 0, 0)),
                    $lte: new Date(today.setHours(23, 59, 59, 999))
                };
                break;
            }
            case 'weekly': {
                const today = new Date();
                query.date = {
                    $gte: new Date(today.setDate(today.getDate() - today.getDay())),
                    $lte: new Date(today.setDate(today.getDate() + 6))
                };
                break;
            }
            case 'monthly': {
                const today = new Date();
                query.date = {
                    $gte: new Date(today.getFullYear(), today.getMonth(), 1),
                    $lte: new Date(today.getFullYear(), today.getMonth() + 1, 0)
                };
                break;
            }
            case 'custom': {
                query.date = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
                break;
            }
        }

        const orders = await Order.find(query).populate('userId', 'name email');

        // Create PDF document with better margins
        const doc = new PDFDocument({
            margin: 50,
            size: 'A4',
            bufferPages: true // Enable page numbering
        });

        // Set up response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${reportType}.pdf`);
        doc.pipe(res);

        // Helper function to format currency
        const formatCurrency = (amount) => `₹${amount.toFixed(2)}`;

        // Add logo and company header
        doc.fontSize(24)
            .font('Helvetica-Bold')
            .text('KUPPAYAM', { align: 'center' })
            .moveDown(0.2);

        // Add decorative line
        const pageWidth = doc.page.width - 100;
        doc.moveTo(50, doc.y)
            .lineTo(doc.page.width - 50, doc.y)
            .stroke();

        doc.moveDown(0.5)
            .fontSize(16)
            .font('Helvetica')
            .text('Sales Report', { align: 'center' })
            .moveDown();

        // Add report details in a box
        const reportDetailsY = doc.y;
        doc.rect(50, reportDetailsY, pageWidth, 80)
            .fillAndStroke('#f6f6f6', '#cccccc');
        
        doc.fill('#000000')
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('Report Details', 70, reportDetailsY + 10)
            .font('Helvetica')
            .fontSize(10)
            .text(`Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, 70, reportDetailsY + 30)
            .text(`Generated On: ${new Date().toLocaleString()}`, 70, reportDetailsY + 45)
            .text(`Period: ${new Date(query.date.$gte).toLocaleDateString()} to ${new Date(query.date.$lte).toLocaleDateString()}`, 70, reportDetailsY + 60);

        doc.moveDown(3);

        // Add summary section with a different background
        const totalSales = orders.reduce((acc, order) => acc + order.orderAmount, 0);
        const totalDiscounts = orders.reduce((acc, order) => acc + (order.couponDiscount || 0), 0);
        const netRevenue = totalSales - totalDiscounts;

        const summaryY = doc.y;
        doc.rect(50, summaryY, pageWidth / 2 - 10, 100)
            .fillAndStroke('#f0f7ff', '#2196f3');
        
        doc.fill('#000000')
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('Summary', 70, summaryY + 10)
            .fontSize(10)
            .font('Helvetica')
            .text(`Total Orders: ${orders.length}`, 70, summaryY + 30)
            .text(`Total Sales: ${formatCurrency(totalSales)}`, 70, summaryY + 45)
            .text(`Total Discounts: ${formatCurrency(totalDiscounts)}`, 70, summaryY + 60)
            .text(`Net Revenue: ${formatCurrency(netRevenue)}`, 70, summaryY + 75);

        doc.moveDown(4);

        // Create table with improved styling
        const tableTop = doc.y;
        const tableHeaders = ['Date', 'Order ID', 'Amount', 'Discount', 'Coupon', 'Final Amount'];
        const columnWidth = pageWidth / tableHeaders.length;

        // Draw table header with gradient
        doc.rect(50, tableTop, pageWidth, 20)
            .fill('#2196f3');

        // Add table headers
        doc.fill('#ffffff');
        tableHeaders.forEach((header, i) => {
            doc.font('Helvetica-Bold')
                .fontSize(10)
                .text(
                    header,
                    50 + (i * columnWidth),
                    tableTop + 5,
                    {
                        width: columnWidth,
                        align: 'center'
                    }
                );
        });

        // Add table content with improved formatting
        let tableContentTop = tableTop + 25;
        let currentPage = 1;

        orders.forEach((order, index) => {
            // Check if we need a new page
            if (tableContentTop > doc.page.height - 150) {
                doc.addPage();
                currentPage++;
                // Reset table content position and redraw headers
                tableContentTop = 50;
                
                // Redraw headers on new page
                doc.rect(50, tableContentTop, pageWidth, 20)
                    .fill('#2196f3');

                doc.fill('#ffffff');
                tableHeaders.forEach((header, i) => {
                    doc.font('Helvetica-Bold')
                        .fontSize(10)
                        .text(
                            header,
                            50 + (i * columnWidth),
                            tableContentTop + 5,
                            {
                                width: columnWidth,
                                align: 'center'
                            }
                        );
                });
                
                tableContentTop += 25;
            }

            // Add zebra striping
            if (index % 2 === 0) {
                doc.rect(50, tableContentTop - 5, pageWidth, 20)
                    .fill('#f8f9fa');
            }

            // Add row data
            doc.fill('#000000')
                .font('Helvetica')
                .fontSize(9);

            const rowData = [
                new Date(order.date).toLocaleDateString(),
                order._id.toString().slice(-8),
                formatCurrency(order.orginalPrice),
                formatCurrency(order.couponDiscount || 0),
                order.couponCode || 'No coupon used',
                formatCurrency(order.orginalPrice - (order.couponDiscount || 0))
            ];

            rowData.forEach((text, i) => {
                doc.text(
                    text,
                    50 + (i * columnWidth),
                    tableContentTop,
                    {
                        width: columnWidth,
                        align: 'center'
                    }
                );
            });

            tableContentTop += 20;
        });

        // Add footer to each page
        let pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            
            // Add page border
            doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80)
                .stroke('#cccccc');

            // Add footer
            doc.fontSize(8)
                .text(
                    'Generated by Kuppayam Sales System',
                    50,
                    doc.page.height - 50,
                    {
                        align: 'center',
                        width: pageWidth
                    }
                )
                .text(
                    `Page ${i + 1} of ${pages.count}`,
                    50,
                    doc.page.height - 40,
                    {
                        align: 'center',
                        width: pageWidth
                    }
                );
        }

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error("Export Sales PDF Error:", error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};
exports.exportSalesExcel = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.body;
        let query = {};

        // Set date range based on report type
        switch (reportType) {
            case 'daily': {
                const today = new Date();
                query.date = {
                    $gte: new Date(today.setHours(0, 0, 0, 0)),
                    $lte: new Date(today.setHours(23, 59, 59, 999))
                };
                break;
            }
            case 'weekly': {
                const today = new Date();
                query.date = {
                    $gte: new Date(today.setDate(today.getDate() - today.getDay())),
                    $lte: new Date(today.setDate(today.getDate() + 6))
                };
                break;
            }
            case 'monthly': {
                const today = new Date();
                query.date = {
                    $gte: new Date(today.getFullYear(), today.getMonth(), 1),
                    $lte: new Date(today.getFullYear(), today.getMonth() + 1, 0)
                };
                break;
            }
            case 'custom': {
                query.date = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
                break;
            }
        }

        const orders = await Order.find(query).populate('userId', 'name email');

        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        // Style the headers
        worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Order ID', key: 'orderId', width: 20 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Discount', key: 'discount', width: 15 },
            { header: 'Coupon Used', key: 'couponCode', width: 15 },
            { header: 'Final Amount', key: 'finalAmount', width: 15 },
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Add data rows
        orders.forEach(order => {
            worksheet.addRow({
                date: new Date(order.date).toLocaleDateString(),
                orderId: order._id,
                amount: order.orginalPrice,
                discount: order.couponDiscount || 0,
                couponCode: order.couponCode || 'No Coupon',
                finalAmount: order.orginalPrice - (order.couponDiscount || 0),
            });
        });

        // Add summary section
        worksheet.addRow([]); // Empty row
        worksheet.addRow(['Summary']);
        worksheet.addRow(['Total Orders', orders.length]);
        worksheet.addRow(['Total Sales', orders.reduce((acc, order) => acc + order.orderAmount, 0)]);
        worksheet.addRow(['Total Discounts', orders.reduce((acc, order) => acc + (order.couponDiscount || 0), 0)]);

        // Style numbers as currency
        worksheet.getColumn('amount').numFmt = '₹#,##0.00';
        worksheet.getColumn('discount').numFmt = '₹#,##0.00';
        worksheet.getColumn('finalAmount').numFmt = '₹#,##0.00';

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${reportType}.xlsx`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Export Sales Excel Error:", error);
        res.status(500).json({
            status: 'error',
            message: error.message,
        });
    }
};