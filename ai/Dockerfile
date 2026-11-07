FROM ollama/ollama:latest

ENV OLLAMA_HOST=0.0.0.0:11434
COPY start.sh healthcheck.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/start.sh /usr/local/bin/healthcheck.sh
EXPOSE 11434
HEALTHCHECK --interval=30s --timeout=10s --start-period=30m --retries=2 CMD ["/usr/local/bin/healthcheck.sh"]
ENTRYPOINT ["/usr/local/bin/start.sh"]