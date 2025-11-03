FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Etc/UTC \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 python3-venv python3-pip python3-tk \
      libpython3.10 \
      build-essential \
      ca-certificates \
      curl \
      tk-dev \
      git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . /app

RUN chmod +x installers/linux/build.sh
ENTRYPOINT ["installers/linux/build.sh"]
