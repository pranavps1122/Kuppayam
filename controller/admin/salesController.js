

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

        
        const doc = new PDFDocument({
            margin: 50,
            size: 'A4',
            bufferPages: true 
        });

      
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${reportType}.pdf`);
        doc.pipe(res);

        const formatCurrency = (amount) => `₹${amount.toFixed(2)}`;

     
        doc.fontSize(24)
            .font('Helvetica-Bold')
            .text('KUPPAYAM', { align: 'center' })
            .moveDown(0.2);

      
        const pageWidth = doc.page.width - 100;
        doc.moveTo(50, doc.y)
            .lineTo(doc.page.width - 50, doc.y)
            .stroke();

        doc.moveDown(0.5)
            .fontSize(16)
            .font('Helvetica')
            .text('Sales Report', { align: 'center' })
            .moveDown();

        
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

       
        const tableTop = doc.y;
        const tableHeaders = ['Date', 'Order ID', 'Amount', 'Discount', 'Coupon', 'Final Amount'];
        const columnWidth = pageWidth / tableHeaders.length;


        doc.rect(50, tableTop, pageWidth, 20)
            .fill('#2196f3');

      
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

   
        let tableContentTop = tableTop + 25;
        let currentPage = 1;

        orders.forEach((order, index) => {
           
            if (tableContentTop > doc.page.height - 150) {
                doc.addPage();
                currentPage++;
                
                tableContentTop = 50;

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

   
            if (index % 2 === 0) {
                doc.rect(50, tableContentTop - 5, pageWidth, 20)
                    .fill('#f8f9fa');
            }


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

  
        let pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            

            doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80)
                .stroke('#cccccc');

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

     
        worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Order ID', key: 'orderId', width: 20 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Discount', key: 'discount', width: 15 },
            { header: 'Coupon Used', key: 'couponCode', width: 15 },
            { header: 'Final Amount', key: 'finalAmount', width: 15 },
        ];

    
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

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

        worksheet.addRow([]);
        worksheet.addRow(['Summary']);
        worksheet.addRow(['Total Orders', orders.length]);
        worksheet.addRow(['Total Sales', orders.reduce((acc, order) => acc + order.orderAmount, 0)]);
        worksheet.addRow(['Total Discounts', orders.reduce((acc, order) => acc + (order.couponDiscount || 0), 0)]);

        worksheet.getColumn('amount').numFmt = '₹#,##0.00';
        worksheet.getColumn('discount').numFmt = '₹#,##0.00';
        worksheet.getColumn('finalAmount').numFmt = '₹#,##0.00';

      
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${reportType}.xlsx`);

      
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