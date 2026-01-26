# Go Service Dockerfile
FROM golang:1.23-alpine AS builder

# Install build dependencies and update CA certificates
RUN apk add --no-cache git ca-certificates tzdata && \
    update-ca-certificates

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum* ./

# Download dependencies (with retry and GOPROXY fallback)
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download || \
    GOPROXY=direct go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./cmd/main.go

# Production stage
FROM alpine:3.19

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Copy the binary
COPY --from=builder /app/main .

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

# Run as non-root user
USER appuser

# Run the application
CMD ["./main"]
