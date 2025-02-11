function initializeRazorpay(orderId, amount) {
    const options = {
        key: '<%= process.env.key_id %>', // Use your Razorpay API key
        amount: amount * 100, // Convert amount to paise
        currency: 'INR',
        name: 'Kuppayam',
        description: 'Order Payment',
        order_id: orderId,
        handler: function(response) {
            fetch('/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.href = '/ordersuccess';
                } else {
                    alert('Payment verification failed. Please try again.');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred while verifying the payment.');
            });
        },
        prefill: {
            name: '<%= user?.name %>',
            email: '<%= user?.email %>'
        },
        theme: {
            color: '#2962ff'
        }
    };

    const rzp = new Razorpay(options);
    rzp.open();
}

async function retryPayment(orderId) {
    console.log('Retrying payment for Order ID:', orderId); // Debug log

    try {
        const response = await fetch('/retry-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ razorpayOrderId: orderId })
        });

        const data = await response.json();
        console.log('Server Response:', data); // Debug log

        if (data.success) {
            if (!data.razorpayOrderId || !data.amount) {
                console.error('Missing order ID or amount:', data);
                alert('Error: Missing payment details. Please try again.');
                return;
            }
            initializeRazorpay(data.razorpayOrderId, data.amount);
        } else {
            alert('Failed to retry payment. ' + data.error);
        }
    } catch (error) {
        console.error('Error in retryPayment:', error);
        alert('An error occurred while retrying the payment.');
    }
}

