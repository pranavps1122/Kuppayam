const Order = require('../../model/orderSchema')
const exceljs = require('exceljs');
const pdf = require('html-pdf');
const fs = require('fs');
const path = require('path');

exports.salesreport = async (req,res)=>{

    try {
      
        res.render('salesReport', {
            admin: req.session.admin,
            active: 'sales-report',
          
        });
      
    } catch (error) {
        console.log('error while load sales',error)
    }
}

exports.generateSalesReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.body;

        let query = {};

        if (reportType === 'daily') {
            const today = new Date();
            const startOfDay = new Date(today.setHours(0, 0, 0, 0));
            const endOfDay = new Date(today.setHours(23, 59, 59, 999));
            query.date = { $gte: startOfDay, $lte: endOfDay };
        } else if (reportType === 'weekly') {
            const today = new Date();
            const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
            const endOfWeek = new Date(today.setDate(today.getDate() + 6));
            query.date = { $gte: startOfWeek, $lte: endOfWeek };
        } else if (reportType === 'monthly') {
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            query.date = { $gte: startOfMonth, $lte: endOfMonth };
        } else if (reportType === 'custom') {
            query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const orders = await Order.find(query).populate('userId', 'name email');

        const summary = {
            totalSales: orders.reduce((acc, order) => acc + order.orderAmount, 0),
            totalOrders: orders.length,
            totalDiscounts: orders.reduce((acc, order) => acc + order.couponDiscount, 0),
        };

        res.status(200).json({
            status: 'success',
            data: {
                summary,
                orders: orders.map(order => ({
                    date: order.date,
                    orderId: order._id,
                    amount: order.orginalPrice,
                    discount: order.couponDiscount,
                    couponCode: order.couponCode,
                    finalAmount: order.orginalPrice - order.couponDiscount || order.orderAmount,
                })),
            },
        });
    } catch (error) {
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
        if (reportType === 'daily') {
            const today = new Date();
            query.date = { $gte: new Date(today.setHours(0, 0, 0, 0)), $lte: new Date(today.setHours(23, 59, 59, 999)) };
        } else if (reportType === 'weekly') {
            const today = new Date();
            query.date = { $gte: new Date(today.setDate(today.getDate() - today.getDay())), $lte: new Date(today.setDate(today.getDate() + 6)) };
        } else if (reportType === 'monthly') {
            const today = new Date();
            query.date = { $gte: new Date(today.getFullYear(), today.getMonth(), 1), $lte: new Date(today.getFullYear(), today.getMonth() + 1, 0) };
        } else if (reportType === 'custom') {
            query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

   
        const orders = await Order.find(query).populate('userId', 'name email');

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Sales Report</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                    padding: 0;
                    background-color: #f8f9fa;
                    color: #333;
                }
                .container {
                    max-width: 800px;
                    margin: auto;
                    background: white;
                    padding: 20px;
                    box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
                    border-radius: 10px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 20px;
                }
                .header img {
                    width: 100px;
                    margin-bottom: 10px;
                }
                h1 {
                    font-size: 24px;
                    color: #444;
                    margin-bottom: 5px;
                }
                .date-range {
                    font-size: 14px;
                    color: #777;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 10px;
                    text-align: left;
                }
                th {
                    background-color: #007bff;
                    color: white;
                }
                tr:nth-child(even) {
                    background-color: #f2f2f2;
                }
                tr:hover {
                    background-color: #ddd;
                }
                .footer {
                    text-align: center;
                    margin-top: 20px;
                    font-size: 12px;
                    color: #777;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img src="your-logo-url" alt="Company Logo">
                    <h1>Sales Report</h1>
                    <p class="date-range">${new Date().toLocaleDateString()}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Order ID</th>
                            <th>Amount</th>
                            <th>Discount</th>
                            <th>Coupon Used</th>
                            <th>Final Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orders.map(order => `
                            <tr>
                                <td>${new Date(order.date).toLocaleDateString()}</td>
                                <td>${order._id}</td>
                                <td>₹${order.orderAmount.toFixed(2)}</td>
                                <td>₹${(order.couponDiscount || 0).toFixed(2)}</td>
                                <td>${order.couponCode || 'No coupon used'}</td>
                                <td>₹${(order.orderAmount - (order.couponDiscount || 0)).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="footer">
                    <p>Generated by Kuppayam | ${new Date().getFullYear()}</p>
                </div>
            </div>
        </body>
        </html>
        `;
        
     
        pdf.create(html).toBuffer((err, buffer) => {
            if (err) {
                console.error("PDF Generation Error:", err);
                return res.status(500).json({ status: 'error', message: 'Error generating PDF' });
            }
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
            res.send(buffer);
        });

    } catch (error) {
        console.error("Export Sales PDF Error:", error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};



exports.exportSalesExcel = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.body;

        let query = {};

        if (reportType === 'daily') {
            const today = new Date();
            const startOfDay = new Date(today.setHours(0, 0, 0, 0));
            const endOfDay = new Date(today.setHours(23, 59, 59, 999));
            query.date = { $gte: startOfDay, $lte: endOfDay };
        } else if (reportType === 'weekly') {
            const today = new Date();
            const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
            const endOfWeek = new Date(today.setDate(today.getDate() + 6));
            query.date = { $gte: startOfWeek, $lte: endOfWeek };
        } else if (reportType === 'monthly') {
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            query.date = { $gte: startOfMonth, $lte: endOfMonth };
        } else if (reportType === 'custom') {
            query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
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

        orders.forEach(order => {
            worksheet.addRow({
                date: new Date(order.date).toLocaleDateString(),
                orderId: order._id,
                amount: order.orginalPrice,
                discount: order.couponDiscount,
                couponCode: order.couponCode,

                finalAmount: order.orginalPrice - order.couponDiscount,
            });
        });
      
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
        });
    }
};