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
            '<p class="blog-msg blog-msg--err">Esta entrada no existe.</p>';
          return;
        }
        var dateStr = window.blogPublic.formatDate(p.createdAt);
        document.title =
          (p.title || 'Blog') + ' — Enza Rigano';
        var coverBlock = p.coverImageUrl
          ? '<figure class="blog-post-cover"><img src="' +
            window.blogPublic.escapeHtml(p.coverImageUrl) +
            '" alt="" width="1200" height="675" loading="eager" decoding="async"/></figure>'
          : '';
        var atts = Array.isArray(p.attachments) ? p.attachments : [];
        var attBlock = '';
        if (atts.length) {
          var lis = atts
            .filter(function (a) {
              return a && a.url;
            })
            .map(function (a) {
              var nm = window.blogPublic.escapeHtml(a.name || 'Descargar');
              var u = window.blogPublic.escapeHtml(a.url);
              return (
                '<li><a href="' +
                u +
                '" target="_blank" rel="noopener noreferrer" download>' +
                nm +
                '</a></li>'
              );
            })
            .join('');
          if (lis) {
            attBlock =
              '<section class="blog-post-attachments" aria-label="Archivos adjuntos">' +
              '<h2 class="blog-post-attachments-title">Archivos y descargas</h2>' +
              '<ul class="blog-post-attachments-list">' +
              lis +
              '</ul></section>';
          }
        }
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
          coverBlock +
          '<div class="blog-post-body">' +
          formatBodyHtml(p.body) +
          '</div>' +
          attBlock;
      })
      .catch(function () {
        root.innerHTML =
          '<p class="blog-msg blog-msg--err">Error al cargar la entrada.</p>';
      });
  });
})();
