# Environment Setup Guide for SMC Unlisted Stox

This guide provides comprehensive instructions for setting up all environment variables required for the SMC Unlisted Stox staging deployment.

## Introduction

The SMC Unlisted Stox application consists of:
- **Backend**: 3 NestJS microservices deployed on EC2 (auth-service, stocks-service, ticketing-service)
- **Frontend**: Next.js application deployed on Vercel
- **External Services**: Supabase (PostgreSQL), Upstash (Redis), Twilio (SMS), Google OAuth, SendGrid (email), Razorpay (payments)

This guide covers setting up all required environment variables for a complete staging deployment.

## Prerequisites

Before starting, ensure you have accounts set up for:
- [Supabase](https://supabase.com) - PostgreSQL database
- [Upstash](https://upstash.com) - Redis database
- [Vercel](https://vercel.com) - Frontend deployment
- [Twilio](https://twilio.com) - SMS service
- [Google Cloud Console](https://console.cloud.google.com) - OAuth
- [SendGrid](https://sendgrid.com) - Email service
- [Razorpay](https://razorpay.com) - Payment gateway (India-based)

## Quick Start Checklist

| Service | Status | Setup Time | Documentation |
|---------|--------|------------|---------------|
| Supabase PostgreSQL | Required | 15 min | Section 2 |
| Upstash Redis | Required | 5 min | Section 3 |
| JWT/Cookie Secrets | Required | 2 min | Section 1 |
| Twilio SMS | Required | 10 min | Section 4 |
| Google OAuth | Required | 10 min | Section 5 |
| SendGrid Email | Required | 10 min | Section 6 |
| Razorpay Payments | Optional | 10 min | Section 7 |
| Vercel Frontend | Required | 5 min | Section 8 |
| Marketing Webhooks | Optional | 15 min | Section 9 |

## Section 1: Generating Secrets

### JWT_SECRET
Generate a secure JWT secret (minimum 32 characters):
```bash
# Option 1: Using OpenSSL
openssl rand -base64 64

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

### COOKIE_SECRET
Generate a cookie signing secret:
```bash
openssl rand -base64 32
```

**Security Notes:**
- Use different secrets for staging and production
- Never commit secrets to Git
- Rotate secrets every 90 days
- Store securely and limit access

## Section 2: Supabase PostgreSQL Setup

1. Create a new Supabase project or use an existing one
2. Navigate to **Project Settings → Database**
3. Copy the **Connection string** (use "Session mode" for application connections)
4. Create two databases if not already created:
   - `unlisted_stox_db` (for auth and stocks services)
   - `ticketing_system` (for ticketing service)

**Environment Variables:**
```
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1
ADMIN_DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1
TICKETING_DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1
```

**Configuration Tips:**
- Enable **Row Level Security (RLS)** for data protection
- Configure **IP allowlist** if needed for additional security
- Use connection pooling (PgBouncer) for production performance

**Cost:** Free tier includes 500MB database, 2GB bandwidth

## Section 3: Upstash Redis Setup

1. Create an Upstash account at [upstash.com](https://upstash.com)
2. Create a new Redis database
3. Select a region closest to your EC2 instance
4. Copy the connection details from the database dashboard

**Environment Variables:**
```
REDIS_HOST=your-redis-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_TLS=true
```

**Notes:**
- Upstash requires TLS connections (`REDIS_TLS=true`)
- Free tier includes 10,000 commands/day

## Section 4: Twilio SMS Setup

1. Create a Twilio account at [twilio.com](https://twilio.com)
2. Verify your phone number and complete account setup
3. Navigate to **Console Dashboard**
4. Copy **Account SID** and **Auth Token**
5. Purchase a phone number or use the trial number

**Environment Variables:**
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

**Notes:**
- Trial accounts can only send SMS to verified numbers
- Cost: ~$1/month for phone number + $0.0075 per SMS

## Section 5: Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services → Credentials**
3. Create **OAuth 2.0 Client ID** (Web application type)
4. Add authorized JavaScript origins: `https://your-app.vercel.app`
5. Add authorized redirect URIs: `https://your-app.vercel.app/api/auth/callback/google`
6. Copy Client ID and Client Secret

**Environment Variables:**
```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

**Notes:**
- Enable **Google+ API** in the API Library
- The `NEXT_PUBLIC_GOOGLE_CLIENT_ID` goes in Vercel dashboard

## Section 6: SendGrid Email Setup

1. Create a SendGrid account at [sendgrid.com](https://sendgrid.com)
2. Navigate to **Settings → API Keys**
3. Create a new API key with "Mail Send" permissions
4. Go to **Settings → Sender Authentication**
5. Verify a sender email address

**Environment Variables:**
```
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
EMAIL_MOCK_MODE=false
```

**Alternative SMTP Configuration:**
```
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Cost:** Free tier includes 100 emails/day

## Section 7: Razorpay Payment Gateway Setup

1. Create a Razorpay account at [razorpay.com](https://razorpay.com)
2. Navigate to **Settings → API Keys**
3. Generate Test or Live API keys

**Environment Variables:**
```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Notes:**
- Configure webhooks for payment status updates
- Cost: 2% transaction fee

## Section 8: Frontend Service URLs

Set these in your **Vercel dashboard** (Settings → Environment Variables → Production):

```
NEXT_PUBLIC_AUTH_SERVICE_URL=http://your-ec2-public-ip/api/auth
NEXT_PUBLIC_STOCKS_SERVICE_URL=http://your-ec2-public-ip/api/stocks
NEXT_PUBLIC_TICKETING_SERVICE_URL=http://your-ec2-public-ip/api/tickets
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_APP_NAME=smc-unlisted-stox
NEXT_PUBLIC_SHOW_DEBUG=false
NEXT_PUBLIC_ENABLE_MOCK_MODE_BANNER=true
```

**Notes:**
- Replace `your-ec2-public-ip` with your actual EC2 public IP
- These variables must be set in Vercel, not in `.env.staging`

## Section 9: Optional Marketing Webhooks

### Facebook
1. Create a Facebook app
2. Configure webhooks
3. Copy app secret and verify token

### Google Ads
1. Set up conversion tracking
2. Generate webhook secret

### Twitter
1. Configure webhook URL
2. Copy webhook secret

**Environment Variables:**
```
FACEBOOK_WEBHOOK_SECRET=your-facebook-secret
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your-facebook-token
GOOGLE_ADS_WEBHOOK_SECRET=your-google-ads-secret
TWITTER_WEBHOOK_SECRET=your-twitter-secret
```

## Section 10: Mock Mode Configuration

For staging deployment, use these recommended settings:

```
KYC_MOCK_MODE=true
EMAIL_MOCK_MODE=false
```

**Explanation:**
- **KYC_MOCK_MODE**: Skip real KYC verification
- **EMAIL_MOCK_MODE**: Set to `false` to test real email delivery

**Warning:** Never use mock modes in production!

## Section 11: Deployment Workflow

1. Copy `.env.staging.example` to `.env.staging`
2. Fill in all required values using this guide
3. Validate the environment file (check for missing values)
4. Upload `.env.staging` to your EC2 instance (repository root)
5. Set Vercel environment variables in the dashboard
6. Run database migrations (see migration documentation)
7. Deploy using `docker-compose -f docker-compose.staging.yml up -d`

## Section 12: Security Best Practices

- **Never commit** `.env.staging` to Git (it's gitignored)
- Use **different secrets** for each environment
- **Rotate secrets** regularly (every 90 days)
- Enable **2FA** on all service accounts
- Use **IP allowlists** where available
- Monitor for **leaked secrets** using tools like GitGuardian
- Consider **secret management services** for production (AWS Secrets Manager, HashiCorp Vault)

## Section 13: Troubleshooting

### Database Connection Errors
- Check Supabase IP allowlist includes your EC2 IP
- Verify connection string format and credentials
- Ensure PgBouncer parameters are included

### Redis Connection Errors
- Verify `REDIS_TLS=true` is set
- Check Upstash endpoint and password
- Ensure firewall allows outbound connections to Upstash

### SMS Not Sending
- Verify Twilio trial account restrictions
- Check phone number format (+country code)
- Confirm account has sufficient balance

### OAuth Errors
- Verify redirect URIs match exactly
- Check authorized origins include your Vercel URL
- Ensure Google+ API is enabled

### Email Not Sending
- Verify SendGrid sender authentication
- Check API key has correct permissions
- Confirm sender email is verified

### Environment Variables Not Loading
- Verify `.env.staging` file location (repository root on EC2)
- Check docker-compose `env_file` directive
- Ensure no syntax errors in the env file

## Appendix: Environment Variable Reference

| Variable | Service(s) | Required | Description | Example |
|----------|------------|----------|-------------|---------|
| `PORT` | Auth/Stocks/Ticketing | Yes | Service port | `3002`/`3003`/`3001` |
| `JWT_SECRET` | All backend | Yes | JWT signing secret | `base64-string` |
| `COOKIE_SECRET` | Auth, Stocks | Yes | Cookie signing secret | `base64-string` |
| `DATABASE_URL` | Auth, Stocks | Yes | Main database connection | `postgresql://...` |
| `ADMIN_DATABASE_URL` | Ticketing | Yes | Admin database access | `postgresql://...` |
| `TICKETING_DATABASE_URL` | Ticketing | Yes | Ticketing database | `postgresql://...` |
| `REDIS_HOST` | All backend | Yes | Redis endpoint | `xxx.upstash.io` |
| `REDIS_PORT` | All backend | Yes | Redis port | `6379` |
| `REDIS_PASSWORD` | All backend | Yes | Redis password | `password` |
| `REDIS_TLS` | All backend | Yes | Redis TLS enabled | `true` |
| `TWILIO_ACCOUNT_SID` | Auth | Yes | Twilio account SID | `ACxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Auth | Yes | Twilio auth token | `token` |
| `TWILIO_PHONE_NUMBER` | Auth | Yes | Twilio phone number | `+1234567890` |
| `GOOGLE_CLIENT_ID` | Auth, Frontend | Yes | Google OAuth client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Auth | Yes | Google OAuth client secret | `secret` |
| `EMAIL_PROVIDER` | Stocks, Ticketing | Yes | Email provider | `sendgrid` |
| `SENDGRID_API_KEY` | Stocks, Ticketing | Yes | SendGrid API key | `SG.xxxxx` |
| `EMAIL_FROM` | Stocks, Ticketing | Yes | Sender email | `noreply@domain.com` |
| `EMAIL_MOCK_MODE` | Stocks, Ticketing | No | Mock email mode | `false` |
| `KYC_MOCK_MODE` | Stocks | No | Mock KYC mode | `true` |
| `RAZORPAY_KEY_ID` | Stocks | No | Razorpay key ID | `rzp_test_xxx` |
| `RAZORPAY_KEY_SECRET` | Stocks | No | Razorpay key secret | `secret` |
| `FRONTEND_URL` | Stocks, Ticketing | Yes | Vercel app URL | `https://app.vercel.app` |
| `SLA_URGENT_HOURS` | Ticketing | No | SLA for urgent tickets | `4` |
| `SLA_HIGH_HOURS` | Ticketing | No | SLA for high priority | `24` |
| `SLA_MEDIUM_HOURS` | Ticketing | No | SLA for medium priority | `48` |
| `SLA_LOW_HOURS` | Ticketing | No | SLA for low priority | `72` |
| `TICKET_ASSIGNMENT_STRATEGY` | Ticketing | No | Assignment strategy | `round-robin` |
| `CRON_SLA_BREACH_CHECK` | Ticketing | No | SLA check schedule | `*/15 * * * *` |
| `CRON_AGENT_AVAILABILITY_UPDATE` | Ticketing | No | Agent availability update | `0 0 * * *` |
| `CRON_AUTO_CLOSE_RESOLVED` | Ticketing | No | Auto-close schedule | `0 2 * * *` |
| `AUTO_CLOSE_RESOLVED_DAYS` | Ticketing | No | Auto-close after days | `7` |
| `NEXT_PUBLIC_AUTH_SERVICE_URL` | Frontend | Yes | Auth service URL | `http://ip/api/auth` |
| `NEXT_PUBLIC_STOCKS_SERVICE_URL` | Frontend | Yes | Stocks service URL | `http://ip/api/stocks` |
| `NEXT_PUBLIC_TICKETING_SERVICE_URL` | Frontend | Yes | Ticketing service URL | `http://ip/api/tickets` |
| `NEXT_PUBLIC_APP_URL` | Frontend | Yes | Vercel app URL | `https://app.vercel.app` |
| `NEXT_PUBLIC_APP_NAME` | Frontend | No | App display name | `smc-unlisted-stox` |
| `NEXT_PUBLIC_SHOW_DEBUG` | Frontend | No | Show debug info | `false` |
| `NEXT_PUBLIC_ENABLE_MOCK_MODE_BANNER` | Frontend | No | Show mock mode banner | `true` |