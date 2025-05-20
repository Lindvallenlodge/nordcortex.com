
document.addEventListener('DOMContentLoaded', function () {
  const pageContent = document.getElementById('page-content');

  function loadPage(url) {
    fetch(url)
      .then(res => res.text())
      .then(html => {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const newContent = temp.querySelector('#page-content').innerHTML;

        pageContent.style.opacity = 0;
        setTimeout(() => {
          pageContent.innerHTML = newContent;
          pageContent.style.opacity = 1;
          window.scrollTo(0, 0);
        }, 300);
      });
  }

  document.querySelectorAll('a[href$=".html"]').forEach(link => {
    link.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href && href.endsWith('.html')) {
        e.preventDefault();
        history.pushState(null, '', href);
        loadPage(href);
      }
    });
  });

  window.addEventListener('popstate', () => {
    loadPage(location.pathname);
  });
});
