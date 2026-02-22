FROM collabora/code:latest

# Collabora needs MKNOD capability — Render supports this
# SSL is disabled since Render handles HTTPS termination at their edge

EXPOSE 9980

# Render sets PORT env var — Collabora uses 9980 internally
# aliasgroup1 is set via Render environment variable
CMD ["/bin/bash", "-c", "/start-collabora-online.sh --o:ssl.enable=false --o:ssl.termination=true --o:net.post_allow.host[0]=.* --o:storage.wopi.alias_groups[@allow]=.* --o:logging.level=warning"]
