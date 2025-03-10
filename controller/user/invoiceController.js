const Order = require('../../model/orderSchema');
const PDFDocument = require('pdfkit');

const invoiceController = {
    generateAndDownload: async (req, res) => {
        try {
            const { orderId } = req.params;

            if (!orderId || !orderId.match(/^[0-9a-fA-F]{24}$/)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid order ID format'
                });
            }

            const order = await Order.findById(orderId)
                .populate('orderedItem.productId')
                .populate('userId');

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            
            const doc = new PDFDocument({
                margin: 50,
                size: 'A4'
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=invoice-${orderId}.pdf`);

            doc.pipe(res);

      
            doc.fontSize(20)
                .text('INVOICE', { align: 'center' })
                .moveDown();

    
            doc.fontSize(12)
                .text('Kuppayam', { align: 'left' })
                .text('Email: Kuppayam@company.com')
                .moveDown();

     
            doc.text(`Invoice #: ${orderId}`)
                .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`)
                .text(`Due Date: ${new Date(order.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}`)
                .moveDown();

    
            doc.text('Bill To:')
                order.deliveryAddress.forEach((address) => {
                doc.text(order.userId?.email || 'N/A')
                .text(order.userId?.phone || 'N/A')
                .text(address.street || 'N/A')
                .text(`${address.city || 'N/A'}, ${address.state || 'N/A'} ${address.postalCode || 'N/A'}`)
                .text(address.country || 'N/A')
                .moveDown();
            });

        
            const tableTop = doc.y;
            const columnWidth = (doc.page.width - 100) / 6;

            ['Product', 'Size', 'Quantity', 'Price', 'Status', 'Total'].forEach((header, i) => {
                doc.text(header, 50 + (i * columnWidth), tableTop, {
                    width: columnWidth,
                    align: 'left'
                });
            });

            
            doc.moveTo(50, tableTop + 20)
                .lineTo(doc.page.width - 50, tableTop + 20)
                .stroke();

        
            let tableContentTop = tableTop + 30;
            order.orderedItem.forEach((item, index) => {
                const y = tableContentTop + (index * 20);
                
                doc.fontSize(10);
                
                doc.text(item.productId?.productName || 'Product Unavailable', 50, y, {
                    width: columnWidth,
                    align: 'left'
                });
                
                doc.text(item.size || 'N/A', 50 + columnWidth, y, {
                    width: columnWidth,
                    align: 'left'
                });
                
                doc.text(item.quantity.toString(), 50 + (columnWidth * 2), y, {
                    width: columnWidth,
                    align: 'left'
                });
                
                doc.text(`₹${Number(item.productPrice).toFixed(2)}`, 50 + (columnWidth * 3), y, {
                    width: columnWidth,
                    align: 'left'
                });
                
                doc.text(item.productStatus || 'N/A', 50 + (columnWidth * 4), y, {
                    width: columnWidth,
                    align: 'left'
                });
                
                doc.text(`₹${(Number(item.quantity) * Number(item.productPrice)).toFixed(2)}`, 50 + (columnWidth * 5), y, {
                    width: columnWidth,
                    align: 'left'
                });
            });

     
            doc.moveDown()
                .moveTo(50, doc.y)
                .lineTo(doc.page.width - 50, doc.y)
                .stroke()
                .moveDown();

            doc.fontSize(12)
                .text(`Total Amount: ₹${Number(order.orderAmount).toFixed(2)}`, {
                    align: 'right'
                })
                .text(`Payment Method: ${order.paymentMethod || 'N/A'}`, {
                    align: 'right'
                });


            doc.end();

        } catch (error) {
            console.log('Error generating invoice:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating invoice',
                error: error.message
            });
        }
    }
};

module.exports = invoiceController;