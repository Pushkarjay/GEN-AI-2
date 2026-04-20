# VenueFlow Deployment Guide

This guide explains how to deploy VenueFlow to Google Cloud Run.

## Prerequisites

1. **Google Cloud Account**
   - Active GCP account with billing enabled
   - Project created in Google Cloud Console

2. **Local Tools**
   - Google Cloud CLI installed: https://cloud.google.com/sdk/docs/install
   - Docker Desktop: https://www.docker.com/products/docker-desktop
   - Git: https://git-scm.com/downloads

3. **Cloud APIs Enabled**
   - Cloud Run API
   - Cloud Build API
   - Container Registry API

## Step 1: Authenticate with Google Cloud

```bash
# Login to Google Cloud
gcloud auth login

# Set your project ID
gcloud config set project YOUR_PROJECT_ID

# Check authentication
gcloud auth list
```

## Step 2: Prepare Your Code

```bash
# Clone or navigate to the repository
cd venueflow

# Verify all files are present
ls -la
# Should show: index.html, styles.css, script.js, Dockerfile, nginx.conf, etc.
```

## Step 3: Build Docker Image Locally (Optional)

```bash
# Build the Docker image
docker build -t venueflow:latest .

# Test locally
docker run -p 8080:8080 venueflow:latest

# Visit http://localhost:8080 in your browser
# Press Ctrl+C to stop
```

## Step 4: Deploy to Cloud Run

### Option A: Deploy from Source (Recommended)

```bash
gcloud run deploy venueflow \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 256Mi \
  --cpu 1 \
  --timeout 600 \
  --max-instances 100
```

### Option B: Deploy from Container Registry

```bash
# Push to Container Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/venueflow

# Deploy
gcloud run deploy venueflow \
  --image gcr.io/YOUR_PROJECT_ID/venueflow \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 256Mi
```

## Step 5: Configure Deployment (Optional)

### Set Environment Variables
```bash
gcloud run deploy venueflow \
  --update-env-vars \
  LOG_LEVEL=INFO,ENVIRONMENT=production
```

### Set IAM Permissions
```bash
# Allow public access (already set with --allow-unauthenticated)
gcloud run services add-iam-policy-binding venueflow \
  --member=allUsers \
  --role=roles/run.invoker
```

## Step 6: Verify Deployment

```bash
# Get the service URL
gcloud run services describe venueflow --region us-central1

# Test the endpoint
curl $(gcloud run services describe venueflow --format='value(status.url)')

# View logs
gcloud run logs read venueflow --limit 50

# Monitor continuously
gcloud run logs read venueflow --limit 50 --follow
```

## Step 7: Get Your Live URL

```bash
# Get the service URL
gcloud run services describe venueflow \
  --region us-central1 \
  --format='value(status.url)'

# Expected output: https://venueflow-XXXXX.a.run.app
```

## Troubleshooting

### Issue: Deployment Fails with "Build Failed"
```bash
# Check Cloud Build logs
gcloud builds log LAST
```

### Issue: Service Returns 500 Error
```bash
# Check service logs
gcloud run logs read venueflow --limit 100

# Verify configuration
gcloud run services describe venueflow
```

### Issue: Timeout During Deployment
```bash
# Increase timeout
gcloud run deploy venueflow \
  --timeout 600 \
  --source .
```

## Monitoring and Maintenance

### View Metrics
```bash
gcloud monitoring dashboards describe DASHBOARD_ID
```

### Auto-scaling Configuration
```bash
gcloud run deploy venueflow \
  --min-instances 1 \
  --max-instances 100
```

### Update Deployment
```bash
# Make code changes
git add .
git commit -m "Update features"

# Redeploy
gcloud run deploy venueflow --source .
```

## Cost Optimization

1. **Set min instances to 0** (cold starts are acceptable)
   - Reduces idle costs
   
2. **Use smaller memory allocation** (256Mi is sufficient)
   - Default: 256Mi (supports most use cases)

3. **Monitor invocation metrics**
   ```bash
   gcloud monitoring time-series list \
     --filter 'metric.type = "run.googleapis.com/request_count"'
   ```

## Continuous Deployment (Optional)

Connect GitHub for automatic deployments:

```bash
# Authorize Cloud Build
gcloud builds connect --repository-name venueflow \
  --repository-owner YOUR_GITHUB_USERNAME

# Create Cloud Build configuration
# This will create cloudbuild.yaml in your repository
```

## Rollback Deployment

```bash
# List previous revisions
gcloud run revisions list --service venueflow

# Revert to previous version
gcloud run deploy venueflow \
  --revision REVISION_ID \
  --region us-central1
```

## Custom Domain Setup (Optional)

```bash
# Map custom domain
gcloud run domain-mappings create \
  --service=venueflow \
  --domain=yourdomain.com \
  --region=us-central1

# Verify DNS settings
gcloud run domain-mappings describe yourdomain.com
```

## Performance Tips

1. **Enable caching headers** - Already configured in nginx.conf
2. **Compress responses** - Gzip enabled for text/js/css
3. **Use Cloud CDN** - Optional for faster content delivery
4. **Monitor performance**:
   ```bash
   gcloud run describe venueflow | grep "Memory:"
   ```

## Security Best Practices

1. ✅ Authentication: Configure OAuth if needed
2. ✅ CORS: Configured in nginx
3. ✅ HTTPS: Automatic with Cloud Run
4. ✅ Security Headers: Set in nginx.conf
5. ✅ Rate limiting: Consider adding Cloud Armor

## Support

For issues:
1. Check Cloud Run logs: `gcloud run logs read venueflow`
2. Verify Cloud Build logs: `gcloud builds log LAST`
3. Contact GCP Support for infrastructure issues

---

**Happy Deploying!** 🚀

Last Updated: April 2026
