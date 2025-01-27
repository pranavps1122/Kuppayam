document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menu-toggle');
    const body = document.body;
    
    menuToggle.addEventListener('click', function() {
        body.classList.toggle('sidebar-collapsed');
        body.classList.toggle('sidebar-active');
    });
    
    // Close sidebar on window resize if in mobile view
    window.addEventListener('resize', function() {
        if (window.innerWidth <= 768) {
            body.classList.remove('sidebar-active');
        }
    });
});