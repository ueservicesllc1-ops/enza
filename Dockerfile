# Sitio estático con Caddy; el puerto lo define la variable PORT del hosting.
FROM caddy:2-alpine

WORKDIR /srv

COPY docker-start.sh /docker-start.sh
RUN chmod +x /docker-start.sh

# Todo el sitio en /srv (index.html, style.css, app.js, public/, imágenes…)
COPY . /srv/

ENV PORT=8080
EXPOSE 8080

CMD ["/docker-start.sh"]
