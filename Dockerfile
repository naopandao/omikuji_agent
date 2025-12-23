# Bedrock AgentCore Runtime - Dockerfile
# Python 3.11 on ARM64 for optimal performance

FROM --platform=linux/arm64 python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent code
COPY omikuji_agent.py .
COPY my_agent.py .

# Set environment variables
ENV AWS_REGION=ap-northeast-1
ENV PYTHONUNBUFFERED=1

# Run the agent
CMD ["python", "-m", "bedrock_agentcore.server", "--entrypoint", "omikuji_agent:app"]

