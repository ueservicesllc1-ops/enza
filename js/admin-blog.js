(function () {
  var ADMIN_ACCESS_PIN = '2024';
  var MAX_FILE_BYTES = 50 * 1024 * 1024;

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
    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
      try {
        /* Evita cuelgues cuando proxies/antivirus bufferizan mal el streaming a Google */
        firebase.firestore().settings({ experimentalForceLongPolling: true });
      } catch (e) {
        console.warn('[Enza admin] Firestore.settings:', e);
      }
    }
    return true;
  }

  function escapeHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function openAdminGalleryLightbox(src, caption) {
    var lb = $('admin-image-lightbox');
    var img = $('admin-lightbox-img');
    var cap = $('admin-lightbox-caption');
    if (!lb || !img || !src) return;
    img.src = src;
    img.alt = caption ? String(caption) : 'Vista ampliada';
    if (cap) cap.textContent = caption ? String(caption) : '';
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeAdminGalleryLightbox() {
    var lb = $('admin-image-lightbox');
    var img = $('admin-lightbox-img');
    if (lb) lb.hidden = true;
    if (img) {
      img.src = '';
      img.alt = '';
    }
    var cap = $('admin-lightbox-caption');
    if (cap) cap.textContent = '';
    document.body.style.overflow = '';
  }

  function validateFileSize(file, maxBytes) {
    var max = maxBytes || MAX_FILE_BYTES;
    if (file.size > max) {
      throw new Error(
        'Archivo demasiado grande (máx. ' + Math.round(max / (1024 * 1024)) + ' MB): ' + file.name
      );
    }
  }

  function uploadToStorage(file, maxBytes) {
    validateFileSize(file, maxBytes);
    var user = firebase.auth().currentUser;
    if (!user) return Promise.reject(new Error('No hay sesión'));
    var safe = (file.name || 'archivo').replace(/[^a-zA-Z0-9._\-]+/g, '_');
    var path =
      'media/public/' +
      user.uid +
      '/' +
      Date.now() +
      '_' +
      Math.random().toString(36).slice(2, 8) +
      '_' +
      safe;
    var ref = firebase.storage().ref(path);
    return ref.put(file).then(function () {
      return ref.getDownloadURL();
    }).then(function (url) {
      return {
        url: url,
        name: file.name || 'archivo',
        contentType: file.type || 'application/octet-stream',
      };
    });
  }

  /* ========== NAV ========== */
  function switchPanel(panelId) {
    document.querySelectorAll('.admin-side-link').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-panel') === panelId);
    });
    document.querySelectorAll('.admin-panel-page').forEach(function (p) {
      p.hidden = p.id !== 'panel-' + panelId;
    });
  }

  /* ========== BLOG (posts) ========== */
  var editingId = null;
  var pendingCoverFile = null;
  var coverRemoved = false;
  var existingAttachments = [];
  var pendingAttachmentFiles = [];

  function setCoverPreviewFromUrl(url) {
    var wrap = $('post-cover-preview');
    var btn = $('btn-cover-clear');
    if (!wrap) return;
    if (!url) {
      wrap.hidden = true;
      wrap.innerHTML = '';
      if (btn) btn.hidden = true;
      return;
    }
    wrap.hidden = false;
    wrap.innerHTML =
      '<img src="' +
      escapeHtml(url) +
      '" alt="" class="admin-cover-preview-img"/>';
    if (btn) btn.hidden = false;
  }

  function setCoverPreviewFromFile(file) {
    if (!file) return;
    var wrap = $('post-cover-preview');
    var btn = $('btn-cover-clear');
    if (!wrap) return;
    var r = new FileReader();
    r.onload = function () {
      wrap.hidden = false;
      wrap.innerHTML =
        '<img src="' +
        escapeHtml(r.result) +
        '" alt="" class="admin-cover-preview-img"/>';
      if (btn) btn.hidden = false;
    };
    r.readAsDataURL(file);
  }

  function renderAttachmentsList() {
    var ul = $('post-attachments-list');
    if (!ul) return;
    var items = [];
    existingAttachments.forEach(function (a, i) {
      items.push({
        label: a.name || 'Archivo',
        sub: 'En la entrada',
        idx: 'ex-' + i,
      });
    });
    pendingAttachmentFiles.forEach(function (f, i) {
      items.push({
        label: f.name,
        sub: 'Por subir',
        idx: 'pen-' + i,
      });
    });
    if (!items.length) {
      ul.hidden = true;
      ul.innerHTML = '';
      return;
    }
    ul.hidden = false;
    ul.innerHTML = items
      .map(function (it) {
        return (
          '<li class="admin-attachment-row" data-idx="' +
          escapeHtml(it.idx) +
          '"><span class="admin-attachment-name">' +
          escapeHtml(it.label) +
          '</span><span class="admin-attachment-sub">' +
          escapeHtml(it.sub) +
          '</span><button type="button" class="btn-outline admin-btn-small btn-att-remove" data-idx="' +
          escapeHtml(it.idx) +
          '">Quitar</button></li>'
        );
      })
      .join('');
    ul.querySelectorAll('.btn-att-remove').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-idx');
        if (id.indexOf('ex-') === 0) {
          existingAttachments.splice(parseInt(id.slice(3), 10), 1);
        } else {
          pendingAttachmentFiles.splice(parseInt(id.slice(4), 10), 1);
        }
        renderAttachmentsList();
      });
    });
  }

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
            '</span><span class="admin-post-badge">' +
            pub +
            '</span><button type="button" class="btn-admin-edit" data-id="' +
            doc.id +
            '">Editar</button><button type="button" class="btn-admin-delete" data-id="' +
            doc.id +
            '">Eliminar</button>';
          ul.appendChild(li);
        });
        ul.querySelectorAll('.btn-admin-edit').forEach(function (btn) {
          btn.addEventListener('click', function () {
            loadPostIntoForm(btn.getAttribute('data-id'));
            switchPanel('blog');
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
          '<li class="admin-msg admin-msg--err">' + (e.message || 'Error al cargar') + '</li>';
      });
  }

  function resetForm() {
    editingId = null;
    pendingCoverFile = null;
    coverRemoved = false;
    existingAttachments = [];
    pendingAttachmentFiles = [];
    if ($('post-title')) $('post-title').value = '';
    if ($('post-excerpt')) $('post-excerpt').value = '';
    if ($('post-body')) $('post-body').value = '';
    if ($('post-published')) $('post-published').checked = true;
    var cin = $('post-cover');
    if (cin) cin.value = '';
    var ain = $('post-attachments');
    if (ain) ain.value = '';
    setCoverPreviewFromUrl('');
    renderAttachmentsList();
    if ($('admin-form-title')) $('admin-form-title').textContent = 'Nueva entrada';
    msg($('form-msg'), '', '');
  }

  function loadPostIntoForm(id) {
    firebase
      .firestore()
      .collection('posts')
      .doc(id)
      .get()
      .then(function (doc) {
        if (!doc.exists) return;
        var d = doc.data();
        editingId = id;
        pendingCoverFile = null;
        coverRemoved = false;
        pendingAttachmentFiles = [];
        existingAttachments = Array.isArray(d.attachments)
          ? d.attachments.map(function (a) {
              return {
                url: a.url || '',
                name: a.name || 'Archivo',
                contentType: a.contentType || '',
              };
            })
          : [];
        $('post-title').value = d.title || '';
        $('post-excerpt').value = d.excerpt || '';
        $('post-body').value = d.body || '';
        $('post-published').checked = !!d.published;
        if ($('post-cover')) $('post-cover').value = '';
        if ($('post-attachments')) $('post-attachments').value = '';
        setCoverPreviewFromUrl(d.coverImageUrl || '');
        renderAttachmentsList();
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
    var user = firebase.auth().currentUser;
    if (!user) {
      msg($('form-msg'), 'Inicia sesión de nuevo.', 'err');
      return;
    }
    msg($('form-msg'), 'Subiendo archivos…', 'info');
    var uploads = [];
    if (pendingCoverFile) {
      if (!pendingCoverFile.type.match(/^image\//)) {
        msg($('form-msg'), 'La portada debe ser una imagen.', 'err');
        return;
      }
      uploads.push(
        uploadToStorage(pendingCoverFile).then(function (meta) {
          return { kind: 'cover', meta: meta };
        })
      );
    }
    pendingAttachmentFiles.forEach(function (f) {
      uploads.push(
        uploadToStorage(f).then(function (meta) {
          return { kind: 'att', meta: meta };
        })
      );
    });
    Promise.all(uploads)
      .then(function (results) {
        var newCoverUrl = null;
        var newAtts = [];
        results.forEach(function (r) {
          if (r.kind === 'cover') newCoverUrl = r.meta.url;
          else newAtts.push(r.meta);
        });
        var attachments = existingAttachments.concat(newAtts);
        var db = firebase.firestore();
        var payload = {
          title: title,
          excerpt: excerpt,
          body: body,
          published: published,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          attachments: attachments,
        };
        if (editingId) {
          if (coverRemoved && !pendingCoverFile) {
            payload.coverImageUrl = firebase.firestore.FieldValue.delete();
          } else if (newCoverUrl) {
            payload.coverImageUrl = newCoverUrl;
          }
        } else if (newCoverUrl) {
          payload.coverImageUrl = newCoverUrl;
        }
        msg($('form-msg'), 'Guardando…', 'info');
        if (editingId) {
          return db
            .collection('posts')
            .doc(editingId)
            .update(payload)
            .then(function () {
              msg($('form-msg'), 'Guardado.', 'ok');
              pendingCoverFile = null;
              pendingAttachmentFiles = [];
              if ($('post-cover')) $('post-cover').value = '';
              if ($('post-attachments')) $('post-attachments').value = '';
              coverRemoved = false;
              loadPostIntoForm(editingId);
              loadPostsList();
            });
        }
        var ts = firebase.firestore.FieldValue.serverTimestamp();
        payload.createdAt = ts;
        payload.updatedAt = ts;
        return db
          .collection('posts')
          .add(payload)
          .then(function () {
            msg($('form-msg'), 'Entrada creada.', 'ok');
            resetForm();
            loadPostsList();
          });
      })
      .catch(function (err) {
        msg($('form-msg'), err.message || 'Error al guardar', 'err');
      });
  }

  /* ========== GALLERY ========== */
  var editingGalleryId = null;
  var pendingGlImage = null;
  var glImageRemoved = false;

  function glShowPlaceholder() {
    var wrap = $('gl-preview');
    var btn = $('btn-gl-image-clear');
    if (!wrap) return;
    wrap.innerHTML =
      '<div class="admin-gallery-preview-placeholder">Aquí verás la imagen al elegirla</div>';
    if (btn) btn.hidden = true;
  }

  function glPreviewUrl(url) {
    var wrap = $('gl-preview');
    var btn = $('btn-gl-image-clear');
    if (!wrap) return;
    if (!url) {
      glShowPlaceholder();
      return;
    }
    wrap.innerHTML =
      '<img src="' +
      escapeHtml(url) +
      '" alt="" class="admin-gallery-preview-img"/>';
    if (btn) btn.hidden = false;
  }

  function glPreviewFile(file) {
    if (!file) return;
    var wrap = $('gl-preview');
    var btn = $('btn-gl-image-clear');
    if (!wrap) return;
    var r = new FileReader();
    r.onload = function () {
      wrap.innerHTML =
        '<img src="' +
        escapeHtml(r.result) +
        '" alt="" class="admin-gallery-preview-img"/>';
      if (btn) btn.hidden = false;
    };
    r.readAsDataURL(file);
  }

  function resetGalleryForm() {
    editingGalleryId = null;
    pendingGlImage = null;
    glImageRemoved = false;
    if ($('gl-title')) $('gl-title').value = '';
    if ($('gl-category')) $('gl-category').value = 'sesion';
    if ($('gl-layout')) $('gl-layout').value = '';
    if ($('gl-sort')) $('gl-sort').value = '0';
    if ($('gl-published')) $('gl-published').checked = true;
    if ($('gl-image')) $('gl-image').value = '';
    glShowPlaceholder();
    if ($('gallery-form-title')) $('gallery-form-title').textContent = 'Nueva imagen';
    msg($('gl-form-msg'), '', '');
  }

  function loadGalleryList() {
    var ul = $('admin-gallery-list');
    if (!ul) return;
    ul.innerHTML = '<li class="admin-loading">Cargando…</li>';
    firebase
      .firestore()
      .collection('galleryItems')
      .orderBy('updatedAt', 'desc')
      .get()
      .then(function (snap) {
        if (!snap.docs.length) {
          ul.innerHTML = '<li class="admin-empty">No hay imágenes.</li>';
          return;
        }
        ul.innerHTML = '';
        snap.docs.forEach(function (doc) {
          var d = doc.data();
          var li = document.createElement('li');
          li.className = 'admin-post-row admin-post-row--gallery';
          var pub = d.published ? 'Publicada' : 'Borrador';
          var thumbUrl = (d.imageUrl || '').trim();
          var thumbBlock = thumbUrl
            ? '<button type="button" class="admin-gl-thumb" data-gl-full="' +
              escapeHtml(thumbUrl) +
              '" data-gl-title="' +
              escapeHtml(d.title || '') +
              '" title="Ver grande"><img src="' +
              escapeHtml(thumbUrl) +
              '" alt="" loading="lazy" decoding="async" width="96" height="96"/></button>'
            : '<span class="admin-gl-thumb--empty">Sin miniatura</span>';
          li.innerHTML =
            thumbBlock +
            '<span class="admin-post-title">' +
            escapeHtml(d.title || '(sin título)') +
            '</span><span class="admin-post-badge">' +
            pub +
            '</span><button type="button" class="btn-gl-edit" data-id="' +
            doc.id +
            '">Editar</button><button type="button" class="btn-gl-delete" data-id="' +
            doc.id +
            '">Eliminar</button>';
          ul.appendChild(li);
        });
        ul.onclick = function (ev) {
          var t = ev.target.closest('.admin-gl-thumb');
          if (!t || !t.getAttribute('data-gl-full')) return;
          ev.preventDefault();
          openAdminGalleryLightbox(
            t.getAttribute('data-gl-full'),
            t.getAttribute('data-gl-title') || ''
          );
        };
        ul.querySelectorAll('.btn-gl-edit').forEach(function (btn) {
          btn.addEventListener('click', function () {
            loadGalleryIntoForm(btn.getAttribute('data-id'));
            switchPanel('gallery');
          });
        });
        ul.querySelectorAll('.btn-gl-delete').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-id');
            if (!confirm('¿Eliminar esta imagen de la galería?')) return;
            firebase
              .firestore()
              .collection('galleryItems')
              .doc(id)
              .delete()
              .then(function () {
                loadGalleryList();
                resetGalleryForm();
              })
              .catch(function (e) {
                alert(e.message || 'Error');
              });
          });
        });
      })
      .catch(function (e) {
        ul.innerHTML =
          '<li class="admin-msg admin-msg--err">' + (e.message || 'Error') + '</li>';
      });
  }

  function loadGalleryIntoForm(id) {
    firebase
      .firestore()
      .collection('galleryItems')
      .doc(id)
      .get()
      .then(function (doc) {
        if (!doc.exists) return;
        var d = doc.data();
        editingGalleryId = id;
        pendingGlImage = null;
        glImageRemoved = false;
        $('gl-title').value = d.title || '';
        $('gl-category').value = d.category || 'sesion';
        $('gl-layout').value = d.layout || '';
        $('gl-sort').value =
          typeof d.sortOrder === 'number' ? String(d.sortOrder) : '0';
        $('gl-published').checked = !!d.published;
        if ($('gl-image')) $('gl-image').value = '';
        if (d.imageUrl) {
          glPreviewUrl(d.imageUrl);
        } else {
          glShowPlaceholder();
        }
        $('gallery-form-title').textContent = 'Editar imagen';
      });
  }

  function saveGallery(e) {
    e.preventDefault();
    var title = ($('gl-title').value || '').trim();
    var category = ($('gl-category') && $('gl-category').value) || 'otro';
    var layout = ($('gl-layout') && $('gl-layout').value) || '';
    var sortOrder = parseInt(($('gl-sort') && $('gl-sort').value) || '0', 10);
    if (isNaN(sortOrder)) sortOrder = 0;
    var published = $('gl-published').checked;
    if (!editingGalleryId && !pendingGlImage) {
      msg($('gl-form-msg'), 'Selecciona una imagen.', 'err');
      return;
    }
    if (editingGalleryId && glImageRemoved && !pendingGlImage) {
      msg($('gl-form-msg'), 'Debes subir una imagen o no quitar la actual.', 'err');
      return;
    }
    var user = firebase.auth().currentUser;
    if (!user) {
      msg($('gl-form-msg'), 'Sesión requerida.', 'err');
      return;
    }
    msg($('gl-form-msg'), 'Guardando…', 'info');
    var p = Promise.resolve(null);
    if (pendingGlImage) {
      if (!pendingGlImage.type.match(/^image\//)) {
        msg($('gl-form-msg'), 'El archivo debe ser imagen.', 'err');
        return;
      }
      p = uploadToStorage(pendingGlImage).then(function (m) {
        return m.url;
      });
    }
    p.then(function (imageUrl) {
      var db = firebase.firestore();
      var payload = {
        title: title,
        category: category,
        layout: layout,
        sortOrder: sortOrder,
        published: published,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      if (imageUrl) payload.imageUrl = imageUrl;
      else if (editingGalleryId && glImageRemoved) {
        payload.imageUrl = firebase.firestore.FieldValue.delete();
      }
      if (editingGalleryId) {
        return db
          .collection('galleryItems')
          .doc(editingGalleryId)
          .update(payload)
          .then(function () {
            msg($('gl-form-msg'), 'Guardado.', 'ok');
            pendingGlImage = null;
            glImageRemoved = false;
            if ($('gl-image')) $('gl-image').value = '';
            loadGalleryIntoForm(editingGalleryId);
            loadGalleryList();
          });
      }
      if (!imageUrl) {
        msg($('gl-form-msg'), 'Falta imagen.', 'err');
        return;
      }
      var ts = firebase.firestore.FieldValue.serverTimestamp();
      payload.imageUrl = imageUrl;
      payload.createdAt = ts;
      payload.updatedAt = ts;
      return db
        .collection('galleryItems')
        .add(payload)
        .then(function () {
          msg($('gl-form-msg'), 'Imagen creada.', 'ok');
          resetGalleryForm();
          loadGalleryList();
        });
    }).catch(function (err) {
      msg($('gl-form-msg'), err.message || 'Error', 'err');
    });
  }

  /* ========== BOOKS ========== */
  var editingBookId = null;
  var pendingBkCover = null;
  var pendingBkFile = null;
  var bkCoverRemoved = false;
  var bkFileRemoved = false;

  function bkCoverPreview(url) {
    var wrap = $('bk-cover-preview');
    var btn = $('btn-bk-cover-clear');
    if (!wrap) return;
    if (!url) {
      wrap.hidden = true;
      wrap.innerHTML = '';
      if (btn) btn.hidden = true;
      return;
    }
    wrap.hidden = false;
    wrap.innerHTML =
      '<img src="' + escapeHtml(url) + '" alt="" class="admin-cover-preview-img"/>';
    if (btn) btn.hidden = false;
  }

  function bkCoverPreviewFile(file) {
    if (!file) return;
    var wrap = $('bk-cover-preview');
    var btn = $('btn-bk-cover-clear');
    if (!wrap) return;
    var r = new FileReader();
    r.onload = function () {
      wrap.hidden = false;
      wrap.innerHTML =
        '<img src="' + escapeHtml(r.result) + '" alt="" class="admin-cover-preview-img"/>';
      if (btn) btn.hidden = false;
    };
    r.readAsDataURL(file);
  }

  function setBkFileClearVisible(show) {
    var b = $('btn-bk-file-clear');
    if (b) b.hidden = !show;
  }

  function resetBookForm() {
    editingBookId = null;
    pendingBkCover = null;
    pendingBkFile = null;
    bkCoverRemoved = false;
    bkFileRemoved = false;
    if ($('bk-title')) $('bk-title').value = '';
    if ($('bk-description')) $('bk-description').value = '';
    if ($('bk-sort')) $('bk-sort').value = '0';
    if ($('bk-published')) $('bk-published').checked = true;
    if ($('bk-cover')) $('bk-cover').value = '';
    if ($('bk-file')) $('bk-file').value = '';
    bkCoverPreview('');
    setBkFileClearVisible(false);
    if ($('book-form-title')) $('book-form-title').textContent = 'Nuevo libro';
    msg($('bk-form-msg'), '', '');
  }

  function loadBookList() {
    var ul = $('admin-book-list');
    if (!ul) return;
    ul.innerHTML = '<li class="admin-loading">Cargando…</li>';
    firebase
      .firestore()
      .collection('books')
      .orderBy('updatedAt', 'desc')
      .get()
      .then(function (snap) {
        if (!snap.docs.length) {
          ul.innerHTML = '<li class="admin-empty">No hay libros.</li>';
          return;
        }
        ul.innerHTML = '';
        snap.docs.forEach(function (doc) {
          var d = doc.data();
          var li = document.createElement('li');
          li.className = 'admin-post-row';
          var pub = d.published ? 'Publicado' : 'Borrador';
          li.innerHTML =
            '<span class="admin-post-title">' +
            escapeHtml(d.title || '(sin título)') +
            '</span><span class="admin-post-badge">' +
            pub +
            '</span><button type="button" class="btn-bk-edit" data-id="' +
            doc.id +
            '">Editar</button><button type="button" class="btn-bk-delete" data-id="' +
            doc.id +
            '">Eliminar</button>';
          ul.appendChild(li);
        });
        ul.querySelectorAll('.btn-bk-edit').forEach(function (btn) {
          btn.addEventListener('click', function () {
            loadBookIntoForm(btn.getAttribute('data-id'));
            switchPanel('books');
          });
        });
        ul.querySelectorAll('.btn-bk-delete').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-id');
            if (!confirm('¿Eliminar este libro?')) return;
            firebase
              .firestore()
              .collection('books')
              .doc(id)
              .delete()
              .then(function () {
                loadBookList();
                resetBookForm();
              })
              .catch(function (e) {
                alert(e.message || 'Error');
              });
          });
        });
      })
      .catch(function (e) {
        ul.innerHTML =
          '<li class="admin-msg admin-msg--err">' + (e.message || 'Error') + '</li>';
      });
  }

  function loadBookIntoForm(id) {
    firebase
      .firestore()
      .collection('books')
      .doc(id)
      .get()
      .then(function (doc) {
        if (!doc.exists) return;
        var d = doc.data();
        editingBookId = id;
        pendingBkCover = null;
        pendingBkFile = null;
        bkCoverRemoved = false;
        bkFileRemoved = false;
        $('bk-title').value = d.title || '';
        $('bk-description').value = d.description || '';
        $('bk-sort').value =
          typeof d.sortOrder === 'number' ? String(d.sortOrder) : '0';
        $('bk-published').checked = !!d.published;
        if ($('bk-cover')) $('bk-cover').value = '';
        if ($('bk-file')) $('bk-file').value = '';
        bkCoverPreview(d.coverImageUrl || '');
        setBkFileClearVisible(!!d.fileUrl);
        $('book-form-title').textContent = 'Editar libro';
      });
  }

  function saveBook(e) {
    e.preventDefault();
    var title = ($('bk-title').value || '').trim();
    var description = ($('bk-description').value || '').trim();
    var sortOrder = parseInt(($('bk-sort') && $('bk-sort').value) || '0', 10);
    if (isNaN(sortOrder)) sortOrder = 0;
    var published = $('bk-published').checked;
    if (!title) {
      msg($('bk-form-msg'), 'Escribe el título.', 'err');
      return;
    }
    var user = firebase.auth().currentUser;
    if (!user) {
      msg($('bk-form-msg'), 'Sesión requerida.', 'err');
      return;
    }
    msg($('bk-form-msg'), 'Subiendo…', 'info');
    var uploads = [];
    if (pendingBkCover) {
      if (!pendingBkCover.type.match(/^image\//)) {
        msg($('bk-form-msg'), 'La portada debe ser imagen.', 'err');
        return;
      }
      uploads.push(
        uploadToStorage(pendingBkCover).then(function (m) {
          return { k: 'cover', url: m.url };
        })
      );
    }
    if (pendingBkFile) {
      uploads.push(
        uploadToStorage(pendingBkFile).then(function (m) {
          return { k: 'file', url: m.url };
        })
      );
    }
    Promise.all(uploads)
      .then(function (parts) {
        var newCover = null;
        var newFile = null;
        parts.forEach(function (p) {
          if (p.k === 'cover') newCover = p.url;
          if (p.k === 'file') newFile = p.url;
        });
        var db = firebase.firestore();
        var payload = {
          title: title,
          description: description,
          sortOrder: sortOrder,
          published: published,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        if (newCover) payload.coverImageUrl = newCover;
        else if (editingBookId && bkCoverRemoved) {
          payload.coverImageUrl = firebase.firestore.FieldValue.delete();
        }
        if (newFile) payload.fileUrl = newFile;
        else if (editingBookId && bkFileRemoved) {
          payload.fileUrl = firebase.firestore.FieldValue.delete();
        }
        if (editingBookId) {
          return db
            .collection('books')
            .doc(editingBookId)
            .update(payload)
            .then(function () {
              msg($('bk-form-msg'), 'Guardado.', 'ok');
              pendingBkCover = null;
              pendingBkFile = null;
              bkCoverRemoved = false;
              bkFileRemoved = false;
              if ($('bk-cover')) $('bk-cover').value = '';
              if ($('bk-file')) $('bk-file').value = '';
              loadBookIntoForm(editingBookId);
              loadBookList();
            });
        }
        var ts = firebase.firestore.FieldValue.serverTimestamp();
        payload.createdAt = ts;
        payload.updatedAt = ts;
        return db
          .collection('books')
          .add(payload)
          .then(function () {
            msg($('bk-form-msg'), 'Libro creado.', 'ok');
            resetBookForm();
            loadBookList();
          });
      })
      .catch(function (err) {
        msg($('bk-form-msg'), err.message || 'Error', 'err');
      });
  }

  /* ========== MUSIC (tracks) ========== */
  var editingMusicId = null;
  var pendingMuAudio = null;
  var pendingMuCover = null;
  var muCoverRemoved = false;

  function muCoverPreview(url) {
    var wrap = $('mu-cover-preview');
    var btn = $('btn-mu-cover-clear');
    if (!wrap) return;
    if (!url) {
      wrap.hidden = true;
      wrap.innerHTML = '';
      if (btn) btn.hidden = true;
      return;
    }
    wrap.hidden = false;
    wrap.innerHTML =
      '<img src="' + escapeHtml(url) + '" alt="" class="admin-cover-preview-img"/>';
    if (btn) btn.hidden = false;
  }

  function muCoverPreviewFile(file) {
    if (!file) return;
    var wrap = $('mu-cover-preview');
    var btn = $('btn-mu-cover-clear');
    if (!wrap) return;
    var r = new FileReader();
    r.onload = function () {
      wrap.hidden = false;
      wrap.innerHTML =
        '<img src="' + escapeHtml(r.result) + '" alt="" class="admin-cover-preview-img"/>';
      if (btn) btn.hidden = false;
    };
    r.readAsDataURL(file);
  }

  function resetMusicForm() {
    editingMusicId = null;
    pendingMuAudio = null;
    pendingMuCover = null;
    muCoverRemoved = false;
    if ($('mu-title')) $('mu-title').value = '';
    if ($('mu-spotify')) $('mu-spotify').value = '';
    if ($('mu-sort')) $('mu-sort').value = '0';
    if ($('mu-published')) $('mu-published').checked = true;
    if ($('mu-audio')) $('mu-audio').value = '';
    if ($('mu-cover')) $('mu-cover').value = '';
    muCoverPreview('');
    if ($('music-form-title')) $('music-form-title').textContent = 'Nueva canción';
    msg($('mu-form-msg'), '', '');
  }

  function normalizeSpotifyUrl(raw) {
    var s = (raw || '').trim();
    if (!s) return '';
    if (s.indexOf('http://') !== 0 && s.indexOf('https://') !== 0) {
      s = 'https://' + s;
    }
    return s;
  }

  function loadMusicList() {
    var ul = $('admin-music-list');
    if (!ul) return;
    ul.innerHTML = '<li class="admin-loading">Cargando…</li>';
    firebase
      .firestore()
      .collection('musicTracks')
      .orderBy('updatedAt', 'desc')
      .get()
      .then(function (snap) {
        if (!snap.docs.length) {
          ul.innerHTML = '<li class="admin-empty">No hay canciones.</li>';
          return;
        }
        ul.innerHTML = '';
        snap.docs.forEach(function (doc) {
          var d = doc.data();
          var li = document.createElement('li');
          li.className = 'admin-post-row';
          var pub = d.published ? 'Visible' : 'Borrador';
          li.innerHTML =
            '<span class="admin-post-title">' +
            escapeHtml(d.title || '(sin título)') +
            '</span><span class="admin-post-badge">' +
            pub +
            '</span><button type="button" class="btn-mu-edit" data-id="' +
            doc.id +
            '">Editar</button><button type="button" class="btn-mu-delete" data-id="' +
            doc.id +
            '">Eliminar</button>';
          ul.appendChild(li);
        });
        ul.querySelectorAll('.btn-mu-edit').forEach(function (btn) {
          btn.addEventListener('click', function () {
            loadMusicIntoForm(btn.getAttribute('data-id'));
            switchPanel('music');
          });
        });
        ul.querySelectorAll('.btn-mu-delete').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-id');
            if (!confirm('¿Eliminar esta canción?')) return;
            firebase
              .firestore()
              .collection('musicTracks')
              .doc(id)
              .delete()
              .then(function () {
                loadMusicList();
                resetMusicForm();
              })
              .catch(function (e) {
                alert(e.message || 'Error');
              });
          });
        });
      })
      .catch(function (e) {
        ul.innerHTML =
          '<li class="admin-msg admin-msg--err">' + (e.message || 'Error') + '</li>';
      });
  }

  function loadMusicIntoForm(id) {
    firebase
      .firestore()
      .collection('musicTracks')
      .doc(id)
      .get()
      .then(function (doc) {
        if (!doc.exists) return;
        var d = doc.data();
        editingMusicId = id;
        pendingMuAudio = null;
        pendingMuCover = null;
        muCoverRemoved = false;
        $('mu-title').value = d.title || '';
        $('mu-spotify').value = d.spotifyUrl || '';
        $('mu-sort').value =
          typeof d.sortOrder === 'number' ? String(d.sortOrder) : '0';
        $('mu-published').checked = !!d.published;
        if ($('mu-audio')) $('mu-audio').value = '';
        if ($('mu-cover')) $('mu-cover').value = '';
        muCoverPreview(d.coverImageUrl || '');
        $('music-form-title').textContent = 'Editar canción';
      });
  }

  function saveMusic(e) {
    e.preventDefault();
    var title = ($('mu-title').value || '').trim() || 'Sin título';
    var spotifyUrl = normalizeSpotifyUrl($('mu-spotify').value);
    var sortOrder = parseInt(($('mu-sort') && $('mu-sort').value) || '0', 10);
    if (isNaN(sortOrder)) sortOrder = 0;
    var published = $('mu-published').checked;
    if (!spotifyUrl) {
      msg($('mu-form-msg'), 'Pega el enlace de Spotify.', 'err');
      return;
    }
    if (spotifyUrl.toLowerCase().indexOf('spotify.com') === -1 &&
        spotifyUrl.toLowerCase().indexOf('spotify.link') === -1) {
      msg(
        $('mu-form-msg'),
        'El enlace debe ser de Spotify (open.spotify.com, spotify.link, etc.).',
        'err'
      );
      return;
    }
    if (!editingMusicId && !pendingMuAudio) {
      msg($('mu-form-msg'), 'Selecciona un archivo de audio.', 'err');
      return;
    }
    var user = firebase.auth().currentUser;
    if (!user) {
      msg($('mu-form-msg'), 'Sesión requerida.', 'err');
      return;
    }
    msg($('mu-form-msg'), 'Subiendo…', 'info');
    var uploads = [];
    if (pendingMuAudio) {
      uploads.push(
        uploadToStorage(pendingMuAudio).then(function (m) {
          return { k: 'audio', url: m.url };
        })
      );
    }
    if (pendingMuCover) {
      if (!pendingMuCover.type.match(/^image\//)) {
        msg($('mu-form-msg'), 'La portada debe ser imagen.', 'err');
        return;
      }
      uploads.push(
        uploadToStorage(pendingMuCover).then(function (m) {
          return { k: 'cover', url: m.url };
        })
      );
    }
    Promise.all(uploads)
      .then(function (parts) {
        var newAudio = null;
        var newCover = null;
        parts.forEach(function (p) {
          if (p.k === 'audio') newAudio = p.url;
          if (p.k === 'cover') newCover = p.url;
        });
        var db = firebase.firestore();
        var payload = {
          title: title,
          spotifyUrl: spotifyUrl,
          sortOrder: sortOrder,
          published: published,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        if (newAudio) payload.audioUrl = newAudio;
        if (newCover) payload.coverImageUrl = newCover;
        else if (editingMusicId && muCoverRemoved) {
          payload.coverImageUrl = firebase.firestore.FieldValue.delete();
        }
        if (editingMusicId) {
          return db
            .collection('musicTracks')
            .doc(editingMusicId)
            .update(payload)
            .then(function () {
              msg($('mu-form-msg'), 'Guardado.', 'ok');
              pendingMuAudio = null;
              pendingMuCover = null;
              muCoverRemoved = false;
              if ($('mu-audio')) $('mu-audio').value = '';
              if ($('mu-cover')) $('mu-cover').value = '';
              loadMusicIntoForm(editingMusicId);
              loadMusicList();
            });
        }
        if (!newAudio) {
          msg($('mu-form-msg'), 'Falta archivo de audio.', 'err');
          return;
        }
        var ts = firebase.firestore.FieldValue.serverTimestamp();
        payload.audioUrl = newAudio;
        payload.createdAt = ts;
        payload.updatedAt = ts;
        return db
          .collection('musicTracks')
          .add(payload)
          .then(function () {
            msg($('mu-form-msg'), 'Canción creada.', 'ok');
            resetMusicForm();
            loadMusicList();
          });
      })
      .catch(function (err) {
        msg($('mu-form-msg'), err.message || 'Error', 'err');
      });
  }

  /* ========== VIDEOS (YouTube links) ========== */
  var editingVideoId = null;

  function extractYoutubeVideoId(url) {
    if (!url || typeof url !== 'string') return '';
    var s = url.trim();
    var m;
    if ((m = s.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/))) return m[1];
    if ((m = s.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/))) return m[1];
    if ((m = s.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/))) return m[1];
    if ((m = s.match(/youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/))) return m[1];
    if ((m = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/))) return m[1];
    if ((m = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/))) return m[1];
    return '';
  }

  function resetVideoForm() {
    editingVideoId = null;
    if ($('vid-title')) $('vid-title').value = '';
    if ($('vid-youtube')) $('vid-youtube').value = '';
    if ($('vid-sort')) $('vid-sort').value = '0';
    if ($('vid-published')) $('vid-published').checked = true;
    if ($('video-form-title')) $('video-form-title').textContent = 'Nuevo video';
    msg($('vid-form-msg'), '', '');
  }

  function loadVideoList() {
    var ul = $('admin-video-list');
    if (!ul) return;
    ul.innerHTML = '<li class="admin-loading">Cargando…</li>';
    firebase
      .firestore()
      .collection('videoItems')
      .orderBy('updatedAt', 'desc')
      .get()
      .then(function (snap) {
        if (!snap.docs.length) {
          ul.innerHTML = '<li class="admin-empty">No hay videos.</li>';
          return;
        }
        ul.innerHTML = '';
        snap.docs.forEach(function (doc) {
          var d = doc.data();
          var li = document.createElement('li');
          li.className = 'admin-post-row';
          var pub = d.published ? 'Visible' : 'Borrador';
          li.innerHTML =
            '<span class="admin-post-title">' +
            escapeHtml(d.title || extractYoutubeVideoId(d.youtubeUrl || '') || '(sin título)') +
            '</span><span class="admin-post-badge">' +
            pub +
            '</span><button type="button" class="btn-vid-edit" data-id="' +
            doc.id +
            '">Editar</button><button type="button" class="btn-vid-delete" data-id="' +
            doc.id +
            '">Eliminar</button>';
          ul.appendChild(li);
        });
        ul.querySelectorAll('.btn-vid-edit').forEach(function (btn) {
          btn.addEventListener('click', function () {
            loadVideoIntoForm(btn.getAttribute('data-id'));
            switchPanel('videos');
          });
        });
        ul.querySelectorAll('.btn-vid-delete').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-id');
            if (!confirm('¿Eliminar este video?')) return;
            firebase
              .firestore()
              .collection('videoItems')
              .doc(id)
              .delete()
              .then(function () {
                loadVideoList();
                resetVideoForm();
              })
              .catch(function (e) {
                alert(e.message || 'Error');
              });
          });
        });
      })
      .catch(function (e) {
        ul.innerHTML =
          '<li class="admin-msg admin-msg--err">' + (e.message || 'Error') + '</li>';
      });
  }

  function loadVideoIntoForm(id) {
    firebase
      .firestore()
      .collection('videoItems')
      .doc(id)
      .get()
      .then(function (doc) {
        if (!doc.exists) return;
        var d = doc.data();
        editingVideoId = id;
        $('vid-title').value = d.title || '';
        $('vid-youtube').value = d.youtubeUrl || '';
        $('vid-sort').value =
          typeof d.sortOrder === 'number' ? String(d.sortOrder) : '0';
        $('vid-published').checked = !!d.published;
        $('video-form-title').textContent = 'Editar video';
      });
  }

  function reportVideoSaveError(err) {
    console.error('[Enza admin] Error al guardar video:', err);
    var m = err && err.message ? String(err.message) : 'Error al guardar';
    if (err && err.code) m += ' (' + err.code + ')';
    msg($('vid-form-msg'), m, 'err');
  }

  /** Si Firestore no contesta (promesa colgada), forzamos error para no quedarse en “Guardando…” */
  function firestoreOpWithTimeout(promise, ms) {
    var msec = ms || 45000;
    var finished = false;
    var timeoutErr = new Error(
      'Sin respuesta de Firestore en ' +
        Math.round(msec / 1000) +
        ' s. Revisa F12 → Red: peticiones a firestore.googleapis.com. Desactiva bloqueadores, VPN o prueba otra red.'
    );
    return new Promise(function (resolve, reject) {
      var to = setTimeout(function () {
        if (finished) return;
        finished = true;
        reject(timeoutErr);
      }, msec);
      promise.then(
        function (v) {
          if (finished) return;
          finished = true;
          clearTimeout(to);
          resolve(v);
        },
        function (e) {
          if (finished) return;
          finished = true;
          clearTimeout(to);
          reject(e);
        }
      );
    });
  }

  function saveVideo(e) {
    e.preventDefault();
    if (!firebase.auth().currentUser) {
      msg(
        $('vid-form-msg'),
        'No hay sesión. Cierra el panel, vuelve a entrar con el PIN y prueba otra vez.',
        'err'
      );
      return;
    }
    var title = ($('vid-title').value || '').trim() || 'Video';
    var youtubeUrl = ($('vid-youtube').value || '').trim();
    var sortOrder = parseInt(($('vid-sort') && $('vid-sort').value) || '0', 10);
    if (isNaN(sortOrder)) sortOrder = 0;
    var published = $('vid-published').checked;
    if (!youtubeUrl) {
      msg($('vid-form-msg'), 'Pega el enlace de YouTube.', 'err');
      return;
    }
    if (!extractYoutubeVideoId(youtubeUrl)) {
      msg(
        $('vid-form-msg'),
        'No se reconoce el ID del video. Usa watch, youtu.be, Shorts, embed o /live/.',
        'err'
      );
      return;
    }
    var db = firebase.firestore();
    var payload = {
      title: title,
      youtubeUrl: youtubeUrl,
      sortOrder: sortOrder,
      published: published,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    msg($('vid-form-msg'), 'Guardando…', 'info');
    console.info('[Enza admin] Enviando video a Firestore…', {
      editando: !!editingVideoId,
      uid: firebase.auth().currentUser && firebase.auth().currentUser.uid,
    });
    var submitBtn =
      $('video-form') && $('video-form').querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    var slowTimer = setTimeout(function () {
      msg(
        $('vid-form-msg'),
        'Sigue esperando a Firestore… Revisa F12 → Red (firestore.googleapis.com).',
        'info'
      );
      console.warn(
        '[Enza admin] Llevas ~12 s esperando a Firestore. Si no hay líneas rojas en Consola, mira la pestaña Red.'
      );
    }, 12000);
    function done() {
      clearTimeout(slowTimer);
      if (submitBtn) submitBtn.disabled = false;
    }
    if (editingVideoId) {
      firestoreOpWithTimeout(
        db.collection('videoItems').doc(editingVideoId).update(payload),
        45000
      )
        .then(function () {
          done();
          msg($('vid-form-msg'), 'Guardado.', 'ok');
          loadVideoIntoForm(editingVideoId);
          loadVideoList();
        })
        .catch(function (err) {
          done();
          reportVideoSaveError(err);
        });
      return;
    }
    var ts = firebase.firestore.FieldValue.serverTimestamp();
    payload.createdAt = ts;
    payload.updatedAt = ts;
    firestoreOpWithTimeout(db.collection('videoItems').add(payload), 45000)
      .then(function () {
        done();
        msg($('vid-form-msg'), 'Video añadido.', 'ok');
        resetVideoForm();
        loadVideoList();
      })
      .catch(function (err) {
        done();
        reportVideoSaveError(err);
      });
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
      var pinBad = $('login-pin');
      if (pinBad) pinBad.disabled = true;
      $('btn-login').disabled = true;
      return;
    }
    if (cfgNote) cfgNote.hidden = true;
    if (!ensureApp()) return;

    document.querySelectorAll('.admin-side-link').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchPanel(btn.getAttribute('data-panel'));
      });
    });

    var adminLb = $('admin-image-lightbox');
    if (adminLb) {
      adminLb.addEventListener('click', function (e) {
        if (e.target === adminLb) closeAdminGalleryLightbox();
      });
      var lbClose = adminLb.querySelector('.admin-lightbox-close');
      if (lbClose) {
        lbClose.addEventListener('click', function (e) {
          e.stopPropagation();
          closeAdminGalleryLightbox();
        });
      }
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var lb = $('admin-image-lightbox');
      if (lb && !lb.hidden) closeAdminGalleryLightbox();
    });

    var glp = $('gl-preview');
    if (glp) {
      glp.addEventListener('click', function (ev) {
        var im = ev.target.closest('img.admin-gallery-preview-img');
        if (!im) return;
        var src = im.getAttribute('src');
        if (!src) return;
        var titEl = $('gl-title');
        var tit = titEl && titEl.value ? titEl.value.trim() : '';
        openAdminGalleryLightbox(src, tit);
      });
    }

    /* Blog file inputs */
    var coverIn = $('post-cover');
    if (coverIn) {
      coverIn.addEventListener('change', function () {
        var f = coverIn.files && coverIn.files[0];
        pendingCoverFile = f || null;
        coverRemoved = false;
        if (f) {
          try {
            validateFileSize(f);
          } catch (err) {
            msg($('form-msg'), err.message, 'err');
            coverIn.value = '';
            pendingCoverFile = null;
            return;
          }
          setCoverPreviewFromFile(f);
        } else {
          setCoverPreviewFromUrl('');
        }
      });
    }
    var btnClear = $('btn-cover-clear');
    if (btnClear) {
      btnClear.addEventListener('click', function () {
        pendingCoverFile = null;
        coverRemoved = true;
        if (coverIn) coverIn.value = '';
        setCoverPreviewFromUrl('');
      });
    }
    var attIn = $('post-attachments');
    if (attIn) {
      attIn.addEventListener('change', function () {
        if (!attIn.files || !attIn.files.length) return;
        for (var i = 0; i < attIn.files.length; i++) {
          try {
            validateFileSize(attIn.files[i]);
            pendingAttachmentFiles.push(attIn.files[i]);
          } catch (err) {
            msg($('form-msg'), err.message, 'err');
          }
        }
        attIn.value = '';
        renderAttachmentsList();
      });
    }

    /* Gallery */
    var glIn = $('gl-image');
    if (glIn) {
      glIn.addEventListener('change', function () {
        var f = glIn.files && glIn.files[0];
        pendingGlImage = f || null;
        glImageRemoved = false;
        if (f) {
          try {
            validateFileSize(f);
          } catch (err) {
            msg($('gl-form-msg'), err.message, 'err');
            glIn.value = '';
            pendingGlImage = null;
            return;
          }
          glPreviewFile(f);
        } else {
          glShowPlaceholder();
        }
      });
    }
    var btnGlClr = $('btn-gl-image-clear');
    if (btnGlClr) {
      btnGlClr.addEventListener('click', function () {
        pendingGlImage = null;
        glImageRemoved = true;
        if (glIn) glIn.value = '';
        glShowPlaceholder();
      });
    }
    if ($('gallery-form')) $('gallery-form').addEventListener('submit', saveGallery);
    if ($('btn-new-gallery'))
      $('btn-new-gallery').addEventListener('click', function () {
        resetGalleryForm();
      });

    /* Books */
    var bkC = $('bk-cover');
    if (bkC) {
      bkC.addEventListener('change', function () {
        var f = bkC.files && bkC.files[0];
        pendingBkCover = f || null;
        bkCoverRemoved = false;
        if (f) {
          try {
            validateFileSize(f);
          } catch (err) {
            msg($('bk-form-msg'), err.message, 'err');
            bkC.value = '';
            pendingBkCover = null;
            return;
          }
          bkCoverPreviewFile(f);
        } else {
          bkCoverPreview('');
        }
      });
    }
    var btnBkCC = $('btn-bk-cover-clear');
    if (btnBkCC) {
      btnBkCC.addEventListener('click', function () {
        pendingBkCover = null;
        bkCoverRemoved = true;
        if (bkC) bkC.value = '';
        bkCoverPreview('');
      });
    }
    var bkF = $('bk-file');
    if (bkF) {
      bkF.addEventListener('change', function () {
        var f = bkF.files && bkF.files[0];
        pendingBkFile = f || null;
        bkFileRemoved = false;
        if (f) {
          try {
            validateFileSize(f);
          } catch (err) {
            msg($('bk-form-msg'), err.message, 'err');
            bkF.value = '';
            pendingBkFile = null;
          }
        }
      });
    }
    var btnBkFileClr = $('btn-bk-file-clear');
    if (btnBkFileClr) {
      btnBkFileClr.addEventListener('click', function () {
        pendingBkFile = null;
        bkFileRemoved = true;
        if (bkF) bkF.value = '';
        setBkFileClearVisible(false);
      });
    }
    if ($('book-form')) $('book-form').addEventListener('submit', saveBook);
    if ($('btn-new-book'))
      $('btn-new-book').addEventListener('click', function () {
        resetBookForm();
      });

    var muA = $('mu-audio');
    if (muA) {
      muA.addEventListener('change', function () {
        pendingMuAudio = (muA.files && muA.files[0]) || null;
      });
    }
    var muC = $('mu-cover');
    if (muC) {
      muC.addEventListener('change', function () {
        var f = muC.files && muC.files[0];
        pendingMuCover = f || null;
        muCoverRemoved = false;
        if (f) {
          try {
            validateFileSize(f);
          } catch (err) {
            msg($('mu-form-msg'), err.message, 'err');
            muC.value = '';
            pendingMuCover = null;
            return;
          }
          muCoverPreviewFile(f);
        } else {
          muCoverPreview('');
        }
      });
    }
    var btnMuCC = $('btn-mu-cover-clear');
    if (btnMuCC) {
      btnMuCC.addEventListener('click', function () {
        pendingMuCover = null;
        muCoverRemoved = true;
        if (muC) muC.value = '';
        muCoverPreview('');
      });
    }
    if ($('music-form')) $('music-form').addEventListener('submit', saveMusic);
    if ($('btn-new-music'))
      $('btn-new-music').addEventListener('click', function () {
        resetMusicForm();
      });

    if ($('video-form')) $('video-form').addEventListener('submit', saveVideo);
    if ($('btn-new-video'))
      $('btn-new-video').addEventListener('click', function () {
        resetVideoForm();
      });

    firebase.auth().onAuthStateChanged(function (user) {
      var lo = $('btn-logout');
      if (lo) lo.hidden = !user;
      if (user) {
        showLogin(false);
        switchPanel('gallery');
        loadGalleryList();
        loadPostsList();
        loadBookList();
        loadMusicList();
        loadVideoList();
      } else {
        showLogin(true);
      }
    });

    function tryAdminLogin() {
      var pin = (($('login-pin') && $('login-pin').value) || '').trim();
      msg($('login-msg'), '', '');
      if (pin !== ADMIN_ACCESS_PIN) {
        msg($('login-msg'), 'PIN incorrecto.', 'err');
        return;
      }
      msg($('login-msg'), 'Abriendo sesión…', 'info');
      firebase
        .auth()
        .signInAnonymously()
        .then(function () {
          msg($('login-msg'), '', '');
          var inp = $('login-pin');
          if (inp) inp.value = '';
        })
        .catch(function (e) {
          msg(
            $('login-msg'),
            e.message ||
              'No se pudo iniciar sesión anónima. Activa «Anónimo» en Firebase Authentication.',
            'err'
          );
        });
    }

    $('btn-login').addEventListener('click', tryAdminLogin);
    var pinInput = $('login-pin');
    if (pinInput) {
      pinInput.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          tryAdminLogin();
        }
      });
    }

    $('btn-logout').addEventListener('click', function () {
      firebase.auth().signOut();
      resetForm();
      resetGalleryForm();
      resetBookForm();
      resetMusicForm();
      resetVideoForm();
    });

    $('post-form').addEventListener('submit', savePost);
    $('btn-new-post').addEventListener('click', function () {
      resetForm();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
