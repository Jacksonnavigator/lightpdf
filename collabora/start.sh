#!/bin/bash
# Render sets $PORT dynamically — pass it to Collabora
export extra_params="--o:ssl.enable=false --o:ssl.termination=true --o:net.listen=any --o:net.port=${PORT:-9980}"
exec /start-collabora-online.sh
