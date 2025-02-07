const Order = require('../../model/orderSchema')
const Coupon = require('../../model/couponSchema')
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const salesController = {

    loadSalesReport: async (req, res) => {
        try {
            const pageSize = parseInt(req.query.limit) || 5
            const currentPage = parseInt(req.query.page) || 1;
    
            res.render('salesReport', {
                admin: req.session.admin,
                active: 'sales-report',
                pageSize: pageSize,           
                currentPage: currentPage,   
                totalItems: 0,             
                totalPages: 0                
            });
    
        } catch (error) {
            console.error('Error loading sales report:', error);
            res.status(500).redirect('/admin/adminError');
        }
    },

    generateSalesReport: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;
    
            const { reportType, startDate, endDate } = req.body;
            let dateQuery = {};
            
            switch(reportType) {
                case 'daily':
                    dateQuery = {
                        date: {
                            $gte: new Date(new Date().setHours(0,0,0,0)),
                            $lte: new Date(new Date().setHours(23,59,59,999))
                        }
                    };
                    break;
                
                case 'weekly':
                    const startOfWeek = new Date();
                    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
                    startOfWeek.setHours(0,0,0,0);
                    
                    const endOfWeek = new Date();
                    endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()));
                    endOfWeek.setHours(23,59,59,999);
                    
                    dateQuery = {
                        date: {
                            $gte: startOfWeek,
                            $lte: endOfWeek
                        }
                    };
                    break;
                
                case 'monthly':
                    const startOfMonth = new Date();
                    startOfMonth.setDate(1);
                    startOfMonth.setHours(0,0,0,0);
                    
                    const endOfMonth = new Date();
                    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
                    endOfMonth.setDate(0);
                    endOfMonth.setHours(23,59,59,999);
                    
                    dateQuery = {
                        date: {
                            $gte: startOfMonth,
                            $lte: endOfMonth
                        }
                    };
                    break;
                
                case 'custom':
                    if (!startDate || !endDate) {
                        return res.status(400).json({
                            status: 'error',
                            message: 'Start date and end date are required for custom report'
                        });
                    }
                    
                    dateQuery = {
                        date: {
                            $gte: new Date(startDate),
                            $lte: new Date(new Date(endDate).setHours(23,59,59,999))
                        }
                    };
                    break;
            }
    
       
            const totalCountPipeline = [
                { $match: dateQuery },
                { $count: "total" }
            ];
            const totalResult = await Order.aggregate(totalCountPipeline);
            const totalOrders = totalResult[0]?.total || 0;
            const totalPages = Math.ceil(totalOrders / limit);
            console.log(totalResult)
    
           
            const ordersPipeline = [
                { $match: dateQuery },
                {
                    $lookup: {
                        from: 'coupons',
                        localField: 'couponId',
                        foreignField: '_id',
                        as: 'couponDetails'
                    }
                },
                {
                    $project: {
                        date: 1,
                        orderId: '$_id',
                        amount: '$orderAmount',
                        discount: {
                            $cond: {
                                if: { $gt: [{ $size: '$couponDetails' }, 0] },
                                then: {
                                    $multiply: [
                                        '$orderAmount',
                                        { $divide: [{ $arrayElemAt: ['$couponDetails.discount', 0] }, 100] }
                                    ]
                                },
                                else: 0
                            }
                        },
                        couponUsed: {
                            $cond: {
                                if: { $gt: [{ $size: '$couponDetails' }, 0] },
                                then: { $arrayElemAt: ['$couponDetails.couponCode', 0] },
                                else: 'No Coupon'
                            }
                        },
                        finalAmount: {
                            $subtract: [
                                '$orderAmount',
                                {
                                    $cond: {
                                        if: { $gt: [{ $size: '$couponDetails' }, 0] },
                                        then: {
                                            $multiply: [
                                                '$orderAmount',
                                                { $divide: [{ $arrayElemAt: ['$couponDetails.discount', 0] }, 100] }
                                            ]
                                        },
                                        else: 0
                                    }
                                }
                            ]
                        }
                    }
                },
                { $sort: { date: -1 } },
                { $skip: skip },
                { $limit: limit }
            ];
    
            const orders = await Order.aggregate(ordersPipeline);
            
            console.log('ordersFinded',orders)
    
    
            const summaryPipeline = [
                { $match: dateQuery },
                {
                    $lookup: {
                        from: 'coupons',
                        localField: 'couponId',
                        foreignField: '_id',
                        as: 'couponDetails'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalSales: {
                            $sum: {
                                $subtract: [
                                    '$orderAmount',
                                    {
                                        $cond: {
                                            if: { $gt: [{ $size: '$couponDetails' }, 0] },
                                            then: {
                                                $multiply: [
                                                    '$orderAmount',
                                                    { $divide: [{ $arrayElemAt: ['$couponDetails.discount', 0] }, 100] }
                                                ]
                                            },
                                            else: 0
                                        }
                                    }
                                ]
                            }
                        },
                        totalOrders: { $sum: 1 },
                        totalDiscounts: {
                            $sum: {
                                $cond: {
                                    if: { $gt: [{ $size: '$couponDetails' }, 0] },
                                    then: {
                                        $multiply: [
                                            '$orderAmount',
                                            { $divide: [{ $arrayElemAt: ['$couponDetails.discount', 0] }, 100] }
                                        ]
                                    },
                                    else: 0
                                }
                            }
                        }
                    }
                }
            ];
    
            const summaryResult = await Order.aggregate(summaryPipeline);
            const summary = summaryResult[0] || {
                totalSales: 0,
                totalOrders: 0,
                totalDiscounts: 0
            };
    
            res.json({
                status: 'success',
                data: {
                    summary,
                    orders,
                    pagination: {
                        currentPage: page,
                        totalPages,
                        totalItems: totalOrders,
                        itemsPerPage: limit,
                        hasNextPage: page < totalPages,
                        hasPrevPage: page > 1
                    }
                }
            });
    
        } catch (error) {
            console.error('Error generating sales report:', error);
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    },


    exportPDF: async (req, res) => {
        try {
            const { orders, summary } = await generateSalesReport(req.body);
            
            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
            
            doc.pipe(res);
            

            doc.fontSize(20).text('Sales Report', { align: 'center' });
            doc.moveDown();
            

            doc.fontSize(12).text(`Report Period: ${req.body.reportType}`);
            doc.text(`Total Sales: $${summary.totalSales.toFixed(2)}`);
            doc.text(`Total Orders: ${summary.totalOrders}`);
            doc.text(`Total Discounts: $${summary.totalDiscounts.toFixed(2)}`);
            doc.moveDown();
            
            doc.fontSize(10);
            const tableTop = doc.y;
            const col1 = 50;
            const col2 = 150;
            const col3 = 250;
            const col4 = 350;
            const col5 = 450;
            
  
            doc.text('Date', col1, tableTop);
            doc.text('Order ID', col2, tableTop);
            doc.text('Amount', col3, tableTop);
            doc.text('Discount', col4, tableTop);
            doc.text('Final Amount', col5, tableTop);
            
            let y = tableTop + 20;

            orders.forEach(order => {
                doc.text(new Date(order.date).toLocaleDateString(), col1, y);
                doc.text(order.orderId.toString(), col2, y);
                doc.text(`$${order.amount.toFixed(2)}`, col3, y);
                doc.text(`$${order.discount.toFixed(2)}`, col4, y);
                doc.text(`$${order.finalAmount.toFixed(2)}`, col5, y);
                y += 20;
            });
            
            doc.end();

        } catch (error) {
            console.error('Error generating PDF:', error);
            res.status(500).json({ status: 'error', message: error.message });
        }
    },

    exportExcel: async (req, res) => {
        try {
            const { orders, summary } = await generateSalesReport(req.body);
            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');
            
       
            worksheet.addRow(['Sales Report']);
            worksheet.addRow([]);
            

            worksheet.addRow(['Report Summary']);
            worksheet.addRow(['Total Sales', `$${summary.totalSales.toFixed(2)}`]);
            worksheet.addRow(['Total Orders', summary.totalOrders]);
            worksheet.addRow(['Total Discounts', `$${summary.totalDiscounts.toFixed(2)}`]);
            worksheet.addRow([]);
            
        
            worksheet.addRow(['Date', 'Order ID', 'Amount', 'Discount', 'Coupon Used', 'Final Amount']);
            
            orders.forEach(order => {
                worksheet.addRow([
                    new Date(order.date).toLocaleDateString(),
                    order.orderId.toString(),
                    order.amount.toFixed(2),
                    order.discount.toFixed(2),
                    order.couponUsed,
                    order.finalAmount.toFixed(2)
                ]);
            });
            
        
            worksheet.getRow(1).font = { bold: true, size: 16 };
            worksheet.getRow(3).font = { bold: true };
            worksheet.getRow(7).font = { bold: true };
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');
            
            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.error('Error generating Excel:', error);
            res.status(500).json({ status: 'error', message: error.message });
        }
    },


    getSalesDashboard: async (req, res) => {
        try {

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const todaySales = await Order.aggregate([
                {
                    $match: {
                        date: {
                            $gte: today,
                            $lte: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$orderAmount' },
                        count: { $sum: 1 }
                    }
                }
            ]);


            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            
            const monthlySales = await Order.aggregate([
                {
                    $match: {
                        date: {
                            $gte: startOfMonth,
                            $lte: new Date()
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$orderAmount' },
                        count: { $sum: 1 }
                    }
                }
            ]);

            console.log

            res.json({
                status: 'success',
                data: {
                    todaySales: todaySales[0] || { total: 0, count: 0 },
                    monthlySales: monthlySales[0] || { total: 0, count: 0 }
                }
            });

        } catch (error) {
            console.error('Error getting dashboard data:', error);
            res.status(500).json({ status: 'error', message: error.message });
        }
    }
};

module.exports = salesController;