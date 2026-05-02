#!/bin/sh
set -e
PORT="${PORT:-8080}"
cat > /etc/caddy/Caddyfile.runtime <<EOF
{
	admin off
}
:${PORT} {
	root * /srv
	encode gzip zstd
	file_server
	header {
		X-Content-Type-Options nosniff
	}
}
EOF
exec caddy run --config /etc/caddy/Caddyfile.runtime --adapter caddyfile
