(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function msg(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.className = 'admin-msg admin-msg--' + (kind || 'info');
    el.hidden = !text;
  }

  function configOk() {
    var c = window.FIREBASE_CONFIG;
    if (!c || !c.apiKey || c.apiKey.indexOf('REEMPLAZA') === 0) return false;
    if (!c.projectId || c.projectId === 'tu-proyecto') return false;
    return true;
  }

  function ensureApp() {
    if (!configOk()) return false;
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    return true;
  }

  var editingId = null;

  function loadPostsList() {
    var db = firebase.firestore();
    var ul = $('admin-post-list');
    if (!ul) return;
    ul.innerHTML = '<li class="admin-loading">Cargando…</li>';

    db.collection('posts')
      .orderBy('updatedAt', 'desc')
      .get()
      .then(function (snap) {
        if (!snap.docs.length) {
          ul.innerHTML = '<li class="admin-empty">No hay entradas todavía.</li>';
          return;
        }
        ul.innerHTML = '';
        snap.docs.forEach(function (doc) {
          var d = doc.data();
          var li = document.createElement('li');
          li.className = 'admin-post-row';
          var pub = d.published ? 'Publicada' : 'Borrador';
          li.innerHTML =
            '<span class="admin-post-title">' +
            escapeHtml(d.title || '(sin título)') +
            '</span>' +
            '<span class="admin-post-badge">' +
            pub +
            '</span>' +
            '<button type="button" class="btn-admin-edit" data-id="' +
            doc.id +
            '">Editar</button>' +
            '<button type="button" class="btn-admin-delete" data-id="' +
            doc.id +
            '">Eliminar</button>';
          ul.appendChild(li);
        });

        ul.querySelectorAll('.btn-admin-edit').forEach(function (btn) {
          btn.addEventListener('click', function () {
            loadPostIntoForm(btn.getAttribute('data-id'));
          });
        });
        ul.querySelectorAll('.btn-admin-delete').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-id');
            if (!confirm('¿Eliminar esta entrada?')) return;
            db.collection('posts')
              .doc(id)
              .delete()
              .then(function () {
                loadPostsList();
                resetForm();
              })
              .catch(function (e) {
                alert(e.message || 'Error al eliminar');
              });
          });
        });
      })
      .catch(function (e) {
        ul.innerHTML =
          '<li class="admin-msg admin-msg--err">' +
          (e.message || 'Error al cargar') +
          '</li>';
      });
  }

  function escapeHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function resetForm() {
    editingId = null;
    $('post-title').value = '';
    $('post-excerpt').value = '';
    $('post-body').value = '';
    $('post-published').checked = false;
    $('admin-form-title').textContent = 'Nueva entrada';
    msg($('form-msg'), '', '');
  }

  function loadPostIntoForm(id) {
    var db = firebase.firestore();
    db.collection('posts')
      .doc(id)
      .get()
      .then(function (doc) {
        if (!doc.exists) return;
        var d = doc.data();
        editingId = id;
        $('post-title').value = d.title || '';
        $('post-excerpt').value = d.excerpt || '';
        $('post-body').value = d.body || '';
        $('post-published').checked = !!d.published;
        $('admin-form-title').textContent = 'Editar entrada';
        $('post-body').focus();
      });
  }

  function savePost(e) {
    e.preventDefault();
    var title = ($('post-title').value || '').trim();
    var body = ($('post-body').value || '').trim();
    var excerpt = ($('post-excerpt').value || '').trim();
    var published = $('post-published').checked;

    if (!title) {
      msg($('form-msg'), 'Escribe un título.', 'err');
      return;
    }
    if (!body) {
      msg($('form-msg'), 'Escribe el contenido.', 'err');
      return;
    }

    if (!excerpt) excerpt = body.replace(/\s+/g, ' ').slice(0, 200).trim();

    var db = firebase.firestore();
    var payload = {
      title: title,
      excerpt: excerpt,
      body: body,
      published: published,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    msg($('form-msg'), 'Guardando…', 'info');

    if (editingId) {
      db.collection('posts')
        .doc(editingId)
        .update(payload)
        .then(function () {
          msg($('form-msg'), 'Guardado.', 'ok');
          loadPostsList();
        })
        .catch(function (err) {
          msg($('form-msg'), err.message || 'Error al guardar', 'err');
        });
    } else {
      var ts = firebase.firestore.FieldValue.serverTimestamp();
      payload.createdAt = ts;
      payload.updatedAt = ts;
      db.collection('posts')
        .add(payload)
        .then(function () {
          msg($('form-msg'), 'Publicado en borrador o visible según el interruptor.', 'ok');
          resetForm();
          loadPostsList();
        })
        .catch(function (err) {
          msg($('form-msg'), err.message || 'Error al crear', 'err');
        });
    }
  }

  function showLogin(show) {
    $('login-panel').hidden = !show;
    $('admin-panel').hidden = show;
  }

  function init() {
    var cfgNote = $('config-missing');
    if (!configOk()) {
      if (cfgNote) cfgNote.hidden = false;
      showLogin(true);
      $('login-email').disabled = true;
      $('login-password').disabled = true;
      $('btn-login').disabled = true;
      return;
    }
    if (cfgNote) cfgNote.hidden = true;

    if (!ensureApp()) return;

    firebase.auth().onAuthStateChanged(function (user) {
      var lo = $('btn-logout');
      if (lo) lo.hidden = !user;
      if (user) {
        showLogin(false);
        loadPostsList();
      } else {
        showLogin(true);
      }
    });

    $('btn-login').addEventListener('click', function () {
      var email = ($('login-email').value || '').trim();
      var pass = $('login-password').value || '';
      msg($('login-msg'), '', '');
      firebase
        .auth()
        .signInWithEmailAndPassword(email, pass)
        .catch(function (e) {
          msg($('login-msg'), e.message || 'Error de acceso', 'err');
        });
    });

    $('btn-logout').addEventListener('click', function () {
      firebase.auth().signOut();
      resetForm();
    });

    $('btn-register').addEventListener('click', function () {
      var email = ($('login-email').value || '').trim();
      var pass = $('login-password').value || '';
      msg($('login-msg'), '', '');
      firebase
        .auth()
        .createUserWithEmailAndPassword(email, pass)
        .catch(function (e) {
          msg($('login-msg'), e.message || 'No se pudo crear la cuenta', 'err');
        });
    });

    $('post-form').addEventListener('submit', savePost);
    $('btn-new-post').addEventListener('click', function () {
      resetForm();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
