/**
 * Galería, libros, música y videos (YouTube) desde Firestore (solo publicados).
 * Requiere firebase-app-compat, firestore-compat y js/firebase-config.js antes que app.js.
 */
(function () {
  function configOk() {
    var c = window.FIREBASE_CONFIG;
    if (!c || !c.apiKey || String(c.apiKey).indexOf('REEMPLAZA') === 0) return false;
    if (!c.projectId || c.projectId === 'tu-proyecto') return false;
    return true;
  }

  function ensureApp() {
    if (!configOk()) return false;
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    return true;
  }

  /** Orden por sortOrder en cliente (evita índice compuesto published + sortOrder). */
  function sortDocsBySortOrder(docs) {
    return docs.slice().sort(function (a, b) {
      var da = a.data();
      var db = b.data();
      var sa =
        typeof da.sortOrder === 'number'
          ? da.sortOrder
          : parseInt(String(da.sortOrder != null ? da.sortOrder : '0'), 10);
      var sb =
        typeof db.sortOrder === 'number'
          ? db.sortOrder
          : parseInt(String(db.sortOrder != null ? db.sortOrder : '0'), 10);
      if (isNaN(sa)) sa = 0;
      if (isNaN(sb)) sb = 0;
      return sa - sb;
    });
  }

  function escapeHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

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

  function fillVideos() {
    var root = document.getElementById('video-grid-root');
    if (!root) return;
    if (!configOk()) {
      root.innerHTML =
        '<p class="video-fs-msg">Configura Firebase para mostrar videos.</p>';
      return;
    }
    ensureApp();
    root.innerHTML = '<p class="video-fs-msg">Cargando videos…</p>';
    firebase
      .firestore()
      .collection('videoItems')
      .get()
      .then(function (snap) {
        var docs = sortDocsBySortOrder(snap.docs);
        if (!docs.length) {
          root.innerHTML =
            '<p class="video-fs-msg">Aún no hay videos. Añádelos desde el panel admin.</p>';
          return;
        }
        root.innerHTML = '';
        docs.forEach(function (doc) {
          var t = doc.data();
          var id = extractYoutubeVideoId(t.youtubeUrl || '');
          if (!id) return;
          var title = t.title || 'Video';
          var thumb = 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg';
          var art = document.createElement('article');
          art.className = 'video-card video-card--thumb';
          art.innerHTML =
            '<button type="button" class="video-thumb-btn" data-youtube-id="' +
            escapeHtml(id) +
            '" aria-label="Reproducir: ' +
            escapeHtml(title) +
            '"><img src="' +
            escapeHtml(thumb) +
            '" alt="" width="480" height="360" loading="lazy"><span class="video-play"><i data-lucide="play"></i></span></button><h3 class="video-card-title">' +
            escapeHtml(title) +
            '</h3>';
          root.appendChild(art);
        });
        root.onclick = function (ev) {
          var btn = ev.target.closest('.video-thumb-btn');
          if (!btn) return;
          var yid = btn.getAttribute('data-youtube-id');
          if (!yid || typeof window.openVideo !== 'function') return;
          window.openVideo(
            'https://www.youtube.com/embed/' + yid + '?autoplay=1&rel=0'
          );
        };
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      })
      .catch(function (err) {
        console.error('[Enza] Videos:', err);
        root.innerHTML =
          '<p class="video-fs-msg">No se pudieron cargar los videos. Revisa reglas de Firestore o la conexión.</p>';
      });
  }

  function fillGallery() {
    var root = document.getElementById('gallery-grid-root');
    if (!root) return;
    if (!configOk()) {
      root.innerHTML =
        '<p class="gallery-fs-msg">Configura Firebase para cargar la galería desde el panel.</p>';
      return;
    }
    ensureApp();
    root.innerHTML = '<p class="gallery-fs-msg">Cargando galería…</p>';
    firebase
      .firestore()
      .collection('galleryItems')
      .get()
      .then(function (snap) {
        var docs = sortDocsBySortOrder(snap.docs);
        if (!docs.length) {
          root.innerHTML =
            '<p class="gallery-fs-msg">Aún no hay fotos en la galería. Súbelas desde el panel admin.</p>';
          return;
        }
        root.innerHTML = '';
        docs.forEach(function (doc) {
          var p = doc.data();
          var url = p.imageUrl || '';
          if (!url) return;
          var layout = p.layout || '';
          var cat = p.category || 'otro';
          var title = p.title || '';
          var el = document.createElement('div');
          el.className = 'gallery-item' + (layout ? ' ' + layout : '');
          el.setAttribute('data-cat', cat);
          el.setAttribute('role', 'button');
          el.setAttribute('tabindex', '0');
          el.innerHTML =
            '<img src="' +
            escapeHtml(url) +
            '" alt="' +
            escapeHtml(title) +
            '" loading="lazy">' +
            '<div class="gallery-overlay"><span class="gallery-overlay-label"><i data-lucide="maximize-2" aria-hidden="true"></i> Ver</span></div>';
          el.addEventListener('click', function () {
            if (typeof window.openLightbox === 'function') {
              window.openLightbox(url, title);
            }
          });
          el.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              if (typeof window.openLightbox === 'function') {
                window.openLightbox(url, title);
              }
            }
          });
          root.appendChild(el);
        });
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      })
      .catch(function (err) {
        console.error('[Enza] Galería:', err);
        root.innerHTML =
          '<p class="gallery-fs-msg">No se pudo cargar la galería. Revisa reglas de Firestore o la conexión.</p>';
      });
  }

  var MUSIC_PREVIEW_MAX = 30;

  window.enzaMusicPreview = (function () {
    var current = { audio: null, url: null, btn: null };

    function fmt(t) {
      var m = Math.floor(t / 60);
      var s = Math.floor(t % 60);
      return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function clearBtn(btn) {
      if (!btn) return;
      btn.textContent = 'Vista previa (30 s)';
      btn.classList.remove('is-playing');
      var row = btn.closest('.music-preview-row');
      var timeEl = row && row.querySelector('.music-preview-time');
      if (timeEl) timeEl.textContent = '';
    }

    function stop() {
      var b = current.btn;
      if (current.audio) {
        current.audio.pause();
        current.audio.removeAttribute('src');
        current.audio.load();
      }
      clearBtn(b);
      current.audio = null;
      current.url = null;
      current.btn = null;
    }

    function toggle(btn, url) {
      if (!url || !btn) return;
      if (current.audio && current.url === url) {
        if (current.audio.paused) {
          current.audio.play();
          btn.textContent = 'Pausa';
          btn.classList.add('is-playing');
        } else {
          current.audio.pause();
          clearBtn(btn);
        }
        return;
      }
      stop();
      current.btn = btn;
      current.url = url;
      var a = new Audio(url);
      current.audio = a;
      a.preload = 'auto';
      var row = btn.closest('.music-preview-row');
      var timeEl = row && row.querySelector('.music-preview-time');
      a.addEventListener('timeupdate', function () {
        if (a.currentTime >= MUSIC_PREVIEW_MAX) {
          a.pause();
          a.currentTime = 0;
          stop();
          return;
        }
        if (timeEl) {
          timeEl.textContent =
            fmt(a.currentTime) + ' / ' + fmt(MUSIC_PREVIEW_MAX);
        }
      });
      a.addEventListener('seeking', function () {
        if (a.currentTime > MUSIC_PREVIEW_MAX) {
          a.currentTime = 0;
        }
      });
      a.addEventListener('ended', function () {
        stop();
      });
      a.play().catch(function () {
        stop();
        if (timeEl) timeEl.textContent = 'No se pudo reproducir';
      });
      btn.textContent = 'Pausa';
      btn.classList.add('is-playing');
    }

    return { toggle: toggle, stop: stop };
  })();

  function fillMusic() {
    var root = document.getElementById('music-grid-root');
    if (!root) return;
    if (!configOk()) {
      root.innerHTML =
        '<p class="music-fs-msg">Configura Firebase para mostrar canciones desde /admin/ → Música.</p>';
      return;
    }
    ensureApp();
    root.innerHTML = '<p class="music-fs-msg">Cargando música…</p>';
    firebase
      .firestore()
      .collection('musicTracks')
      .get()
      .then(function (snap) {
        var docs = sortDocsBySortOrder(snap.docs);
        if (!docs.length) {
          root.innerHTML =
            '<p class="music-fs-msg">Aún no hay canciones. Añádelas desde el panel admin.</p>';
          return;
        }
        root.innerHTML = '';
        docs.forEach(function (doc) {
          var t = doc.data();
          var audioUrl = t.audioUrl || '';
          var spotifyUrl = t.spotifyUrl || '#';
          var title = t.title || 'Sin título';
          var coverBlock = t.coverImageUrl
            ? '<div class="music-cover-wrap"><img class="music-cover-img" src="' +
              escapeHtml(t.coverImageUrl) +
              '" alt="" width="400" height="400" loading="lazy"/></div>'
            : '<div class="music-cover-wrap music-cover-wrap--placeholder" aria-hidden="true"><span class="music-cover-ph">♪</span></div>';
          var previewBlock = audioUrl
            ? '<div class="music-preview-row"><button type="button" class="btn-primary music-preview-btn" data-audio="' +
              escapeHtml(audioUrl) +
              '">Vista previa (30 s)</button><span class="music-preview-time" aria-live="polite"></span></div>'
            : '';
          var art = document.createElement('article');
          art.className = 'music-card music-card--dynamic';
          art.innerHTML =
            coverBlock +
            '<h3 class="music-card-title">' +
            escapeHtml(title) +
            '</h3>' +
            '<p class="music-card-meta">Hasta 30 s aquí · tema completo en Spotify</p>' +
            previewBlock +
            '<div class="music-card-actions"><a href="' +
            escapeHtml(spotifyUrl) +
            '" target="_blank" rel="noopener noreferrer" class="btn-outline music-stream-btn">Escuchar en Spotify</a></div>';
          root.appendChild(art);
        });
        root.onclick = function (ev) {
          var b = ev.target.closest('.music-preview-btn');
          if (!b) return;
          var u = b.getAttribute('data-audio');
          if (!u) return;
          ev.preventDefault();
          window.enzaMusicPreview.toggle(b, u);
        };
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      })
      .catch(function (err) {
        console.error('[Enza] Música:', err);
        root.innerHTML =
          '<p class="music-fs-msg">No se pudo cargar la música. Revisa reglas de Firestore o la conexión.</p>';
      });
  }

  function fillBooks() {
    var root = document.getElementById('books-grid-root');
    if (!root) return;
    if (!configOk()) {
      root.innerHTML =
        '<p class="books-fs-msg">Configura Firebase para mostrar libros.</p>';
      return;
    }
    ensureApp();
    root.innerHTML = '<p class="books-fs-msg">Cargando…</p>';
    firebase
      .firestore()
      .collection('books')
      .get()
      .then(function (snap) {
        var docs = sortDocsBySortOrder(snap.docs);
        if (!docs.length) {
          root.innerHTML =
            '<p class="books-fs-msg">Aún no hay libros. Añádelos desde el panel admin.</p>';
          return;
        }
        root.innerHTML = docs
          .map(function (doc) {
            var b = doc.data();
            var title = escapeHtml(b.title || 'Sin título');
            var desc = escapeHtml(b.description || '');
            var cover = b.coverImageUrl
              ? '<div class="book-card-cover"><img src="' +
                escapeHtml(b.coverImageUrl) +
                '" alt="" loading="lazy"/></div>'
              : '<div class="book-card-cover book-card-cover--empty"></div>';
            var fileBtn = b.fileUrl
              ? '<a class="btn-outline book-card-btn" href="' +
                escapeHtml(b.fileUrl) +
                '" target="_blank" rel="noopener noreferrer">Descargar / ver PDF</a>'
              : '';
            return (
              '<article class="book-card">' +
              cover +
              '<div class="book-card-body">' +
              '<h3 class="book-card-title">' +
              title +
              '</h3>' +
              (desc ? '<p class="book-card-desc">' + desc + '</p>' : '') +
              fileBtn +
              '</div></article>'
            );
          })
          .join('');
      })
      .catch(function (err) {
        console.error('[Enza] Libros:', err);
        root.innerHTML =
          '<p class="books-fs-msg">No se pudieron cargar los libros. Revisa reglas de Firestore o la conexión.</p>';
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    fillGallery();
    fillBooks();
    fillMusic();
    fillVideos();
  });
})();
