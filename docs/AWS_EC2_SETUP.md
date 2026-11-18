# AWS EC2 Setup Guide

## Introduction

### Why EC2 for Staging Deployment
Amazon EC2 provides reliable, scalable compute capacity in the cloud. For staging deployments, EC2 offers several advantages over other hosting solutions:

- **No Cold Starts**: Unlike serverless platforms, EC2 instances stay running
- **Cost-Effective**: t2.micro instances are free for 12 months with AWS Free Tier
- **Full Control**: Complete control over the operating system and software stack
- **Predictable Performance**: Consistent CPU and memory allocation

### Instance Type: t2.micro
- **vCPUs**: 1
- **Memory**: 1 GB RAM
- **Storage**: Up to 8 GB gp3 (free tier eligible)
- **Network**: Low to moderate network performance
- **Free Tier**: 750 hours per month for 12 months

### AWS Free Tier Eligibility
- **Duration**: 12 months from account creation
- **Limits**: 750 hours of t2.micro usage per month
- **Cost After Free Tier**: Approximately ₹500-800/month
- **Other Free Services**: 5 GB S3 storage, basic monitoring

### Estimated Costs After Free Tier
- **EC2 Instance**: ~₹500/month (t2.micro in Mumbai region)
- **Elastic IP**: ~₹100/month (if not attached to running instance)
- **Data Transfer**: ~₹100-200/month (depending on traffic)
- **Total**: ~₹700-900/month for basic staging setup

## Prerequisites

