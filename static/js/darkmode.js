// Dark mode functionality
function initDarkMode() {
  const darkModeBtn = document.querySelector('.theme-toggle');
  if (!darkModeBtn) {
    console.warn('Theme toggle button not found');
    return;
  }
  
  const htmlElement = document.documentElement;
  
  // Check for saved theme preference or default to light mode
  const currentTheme = localStorage.getItem('theme') || 'light';
  htmlElement.setAttribute('data-theme', currentTheme);
  
  darkModeBtn.addEventListener('click', function() {
    const theme = htmlElement.getAttribute('data-theme');
    const newTheme = theme === 'light' ? 'dark' : 'light';
    
    htmlElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  });
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  initDarkMode();
});
