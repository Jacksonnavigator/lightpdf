FROM collabora/code:latest

# Render assigns a dynamic port via $PORT env var
# We tell Collabora to listen on that port

ENV username=admin
ENV password=admin
ENV domain=.*
ENV ssl_enabled=false
ENV ssl_termination=true

# Use a startup script so we can read $PORT at runtime
COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
