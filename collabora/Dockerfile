FROM collabora/code:latest

ENV username=admin
ENV password=admin
ENV domain=.*
ENV ssl_enabled=false
ENV ssl_termination=true

# Inline the startup — no chmod needed, no separate file
ENTRYPOINT ["/bin/bash", "-c", "export extra_params=\"--o:ssl.enable=false --o:ssl.termination=true --o:net.port=${PORT:-9980}\" && exec /start-collabora-online.sh"]
