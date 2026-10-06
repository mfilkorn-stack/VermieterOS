# syntax=docker/dockerfile:1.7
# Betriebs-Image: Backup, Restore-Test, nächtliche Integritätsprüfung (docs/BETRIEB.md).
# Basis ist Postgres selbst: pg_dump, pg_restore und ein frischer Cluster für den Restore-Test
# kommen aus derselben Hauptversion wie die Datenbank.
# Werkzeuge als geprüfte Release-Binärdateien statt Paketquellen: reproduzierbar, Version sichtbar.

FROM alpine:3.22 AS werkzeuge
ADD --checksum=sha256:7df45a6cc87d4da11cc03a539a7470c15b1041ab2b396af088fe9990f7c79d50 \
    https://github.com/FiloSottile/age/releases/download/v1.2.1/age-v1.2.1-linux-amd64.tar.gz /tmp/age.tgz
ADD --checksum=sha256:417e3da236f3a12d292da4e7287d67b1df558b8c2b280d092e563958ed724be7 \
    https://github.com/rclone/rclone/releases/download/v1.71.1/rclone-v1.71.1-linux-amd64.zip /tmp/rclone.zip
RUN mkdir /aus \
 && tar -xzf /tmp/age.tgz -C /tmp \
 && unzip -q /tmp/rclone.zip -d /tmp \
 && mv /tmp/age/age /tmp/age/age-keygen /tmp/rclone-*/rclone /aus/

FROM postgres:16-alpine
COPY --from=werkzeuge /aus/ /usr/local/bin/
COPY skripte/ /ops/
# rclone wird nur über RCLONE_CONFIG_<NAME>_* aus der Umgebung konfiguriert.
RUN touch /ops/rclone.conf
ENV PATH=/ops:$PATH \
    TZ=Europe/Berlin \
    RCLONE_CONFIG=/ops/rclone.conf
USER postgres
WORKDIR /tmp
ENTRYPOINT []
CMD ["zeitplan"]
