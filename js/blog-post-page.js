(function () {
  function formatBodyHtml(body) {
    var esc = window.blogPublic.escapeHtml(body || '');
    var parts = esc.split(/\n\n+/);
    return parts
      .map(function (chunk) {
        return '<p>' + chunk.replace(/\n/g, '<br>') + '</p>';
      })
      .join('');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('blog-post-root');
    if (!root) return;

    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');

    if (!id) {
      root.innerHTML =
        '<p class="blog-msg blog-msg--err">Entrada no encontrada.</p>';
      return;
    }

    if (!window.blogPublic || !window.blogPublic.configOk()) {
      root.innerHTML =
        '<p class="blog-msg blog-msg--warn">Configura Firebase para ver esta página.</p>';
      return;
    }

    window.blogPublic.ensureApp();
    root.innerHTML = '<p class="blog-loading">Cargando…</p>';

    window.blogPublic
      .getPost(id)
      .then(function (p) {
        if (!p) {
          root.innerHTML =
            '<p class="blog-msg blog-msg--err">Esta entrada no existe o no está publicada.</p>';
          return;
        }
        var dateStr = window.blogPublic.formatDate(p.createdAt);
        document.title =
          (p.title || 'Blog') + ' — Enza Rigano';
        root.innerHTML =
          '<header class="blog-post-header">' +
          '<a class="blog-back" href="index.html">← Blog</a>' +
          '<time class="blog-post-date">' +
          window.blogPublic.escapeHtml(dateStr) +
          '</time>' +
          '<h1 class="blog-post-title">' +
          window.blogPublic.escapeHtml(p.title || '') +
          '</h1>' +
          '</header>' +
          '<div class="blog-post-body">' +
          formatBodyHtml(p.body) +
          '</div>';
      })
      .catch(function () {
        root.innerHTML =
          '<p class="blog-msg blog-msg--err">Error al cargar la entrada.</p>';
      });
  });
})();
