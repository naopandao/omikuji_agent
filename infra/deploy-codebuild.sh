#!/bin/bash
# Deploy CodeBuild CloudFormation stack
#
# Usage:
#   ./infra/deploy-codebuild.sh [create|update|delete]
#
# Prerequisites:
#   - AWS CLI configured with appropriate credentials
#   - GitHub OAuth connection set up in CodeBuild

set -e

STACK_NAME="omikuji-agent-codebuild"
TEMPLATE_FILE="infra/codebuild.yml"
REGION="${AWS_REGION:-ap-northeast-1}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

create_stack() {
    log_info "Creating CloudFormation stack: $STACK_NAME"
    aws cloudformation create-stack \
        --stack-name "$STACK_NAME" \
        --template-body "file://$TEMPLATE_FILE" \
        --region "$REGION" \
        --capabilities CAPABILITY_IAM
    
    log_info "Waiting for stack creation to complete..."
    aws cloudformation wait stack-create-complete \
        --stack-name "$STACK_NAME" \
        --region "$REGION"
    
    log_info "Stack created successfully!"
    show_outputs
}

update_stack() {
    log_info "Updating CloudFormation stack: $STACK_NAME"
    aws cloudformation update-stack \
        --stack-name "$STACK_NAME" \
        --template-body "file://$TEMPLATE_FILE" \
        --region "$REGION" \
        --capabilities CAPABILITY_IAM
    
    log_info "Waiting for stack update to complete..."
    aws cloudformation wait stack-update-complete \
        --stack-name "$STACK_NAME" \
        --region "$REGION"
    
    log_info "Stack updated successfully!"
    show_outputs
}

delete_stack() {
    log_warn "Deleting CloudFormation stack: $STACK_NAME"
    read -p "Are you sure? (y/N): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        log_info "Cancelled."
        exit 0
    fi
    
    aws cloudformation delete-stack \
        --stack-name "$STACK_NAME" \
        --region "$REGION"
    
    log_info "Waiting for stack deletion to complete..."
    aws cloudformation wait stack-delete-complete \
        --stack-name "$STACK_NAME" \
        --region "$REGION"
    
    log_info "Stack deleted successfully!"
}

show_outputs() {
    log_info "Stack outputs:"
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs' \
        --output table
}

show_status() {
    log_info "Stack status:"
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].{Name:StackName,Status:StackStatus,Created:CreationTime}' \
        --output table 2>/dev/null || log_warn "Stack not found"
}

# Main
case "${1:-status}" in
    create)
        create_stack
        ;;
    update)
        update_stack
        ;;
    delete)
        delete_stack
        ;;
    status)
        show_status
        ;;
    outputs)
        show_outputs
        ;;
    *)
        echo "Usage: $0 [create|update|delete|status|outputs]"
        exit 1
        ;;
esac
