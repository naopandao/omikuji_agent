# Bedrock AgentCore Runtime - Dockerfile
# Python 3.11 on ARM64 for optimal performance
# See: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-service-contract.html

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

# Expose port 8080 (required by AgentCore Runtime)
EXPOSE 8080

# Run the agent using BedrockAgentCoreApp's built-in server
# The app.run() method starts a server on port 8080 with /invocations and /ping endpoints
CMD ["python", "-c", "from omikuji_agent import app; app.run()"]

