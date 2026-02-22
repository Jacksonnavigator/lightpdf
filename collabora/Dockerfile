FROM collabora/code:latest

# SSL disabled — Render handles HTTPS termination at their edge
# Config is passed via environment variables (correct method for this image)

EXPOSE 9980

ENV username=admin
ENV password=admin
ENV domain=.*
ENV ssl_enabled=false
ENV ssl_termination=true
ENV extra_params=--o:ssl.enable=false

CMD ["/start-collabora-online.sh"]
