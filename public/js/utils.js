const Utils = {
    initTheme() {
        const themeToggle = document.getElementById('theme-toggle');

        // Evita erro caso o botão não exista
        if (!themeToggle) return;

        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            localStorage.setItem(
                'theme',
                document.body.classList.contains('dark-mode') ? 'dark' : 'light'
            );
        });

        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.remove('dark-mode');
        }
    }
};