const Order = require('../../model/orderSchema');
const puppeteer = require('puppeteer');

// HTML template generation function
const generateInvoiceHTML = (data) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Invoice</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                .header { text-align: center; margin-bottom: 30px; }
                .company-details { margin-bottom: 30px; }
                .customer-details { margin-bottom: 30px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .totals { text-align: right; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>INVOICE</h1>
                <p>Invoice #: ${data.orderId}</p>
                <p>Date: ${data.invoiceDate}</p>
                <p>Due Date: ${data.dueDate}</p>
            </div>

            <div class="company-details">
                <h3>${data.companyDetails.name}</h3>
                <p>${data.companyDetails.address}</p>
                <p>Email: ${data.companyDetails.email}</p>
                <p>Phone: ${data.companyDetails.phone}</p>
                <p>GST: ${data.companyDetails.gst}</p>
            </div>

            <div class="customer-details">
                <h3>Bill To:</h3>
                <p>${data.customerDetails.name}</p>
                <p>${data.customerDetails.email}</p>
                <p>${data.customerDetails.phone}</p>
                <p>${data.shippingAddress.street}</p>
                <p>${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.zipCode}</p>
                <p>${data.shippingAddress.country}</p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Size</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Status</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.products.map(product => `
                        <tr>
                            <td>${product.name}</td>
                            <td>${product.size}</td>
                            <td>${product.quantity}</td>
                            <td>₹${product.price.toFixed(2)}</td>
                            <td>${product.status}</td>
                            <td>₹${(product.quantity * product.price).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="totals">
                <h3>Total Amount: ₹${data.totalAmount.toFixed(2)}</h3>
                <p>Payment Method: ${data.paymentMethod}</p>
            </div>
        </body>
        </html>
    `;
};

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

            // Configure Puppeteer for server environment
            const browser = await puppeteer.launch({
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ],
                headless: 'new' // Use new headless mode
            });

            const page = await browser.newPage();
            await page.setContent(html, { 
                waitUntil: ['domcontentloaded', 'networkidle0'] 
            });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    right: '20px',
                    bottom: '20px',
                    left: '20px'
                }
            });

            await browser.close();

            // Set response headers
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