# Docker Compose Staging Deployment

This document provides instructions for deploying the Unlisted stocks application to a staging environment using Docker Compose.

## Architecture Overview

The staging deployment consists of:

- **5 backend services**: auth, stocks, ticketing, payments, and storage
- **1 e-sign worker**
- **No frontend services**: web, panels, and RM/distributors are not included
- **1 Nginx reverse proxy**: Routes requests to appropriate services
- **Internal Docker network**: `staging-network` for service communication
- **Memory constraints**: 250MB per service on EC2 t2.micro (1GB RAM total)

## Prerequisites

- Docker 24.0+
- Docker Compose 2.20+
- At least 1GB RAM available
- Public TCP port 80 available. Application and database ports stay internal to Docker.

## Environment Setup

1. Create `.env.staging` file in the repository root (copy from `.env.staging.example`)
2. See [docs/ENVIRONMENT_SETUP.md](./docs/ENVIRONMENT_SETUP.md) for detailed setup instructions for each service
3. Ensure all required environment variables are set (use the checklist in ENVIRONMENT_SETUP.md)
4. Note: Frontend environment variables (NEXT*PUBLIC*\*) must be set separately in Vercel dashboard

## Deployment Commands

### Build Images

```bash
docker-compose --env-file .env.staging -f docker-compose.staging.yml build
```

### Start Services

```bash
docker-compose --env-file .env.staging -f docker-compose.staging.yml up -d
```

### View Logs

```bash
# All services
docker-compose --env-file .env.staging -f docker-compose.staging.yml logs -f

# Specific service
docker-compose --env-file .env.staging -f docker-compose.staging.yml logs -f auth-service
```

### Stop Services

```bash
docker-compose --env-file .env.staging -f docker-compose.staging.yml down
```

### Health Checks

#### Nginx Health Check

```bash
curl http://localhost/health
# Expected: Gateway OK
```

### URLs

Replace `<server-ip>` with the server's IP address:

- APIs: `http://<server-ip>/api/...`
- The root URL and frontend paths return 404 because no frontend is included in this staging stack.

#### Individual Service Health Checks

```bash
# Auth Service
curl http://localhost/api/auth/health

# Stocks Service
curl http://localhost/api/stocks/health

# Ticketing Service
curl http://localhost/api/tickets/health
```

## API Endpoints

All endpoints are prefixed with `/api` and routed through Nginx:

- **Auth Service** (`/api/auth/*`) → `auth-service:3002`
- **Stocks Service** (`/api/stocks/*`) → `stocks-service:3003`
- **Ticketing Service** (`/api/tickets/*`) → `ticketing-service:3001`

## Resource Monitoring

### Memory Usage

```bash
docker stats --no-stream
```

### Container Health

```bash
docker-compose --env-file .env.staging -f docker-compose.staging.yml ps
```

## Troubleshooting

### Memory Issues

- Check memory usage: `docker stats`
- Verify limits: Services are limited to 250MB each, Nginx to 100MB
- Total expected usage: ~850MB with 150MB buffer for OS

### Port Conflicts

- Verify ports are available: `netstat -tulpn | grep :80`
- Change port mapping in `docker-compose.staging.yml` if needed

### Build Failures

- Check Dockerfile paths are correct
- Ensure build context includes all required packages
- Verify `.dockerignore` isn't excluding necessary files

### Network Issues

- Check network creation: `docker network ls | grep staging`
- Inspect service connectivity: `docker-compose --env-file .env.staging -f docker-compose.staging.yml exec nginx ping auth-service`
- Nginx resolves backend container names dynamically; restarting a backend should not require an Nginx reload.

### Health Check Failures

- Check service logs: `docker-compose --env-file .env.staging -f docker-compose.staging.yml logs [service-name]`
- Verify endpoints are responding: `docker-compose --env-file .env.staging -f docker-compose.staging.yml exec [service-name] curl http://localhost:[port]/api/health`

## Service Details

| Service           | Container Port        | Memory | Health Endpoint | Description              |
| ----------------- | --------------------- | ------ | --------------- | ------------------------ |
| nginx             | 80 (only public port) | 100MB  | `/health`       | Reverse proxy            |
| auth-service      | 3002 (internal)       | 250MB  | `/api/health`   | Authentication           |
| stocks-service    | 3003 (internal)       | 250MB  | `/api/health`   | Stock management         |
| ticketing-service | 3001 (internal)       | 250MB  | `/api/health`   | Support tickets          |
| payments-service  | 3004 (internal)       | 250MB  | `/api/health`   | Payments                 |
| storage-service   | 3005 (internal)       | 250MB  | `/api/health`   | File storage             |
| esign-worker      | internal              | —      | —               | E-sign background worker |

## Logs Location

- **Nginx logs**: `./logs/nginx/` (mounted volume)
- **Service logs**: Use `docker-compose logs` command
- **Application logs**: Inside containers at `/app/logs/` (if configured)

## Cleanup

### Remove Containers and Networks

```bash
docker-compose --env-file .env.staging -f docker-compose.staging.yml down
```

### Remove Images and Volumes

```bash
docker-compose --env-file .env.staging -f docker-compose.staging.yml down -v --rmi all
```

### Complete Cleanup

```bash
docker system prune -a --volumes
```

## Security Notes

- Containers run as non-root users
- Nginx configured with security headers
- Internal network isolates services
- No external database ports exposed
- This HTTP-only setup disables Secure cookies so login can work. Traffic is unencrypted; use HTTPS before handling real credentials or deploying publicly.

## Performance Optimization

- Alpine Linux base images for minimal size
- Multi-stage Docker builds
- Optimized `.dockerignore` to reduce build context
- Memory limits prevent resource exhaustion
- Health checks ensure service availability
