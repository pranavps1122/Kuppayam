const Order = require('../../model/orderSchema');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

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

            // Create new PDF document
            const doc = new jsPDF();

            // Add company logo/header
            doc.setFontSize(20);
            doc.text('INVOICE', 105, 20, { align: 'center' });

            // Company details
            doc.setFontSize(10);
            doc.text([
                'Your Company Name',
                'Company Address',
                'Email: contact@company.com',
                'Phone: +1234567890',
                'GST: GST123456789'
            ], 15, 40);

            // Invoice details
            doc.text([
                `Invoice #: ${orderId}`,
                `Date: ${new Date(order.createdAt).toLocaleDateString()}`,
                `Due Date: ${new Date(order.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}`
            ], 15, 70);

            // Customer details
            doc.text([
                'Bill To:',
                order.userId?.name || 'N/A',
                order.userId?.email || 'N/A',
                order.userId?.phone || 'N/A',
                order.shippingAddress?.street || 'N/A',
                `${order.shippingAddress?.city || 'N/A'}, ${order.shippingAddress?.state || 'N/A'} ${order.shippingAddress?.zipCode || 'N/A'}`,
                order.shippingAddress?.country || 'N/A'
            ], 120, 40);

            // Create table for products
            const tableHeaders = [['Product', 'Size', 'Quantity', 'Price', 'Status', 'Total']];
            const tableData = order.orderedItem.map(item => [
                item.productId?.productName || 'Product Unavailable',
                item.size || 'N/A',
                item.quantity.toString(),
                `₹${Number(item.productPrice).toFixed(2)}`,
                item.productStatus || 'N/A',
                `₹${(Number(item.quantity) * Number(item.productPrice)).toFixed(2)}`
            ]);

            doc.autoTable({
                startY: 100,
                head: tableHeaders,
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [66, 66, 66] },
                styles: { 
                    fontSize: 8,
                    cellPadding: 3
                }
            });

            // Add total amount and payment method
            const finalY = doc.lastAutoTable.finalY || 150;
            doc.setFontSize(12);
            doc.text([
                `Total Amount: ₹${Number(order.orderAmount).toFixed(2)}`,
                `Payment Method: ${order.paymentMethod || 'N/A'}`
            ], 150, finalY + 20, { align: 'right' });

            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=invoice-${orderId}.pdf`);

            // Send the PDF as a buffer
            const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
            res.send(pdfBuffer);

        } catch (error) {
            console.error('Error generating invoice:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating invoice',
                error: error.message
            });
        }
    }
};

module.exports = invoiceController;