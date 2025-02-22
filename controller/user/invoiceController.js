const pdf = require('html-pdf');
const puppeteer = require('puppeteer');
const Order = require('../../model/orderSchema');

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

           

async function generateInvoicePDF(req, res) {
    try {
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'], // Required for AWS
            headless: true
        });

        const page = await browser.newPage();
        const htmlContent = generateInvoiceHTML(invoiceData); // Your function that generates HTML content

        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

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


function generateInvoiceHTML(data) {
    const productRows = data.products.map(product => `
        <tr>
            <td>${product.name}</td>
            <td>${product.quantity}</td>
            <td>${product.size}</td>
            <td>₹${product.price.toFixed(2)}</td>
            <td>₹${(product.price * product.quantity).toFixed(2)}</td>
            <td>${product.status}</td>
        </tr>
    `).join('');

    return `
        <html>
        <head>
            <title>Invoice #${data.orderId}</title>
            <style>
                body { font-family: Arial, sans-serif; }
                .invoice-container { max-width: 800px; margin: auto; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
                th { background: #f5f5f5; }
                .total-amount { text-align: right; margin-top: 20px; font-size: 1.2em; }
            </style>
        </head>
        <body>
            <div class="invoice-container">
                <h1>Invoice #${data.orderId}</h1>
                <p><strong>Customer:</strong> ${data.customerDetails.name}</p>
                <p><strong>Email:</strong> ${data.customerDetails.email}</p>
                <p><strong>Phone:</strong> ${data.customerDetails.phone}</p>
                <p><strong>Invoice Date:</strong> ${data.invoiceDate}</p>
                <p><strong>Due Date:</strong> ${data.dueDate}</p>
                <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Quantity</th>
                            <th>Size</th>
                            <th>Price</th>
                            <th>Total</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productRows}
                    </tbody>
                </table>
                <p class="total-amount"><strong>Total Amount: ₹${data.totalAmount.toFixed(2)}</strong></p>
            </div>
        </body>
        </html>
    `;
}

module.exports = invoiceController;