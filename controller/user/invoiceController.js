
const Order = require('../../model/orderSchema');
const puppeteer = require('puppeteer');

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

            const invoiceData = {
                orderId: order._id.toString(),
                customerDetails: {
                    name: order.userId?.name || 'N/A',
                    email: order.userId?.email || 'N/A',
                    phone: order.userId?.phone || 'N/A'
                },
                products: order.orderedItem.map(item => ({
                    name: item.productId?.productName || 'Product Unavailable',
                    quantity: Number(item.quantity) || 0,
                    price: Number(item.productPrice) || 0,
                    size: item.size || 'N/A',
                    status: item.productStatus || 'N/A'
                })),
                paymentMethod: order.paymentMethod || 'N/A',
                shippingAddress: {
                    street: order.shippingAddress?.street || 'N/A',
                    city: order.shippingAddress?.city || 'N/A',
                    state: order.shippingAddress?.state || 'N/A',
                    zipCode: order.shippingAddress?.zipCode || 'N/A',
                    country: order.shippingAddress?.country || 'N/A'
                },
                totalAmount: Number(order.orderAmount) || 0,
                invoiceDate: new Date(order.createdAt).toLocaleDateString(),
                dueDate: new Date(order.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
                companyDetails: {
                    name: 'Your Company Name',
                    address: 'Company Address',
                    email: 'contact@company.com',
                    phone: '+1234567890',
                    gst: 'GST123456789'
                }
            };

            const html = generateInvoiceHTML(invoiceData);

            // Use Puppeteer to generate PDF
            const browser = await puppeteer.launch({
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                headless: true
            });

            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'domcontentloaded' });

            const pdfBuffer = await page.pdf({ format: 'A4' });

            await browser.close();

            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=invoice-${orderId}.pdf`,
                'Content-Length': pdfBuffer.length
            });

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