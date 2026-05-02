(function () {
  function configOk() {
    var c = window.FIREBASE_CONFIG;
    if (!c || !c.apiKey || c.apiKey.indexOf('REEMPLAZA') === 0) return false;
    if (!c.projectId || c.projectId === 'tu-proyecto') return false;
    return true;
  }

  function ensureApp() {
    if (!configOk()) return false;
    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    return true;
  }

  function escapeHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function formatDate(ts) {
    if (!ts || typeof ts.toDate !== 'function') return '';
    try {
      return ts.toDate().toLocaleDateString('es', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      return '';
    }
  }

  function excerptFromBody(body, max) {
    max = max || 160;
    var t = (body || '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    return t.slice(0, max).trim() + '…';
  }

  window.blogPublic = {
    configOk: configOk,
    ensureApp: ensureApp,

    listPublished: function (limit) {
      limit = limit || 10;
      if (!ensureApp()) return Promise.resolve([]);
      var db = firebase.firestore();
      return db
        .collection('posts')
        .where('published', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get()
        .then(function (snap) {
          return snap.docs.map(function (d) {
            var o = d.data();
            o.id = d.id;
            return o;
          });
        });
    },

    getPost: function (id) {
      if (!ensureApp() || !id) return Promise.resolve(null);
      return firebase
        .firestore()
        .collection('posts')
        .doc(id)
        .get()
        .then(function (doc) {
          if (!doc.exists) return null;
          var data = doc.data();
          if (!data.published) return null;
          data.id = doc.id;
          return data;
        });
    },

    escapeHtml: escapeHtml,
    formatDate: formatDate,
    excerptFromBody: excerptFromBody,

    renderLandingCards: function (container, posts) {
      if (!container) return;
      if (!posts.length) {
        container.innerHTML =
          '<p class="blog-empty">Aún no hay publicaciones. Vuelve pronto.</p>';
        return;
      }
      container.innerHTML = posts
        .map(function (p) {
          var ex = p.excerpt || excerptFromBody(p.body);
          var dateStr = formatDate(p.createdAt);
          return (
            '<article class="blog-card">' +
            '<div class="blog-card-meta">' +
            escapeHtml(dateStr) +
            '</div>' +
            '<h3 class="blog-card-title">' +
            escapeHtml(p.title || 'Sin título') +
            '</h3>' +
            '<p class="blog-card-excerpt">' +
            escapeHtml(ex) +
            '</p>' +
            '<a class="blog-card-link" href="blog/post.html?id=' +
            encodeURIComponent(p.id) +
            '">Leer más</a>' +
            '</article>'
          );
        })
        .join('');
    },

    fillLandingPreview: function () {
      var container = document.getElementById('blog-preview');
      if (!container) return;

      if (!configOk()) {
        container.innerHTML =
          '<p class="blog-msg blog-msg--warn">Blog: configura <code>js/firebase-config.js</code> con tu proyecto Firebase para mostrar entradas.</p>';
        return;
      }

      container.innerHTML =
        '<p class="blog-loading">Cargando entradas…</p>';

      this.listPublished(3)
        .then(
          function (posts) {
            window.blogPublic.renderLandingCards(container, posts);
          }.bind(this)
        )
        .catch(function () {
          container.innerHTML =
            '<p class="blog-msg blog-msg--err">No se pudieron cargar las entradas. Revisa la consola y las reglas de Firestore.</p>';
        });
    },
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('blog-preview')) {
      window.blogPublic.fillLandingPreview();
    }
  });
})();
