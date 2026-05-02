(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('blog-list');
    if (!el) return;

    if (!window.blogPublic || !window.blogPublic.configOk()) {
      el.innerHTML =
        '<p class="blog-msg blog-msg--warn">Configura <code>js/firebase-config.js</code> para ver el blog.</p>';
      return;
    }

    window.blogPublic.ensureApp();
    el.innerHTML = '<p class="blog-loading">Cargando…</p>';

    window.blogPublic
      .listPublished(50)
      .then(function (posts) {
        if (!posts.length) {
          el.innerHTML =
            '<p class="blog-empty">Aún no hay entradas publicadas.</p>';
          return;
        }
        el.innerHTML = posts
          .map(function (p) {
            var ex =
              p.excerpt || window.blogPublic.excerptFromBody(p.body);
            var dateStr = window.blogPublic.formatDate(p.createdAt);
            return (
              '<article class="blog-list-item">' +
              '<time class="blog-list-date">' +
              window.blogPublic.escapeHtml(dateStr) +
              '</time>' +
              '<h2 class="blog-list-title">' +
              window.blogPublic.escapeHtml(p.title || 'Sin título') +
              '</h2>' +
              '<p class="blog-list-excerpt">' +
              window.blogPublic.escapeHtml(ex) +
              '</p>' +
              '<a class="btn-primary blog-list-read" href="post.html?id=' +
              encodeURIComponent(p.id) +
              '">Leer entrada</a>' +
              '</article>'
            );
          })
          .join('');
      })
      .catch(function () {
        el.innerHTML =
          '<p class="blog-msg blog-msg--err">No se pudieron cargar las entradas.</p>';
      });
  });
})();
