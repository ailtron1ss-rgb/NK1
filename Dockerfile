FROM node:24-bookworm-slim

ARG INSTALL_RESEARCH_TORCH=false
ENV NODE_ENV=production \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SUPER_GATEWAY_HOST=0.0.0.0 \
    PATH="/opt/nk1-research-venv/bin:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/neuro-kurisu
COPY --chown=node:node . .

# Install each locked Node workspace using the repository's pinned Node.js 24 contract.
RUN npm run install:all

# Optional CPU-only research probes. The core Node runtime and bridge are usable without Torch.
# Enable with INSTALL_RESEARCH_TORCH=true for experiments that import torch.
RUN if [ "${INSTALL_RESEARCH_TORCH}" = "true" ]; then \
      python3 -m venv /opt/nk1-research-venv \
      && /opt/nk1-research-venv/bin/python -m pip install --no-cache-dir \
        --index-url https://download.pytorch.org/whl/cpu \
        -r research/requirements-integration.txt; \
    fi

EXPOSE 8080
USER node
CMD ["npm", "start"]