### AWS Account Setup
- [ ] Create AWS account at [aws.amazon.com](https://aws.amazon.com)
- [ ] Verify email and phone number
- [ ] Add credit/debit card for billing verification
- [ ] Enable Multi-Factor Authentication (MFA)
- [ ] Complete identity verification

### Required Permissions
- [ ] EC2 full access
- [ ] VPC access (for security groups)
- [ ] IAM access (for key pairs)

### Basic Knowledge Requirements
- [ ] SSH key generation and management
- [ ] Basic Linux commands (ls, cd, chmod, sudo)
- [ ] Understanding of firewalls and security groups
- [ ] Docker and container concepts

## Step 1: Creating EC2 Instance

### Navigate to EC2 Dashboard
1. Log in to [AWS Management Console](https://console.aws.amazon.com)
2. Search for "EC2" in the services search bar
3. Click "Launch Instance" to start the instance creation wizard

### Choose AMI (Amazon Machine Image)
**Recommended Option: Amazon Linux 2023**
- Modern, secure, and optimized for AWS
- Regular security updates
- Compatible with most deployment scripts
- Default user: `ec2-user`

**Alternative Option: Ubuntu 22.04 LTS**
- Popular for development environments
- Extensive package ecosystem
- Default user: `ubuntu`
- More familiar for developers coming from Ubuntu

### Select Instance Type
1. Choose "t2.micro" from the instance type list
2. Verify free tier eligibility (should show "Free tier" badge)
3. Click "Next: Configure Instance Details"

### Configure Instance Details
**Network Settings:**
- **VPC**: Default VPC (usually fine for staging)
- **Subnet**: Default subnet in any availability zone
- **Auto-assign Public IP**: Enable (required for internet access)

**Leave other settings as default:**
- Number of instances: 1
- Purchasing option: On-demand
- IAM role: None (for staging)
- Shutdown behavior: Stop

### Add Storage
- **Size**: 8 GB (gp3, free tier eligible)
- **Volume Type**: gp3 (balanced performance)
- **Delete on Termination**: Yes (for easy cleanup)

### Add Tags
Add a name tag for easy identification:
- **Key**: Name
- **Value**: smc-unlisted-stox-staging

### Configure Security Group
Create a new security group for staging:

**Security Group Name:** smc-staging-sg
**Description:** Security group for SMC Unlisted Stox staging environment

**Inbound Rules:**
| Type | Protocol | Port Range | Source | Description |
|------|----------|------------|--------|-------------|
| SSH | TCP | 22 | My IP | SSH access from your IP only |
| HTTP | TCP | 80 | 0.0.0.0/0 | Web access from anywhere |

**Outbound Rules:** Allow all traffic (default)

### Review and Launch
1. Review all configuration settings
2. Click "Launch"
3. Select "Create a new key pair"
4. **Key pair name:** smc-staging-key
5. **Key pair type:** RSA
6. **Private key file format:** .pem
7. Click "Download Key Pair"
8. Save the .pem file securely (e.g., `~/.ssh/smc-staging-key.pem`)
9. Click "Launch Instances"

## Step 2: Security Group Configuration

### Why Security Groups Matter
Security groups act as virtual firewalls for your EC2 instances. For staging environments, we need to balance security with accessibility.

### Current Configuration Review
Your security group `smc-staging-sg` should have:
- **SSH (22)**: Restricted to your IP address only
- **HTTP (80)**: Open to the world (required for web access)

### Best Practices for Security Groups
- **Principle of Least Privilege**: Only open necessary ports
- **IP Restrictions**: Limit SSH access to known IP addresses
- **Regular Audits**: Review and update rules periodically
- **Separate Groups**: Use different groups for different environments

### Modifying Security Groups (If Needed)
1. Go to EC2 Dashboard > Security Groups
2. Select your security group
3. Click "Edit inbound rules"
4. Add or modify rules as needed
5. Click "Save rules"

## Step 3: SSH Key Pair Setup

### Understanding SSH Key Pairs
SSH key pairs provide secure authentication to your EC2 instance without passwords.

### Downloaded Key Pair Management
1. **Move to SSH directory:**
   ```bash
   mv ~/Downloads/smc-staging-key.pem ~/.ssh/
   ```

2. **Set correct permissions:**
   ```bash
   chmod 400 ~/.ssh/smc-staging-key.pem
   ```

3. **Why 400 permissions?**
   - Owner: read only
   - Group: no access
   - Others: no access
   - Required by SSH for security

### Testing SSH Connection
1. **Find your instance's public IP:**
   - EC2 Dashboard > Instances
   - Note the "Public IPv4 address"

2. **Test SSH connection:**
   ```bash
   ssh -i ~/.ssh/smc-staging-key.pem ec2-user@YOUR_EC2_IP
   ```

3. **Expected result:**
   ```
   Last login: Mon Jan 20 10:30:00 2025 from your-ip
   [ec2-user@ip-xxx-xx-xx-xx ~]$
   ```

### Troubleshooting SSH Issues
**Permission denied:**
```bash
# Check key permissions
ls -la ~/.ssh/smc-staging-key.pem
# Should show: -r--------

# Fix permissions if needed
chmod 400 ~/.ssh/smc-staging-key.pem
```

**Connection refused:**
- Check security group allows SSH from your IP
- Verify instance is running
- Check instance's public IP address

**Host key verification failed:**
```bash
# Clear known hosts for this IP
ssh-keygen -R YOUR_EC2_IP
```

## Step 4: Elastic IP (Optional but Recommended)

### Why Use Elastic IP
- **Static IP Address**: Doesn't change when instance stops/starts
- **DNS Updates**: Avoid updating environment variables after restarts
- **Cost**: Free when attached to running instance

### Allocating Elastic IP
1. EC2 Dashboard > Network & Security > Elastic IPs
2. Click "Allocate Elastic IP address"
3. Select "Amazon's pool of IPv4 addresses"
4. Click "Allocate"

### Associating Elastic IP
1. Select your allocated Elastic IP
2. Click "Actions" > "Associate Elastic IP address"
3. Select your EC2 instance
4. Click "Associate"

### Cost Considerations
- **Free**: When attached to running EC2 instance
- **Charged**: ~₹100/month when not attached or instance is stopped

## Step 5: Automated Setup with Script

### Overview of setup-ec2.sh
The `setup-ec2.sh` script automates the installation and configuration of required software on your EC2 instance.

### Prerequisites for Running the Script
- [ ] SSH access working
- [ ] Repository cloned locally
- [ ] Script has execute permissions

### Running the Setup Script
```bash
# Make script executable
chmod +x scripts/setup-ec2.sh

# Run the script
./scripts/setup-ec2.sh --ip YOUR_EC2_IP --key ~/.ssh/smc-staging-key.pem
```

**Script Parameters:**
- `--ip`: Your EC2 instance's public IP address
- `--key`: Path to your SSH private key file

### What the Script Installs
1. **System Updates:**
   - Updates package manager repositories
   - Installs security updates

2. **Docker Installation:**
   - Installs Docker engine
   - Starts Docker service
   - Enables Docker on boot

3. **Docker Compose Installation:**
   - Downloads latest Docker Compose binary
   - Makes it executable
   - Verifies installation

4. **Git Installation:**
   - Installs Git version control system

5. **Firewall Configuration:**
   - Configures firewalld (Amazon Linux) or ufw (Ubuntu)
   - Opens port 80 for HTTP traffic

### Script Output
```
[INFO] Setting up EC2 instance at 1.2.3.4
[SUCCESS] Connected to EC2 instance
[INFO] Updating system packages...
[INFO] Installing Docker...
[INFO] Installing Docker Compose...
[INFO] Installing Git...
[INFO] Configuring firewall...
[SUCCESS] Setup completed successfully!
```

## Step 6: Manual Setup (Alternative)

### When to Use Manual Setup
- Automated script fails
- Custom configuration requirements
- Learning purposes
- Debugging installation issues

### Manual Installation Steps

#### Amazon Linux 2023
```bash
# Update system
sudo dnf update -y

# Install Docker
sudo dnf install docker -y
sudo systemctl start docker
sudo systemctl enable docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
sudo dnf install git -y

# Configure firewall (firewalld)
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --reload
```

#### Ubuntu 22.04 LTS
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install docker.io -y
sudo systemctl start docker
sudo systemctl enable docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
sudo apt install git -y

# Configure firewall (ufw)
sudo ufw allow 80/tcp
sudo ufw --force enable
```

### Post-Installation Configuration
```bash
# Add user to docker group (logout/login required)
sudo usermod -aG docker $USER

# Verify installations
docker --version
docker-compose --version
git --version
```

## Step 7: Repository Setup

### Cloning the Repository
```bash
# Navigate to home directory
cd ~

# Clone the repository
git clone <REPOSITORY_URL> smc-unlisted-stox

# Navigate to project directory
cd smc-unlisted-stox

# Verify clone
ls -la
```

### Creating Required Directories
```bash
# Create logs directory for Nginx
mkdir -p logs/nginx

# Create directory for environment files
mkdir -p config

# Verify directory structure
tree -L 2
```

### Copying Environment Files
```bash
# From your local machine, copy environment file
scp -i ~/.ssh/smc-staging-key.pem .env.staging ec2-user@YOUR_EC2_IP:~/smc-unlisted-stox/
```

## Step 8: Firewall Configuration

### Amazon Linux: Using firewalld
```bash
# Check firewalld status
sudo firewall-cmd --state

# List current rules
sudo firewall-cmd --list-all

# Add HTTP port (if not already added)
sudo firewall-cmd --permanent --add-port=80/tcp

# Reload firewall
sudo firewall-cmd --reload

# Verify rules
sudo firewall-cmd --list-all
```

### Ubuntu: Using ufw
```bash
# Check ufw status
sudo ufw status

# Allow HTTP traffic
sudo ufw allow 80/tcp

# Enable firewall (if not already enabled)
sudo ufw --force enable

# Verify rules
sudo ufw status
```

### Testing Firewall Configuration
```bash
# Test HTTP access from local machine
curl http://YOUR_EC2_IP

# Should return connection refused (expected, no web server yet)
```

## Step 9: Docker Configuration

### Verifying Docker Installation
```bash
# Check Docker version
docker --version

# Check Docker Compose version
docker-compose --version

# Check Docker service status
sudo systemctl status docker
```

### Testing Docker Functionality
```bash
# Run hello-world container
docker run hello-world

# Expected output: "Hello from Docker!"

# Check running containers
docker ps -a

# Clean up test container
docker rm $(docker ps -aq)
```

### Configuring Docker Logging
```bash
# Create Docker daemon configuration
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

# Restart Docker service
sudo systemctl restart docker
```

## Step 10: System Optimization

### Memory Optimization for t2.micro
The t2.micro has only 1GB RAM, which can be insufficient for Docker builds and running multiple services.

### Configuring Swap Space
```bash
# Check current memory and swap
free -h

# Create 2GB swap file
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048

# Set correct permissions
sudo chmod 600 /swapfile

# Set up swap area
sudo mkswap /swapfile

# Enable swap
sudo swapon /swapfile

# Make swap permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify swap is active
free -h
```

### Benefits of Swap Space
- **Prevents OOM**: Allows system to use disk as additional memory
- **Docker Builds**: Enables building Docker images without memory exhaustion
- **Service Stability**: Prevents services from crashing during peak loads

### Monitoring Memory Usage
```bash
# Check memory usage
free -h

# Monitor memory in real-time
watch -n 1 free -h

# Check swap usage
swatop  # or cat /proc/swaps
```

## Security Hardening

### Disable Password Authentication
```bash
# Edit SSH configuration
sudo vi /etc/ssh/sshd_config

# Change the following line:
# PasswordAuthentication yes
# To:
PasswordAuthentication no

# Restart SSH service
sudo systemctl restart sshd
```

### Configure fail2ban (Optional)
```bash
# Install fail2ban
sudo dnf install fail2ban -y  # Amazon Linux
# or
sudo apt install fail2ban -y  # Ubuntu

# Enable and start fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Enable Automatic Security Updates
```bash
# Amazon Linux
sudo dnf install dnf-automatic -y
sudo systemctl enable dnf-automatic.timer
sudo systemctl start dnf-automatic.timer

# Ubuntu
sudo apt install unattended-upgrades -y
sudo dnf-automatic enable
```

### CloudWatch Monitoring (Optional)
1. Go to CloudWatch Console
2. Create alarms for CPU and memory usage
3. Set up notifications via SNS

## Monitoring and Maintenance

### Setting up CloudWatch Alarms
1. **CPU Utilization Alarm:**
   - Threshold: >80% for 5 minutes
   - Action: Send notification

2. **Memory Usage Alarm:**
   - Custom metric using CloudWatch agent
   - Threshold: >90% memory usage

### Log Rotation Configuration
```bash
# Check current log rotation
ls /etc/logrotate.d/

# Configure Docker log rotation (already done in daemon.json)
# Configure application log rotation in docker-compose.yml
```

### Disk Space Monitoring
```bash
# Check disk usage
df -h

# Monitor disk usage in real-time
watch -n 5 df -h

# Clean up Docker resources
docker system prune -f
```

### Regular Security Audits
- [ ] Review security group rules monthly
- [ ] Update system packages weekly
- [ ] Monitor SSH access logs
- [ ] Check for unauthorized processes

## Cost Optimization

### Using AWS Free Tier Effectively
- [ ] Monitor EC2 usage hours (750 free per month)
- [ ] Stop instance when not in use
- [ ] Use gp3 storage (free tier eligible)
- [ ] Avoid Elastic IP charges by not stopping instances

### Setting up Billing Alerts
1. Go to AWS Billing Dashboard
2. Create billing alarm for $5/month threshold
3. Configure email notifications

### Instance Scheduling
```bash
# Stop instance when not needed (staging only)
aws ec2 stop-instances --instance-ids i-xxxxxxxxxxxxxxxxx

# Start instance when needed
aws ec2 start-instances --instance-ids i-xxxxxxxxxxxxxxxxx
```

## Troubleshooting

### Cannot SSH: Permission denied
**Possible causes:**
- Incorrect key permissions (should be 400)
- Wrong key file path
- Security group blocking SSH

**Solutions:**
```bash
# Fix key permissions
chmod 400 ~/.ssh/smc-staging-key.pem

# Verify security group allows SSH from your IP
# Check instance state (running)
```

### Cannot SSH: Connection refused
**Possible causes:**
- Instance not running
- Wrong IP address
- Firewall blocking SSH

**Solutions:**
- Check instance state in EC2 console
- Verify public IP address
- Check security group rules

### Docker permission denied
**Problem:** `docker: Got permission denied while trying to connect to the Docker daemon socket`

**Solutions:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Logout and login again, or run:
newgrp docker

# Test Docker access
docker ps
```

### Out of memory errors
**Symptoms:**
- Docker builds failing
- Services crashing
- System becoming unresponsive

**Solutions:**
- Configure swap space (see Step 10)
- Reduce Docker container memory limits
- Monitor memory usage with `docker stats`
- Stop unnecessary services

### Disk space full
**Problem:** `no space left on device`

**Solutions:**
```bash
# Check disk usage
df -h

# Clean up Docker resources
docker system prune -f
docker volume prune -f
docker image prune -f

# Remove old log files
sudo find /var/log -type f -name "*.log" -exec truncate -s 0 {} \;

# Check largest directories
du -h / | sort -hr | head -10
```

### Firewall blocking traffic
**Problem:** Cannot access port 80 from browser

**Solutions:**
```bash
# Amazon Linux - check firewalld
sudo firewall-cmd --list-all

# Ubuntu - check ufw
sudo ufw status

# Add HTTP rule if missing
sudo firewall-cmd --permanent --add-port=80/tcp  # Amazon
sudo ufw allow 80/tcp                           # Ubuntu
```

## Reference Commands

### SSH Commands
```bash
# Connect to instance
ssh -i ~/.ssh/smc-staging-key.pem ec2-user@YOUR_EC2_IP

# Copy files to instance
scp -i ~/.ssh/smc-staging-key.pem local-file ec2-user@YOUR_EC2_IP:~/remote-file

# Copy files from instance
scp -i ~/.ssh/smc-staging-key.pem ec2-user@YOUR_EC2_IP:~/remote-file local-file
```

### Docker Commands
```bash
# Check Docker status
docker --version
docker-compose --version
sudo systemctl status docker

# List containers
docker ps -a

# View container logs
docker logs container_name

# Stop all containers
docker stop $(docker ps -aq)

# Remove all containers
docker rm $(docker ps -aq)
```

### System Administration Commands
```bash
# Check system resources
free -h          # Memory
df -h           # Disk
top             # Processes
htop            # Enhanced top (if installed)

# System logs
sudo journalctl -u docker
sudo journalctl -u sshd

# Service management
sudo systemctl status docker
sudo systemctl restart docker
sudo systemctl enable docker
```

### Network Commands
```bash
# Check network interfaces
ip addr show

# Test connectivity
ping google.com

# Check listening ports
netstat -tlnp
ss -tlnp

# Firewall status
sudo firewall-cmd --list-all  # Amazon
sudo ufw status               # Ubuntu
```

## Next Steps

### Proceed to Staging Deployment
Now that your EC2 instance is set up, you can proceed with the full staging deployment:

1. **Environment Configuration**: Follow [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md)
2. **Database Setup**: Run database migrations using [scripts/migrate-staging.sh](../scripts/migrate-staging.sh)
3. **Backend Deployment**: Deploy services using [scripts/deploy-to-ec2.sh](../scripts/deploy-to-ec2.sh)
4. **Frontend Deployment**: Set up Vercel following [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md)

### Complete Deployment Guide
For the complete step-by-step deployment process, refer to [STAGING_DEPLOYMENT_GUIDE.md](STAGING_DEPLOYMENT_GUIDE.md).

### Getting Help
- Check the troubleshooting section in [STAGING_DEPLOYMENT_GUIDE.md](STAGING_DEPLOYMENT_GUIDE.md)
- Review Docker build issues in [MONOREPO_DOCKER_GUIDE.md](MONOREPO_DOCKER_GUIDE.md)
- Check AWS documentation for EC2-specific issues