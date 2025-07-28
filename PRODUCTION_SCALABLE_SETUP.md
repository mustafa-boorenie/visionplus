# Production-Ready Scalable Browser Automation Setup

## VNC Limitations for Production

While Docker with VNC is great for development, it has limitations for production:

1. **One VNC session per display** - Each VNC connection typically needs its own X display
2. **Port management** - Each VNC server needs a unique port (5900, 5901, etc.)
3. **Resource intensive** - Running full desktop environments for each session
4. **Security concerns** - VNC passwords are often weak and connections aren't always encrypted

## Recommended Production Architecture

### Option 1: Browserless Cloud (Simplest)

Use Browserless as a service without VNC, but with session recording:

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  browserless:
    image: browserless/chrome:latest
    environment:
      - CONNECTION_TIMEOUT=300000
      - MAX_CONCURRENT_SESSIONS=10
      - ENABLE_CORS=true
      - TOKEN=your-secret-token
      - WORKSPACE_DELETE_EXPIRED=true
      - WORKSPACE_EXPIRE_DAYS=1
      - FUNCTION_ENABLE_INCOGNITO_MODE=true
      - ENABLE_API_GET=false
      - DEFAULT_IGNORE_HTTPS_ERRORS=true
    ports:
      - "3010:3000"
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

### Option 2: EC2 Auto-Scaling Architecture

```
┌─────────────────┐
│   CloudFront    │
│      (CDN)      │
└────────┬────────┘
         │
┌────────┴────────┐
│  Load Balancer  │
│   (ALB/NLB)     │
└────────┬────────┘
         │
┌────────┴────────────────────────┐
│     Auto Scaling Group          │
│  ┌──────────┐  ┌──────────┐    │
│  │  EC2 #1  │  │  EC2 #2  │    │
│  │ Backend + │  │ Backend + │    │
│  │Browserless│  │Browserless│    │
│  └──────────┘  └──────────┘    │
└─────────────────────────────────┘
         │
┌────────┴────────┐
│   RDS/DynamoDB  │
│   (Sessions)    │
└─────────────────┘
```

#### 1. Create Auto-Scaling Launch Template

```bash
#!/bin/bash
# user-data.sh for EC2 instances

# Install Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose

# Setup the application
git clone https://github.com/your-repo/ai-playwright-scripter.git
cd ai-playwright-scripter

# Create docker-compose for production
cat > docker-compose.yml << EOF
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - BROWSERLESS_URL=http://browserless:3000
      - SESSION_STORE=redis
      - REDIS_URL=redis://redis:6379
    depends_on:
      - browserless
      - redis

  browserless:
    image: browserless/chrome:latest
    environment:
      - CONNECTION_TIMEOUT=300000
      - MAX_CONCURRENT_SESSIONS=5
      - TOKEN=${BROWSERLESS_TOKEN}
    ports:
      - "3010:3000"

  redis:
    image: redis:alpine
    volumes:
      - redis-data:/data

volumes:
  redis-data:
EOF

# Start services
docker-compose up -d
```

#### 2. Configure Auto-Scaling Group

```terraform
# terraform/autoscaling.tf
resource "aws_autoscaling_group" "browser_automation" {
  name                = "browser-automation-asg"
  vpc_zone_identifier = aws_subnet.private[*].id
  target_group_arns   = [aws_lb_target_group.backend.arn]
  health_check_type   = "ELB"
  min_size            = 2
  max_size            = 10
  desired_capacity    = 2

  launch_template {
    id      = aws_launch_template.browser_automation.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "browser-automation-instance"
    propagate_at_launch = true
  }
}

resource "aws_autoscaling_policy" "scale_up" {
  name                   = "browser-automation-scale-up"
  scaling_adjustment     = 2
  adjustment_type        = "ChangeInCapacity"
  cooldown              = 300
  autoscaling_group_name = aws_autoscaling_group.browser_automation.name
}

resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "browser-automation-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "120"
  statistic           = "Average"
  threshold           = "70"
  alarm_actions       = [aws_autoscaling_policy.scale_up.arn]
}
```

### Option 3: Browser Streaming at Scale

For showing browser sessions to multiple users simultaneously:

#### A. Session Recording + Playback

```typescript
// src/browser/SessionRecorder.ts
import { Page } from 'playwright';
import { S3 } from 'aws-sdk';

export class SessionRecorder {
  private s3 = new S3();
  
  async recordSession(page: Page, sessionId: string) {
    // Start video recording
    await page.video().saveAs(`/tmp/${sessionId}.webm`);
    
    // Upload to S3 when done
    await this.s3.upload({
      Bucket: 'browser-recordings',
      Key: `sessions/${sessionId}.webm`,
      Body: fs.createReadStream(`/tmp/${sessionId}.webm`)
    }).promise();
    
    return `https://cdn.example.com/sessions/${sessionId}.webm`;
  }
}
```

#### B. Live Streaming with Media Server

```yaml
# docker-compose with media server
version: '3.8'

services:
  media-server:
    image: bluenviron/mediamtx:latest
    ports:
      - "8554:8554" # RTSP
      - "1935:1935" # RTMP
      - "8888:8888" # HLS
      - "8889:8889" # WebRTC
    environment:
      - MTX_PROTOCOLS=tcp
  
  browser-streamer:
    build: ./browser-streamer
    environment:
      - RTMP_URL=rtmp://media-server:1935/live
      - BROWSER_URL=http://browserless:3000
```

```typescript
// browser-streamer/index.ts
import { chromium } from 'playwright';
import ffmpeg from 'fluent-ffmpeg';

export class BrowserStreamer {
  async streamSession(sessionId: string, page: Page) {
    const video = await page.video();
    
    // Stream to RTMP server
    ffmpeg()
      .input(video.path())
      .inputOptions(['-re'])
      .outputOptions([
        '-c:v libx264',
        '-preset veryfast',
        '-maxrate 3000k',
        '-bufsize 6000k',
        '-pix_fmt yuv420p',
        '-g 50',
        '-c:a aac',
        '-b:a 160k',
        '-f flv'
      ])
      .output(`rtmp://media-server:1935/live/${sessionId}`)
      .run();
  }
}
```

### Option 4: Managed Browser Services

Consider using managed services that handle scaling automatically:

1. **AWS Device Farm** - Managed browser testing
2. **BrowserStack** - Cloud browser infrastructure
3. **Sauce Labs** - Scalable browser automation
4. **LambdaTest** - Cloud-based testing platform

### Session Management for Scale

```typescript
// src/session/RedisSessionManager.ts
import Redis from 'ioredis';
import { nanoid } from 'nanoid';

export class RedisSessionManager {
  private redis: Redis;
  private pubClient: Redis;
  private subClient: Redis;
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.pubClient = new Redis(process.env.REDIS_URL);
    this.subClient = new Redis(process.env.REDIS_URL);
  }
  
  async createSession(userId: string): Promise<string> {
    const sessionId = nanoid();
    const instanceId = await this.selectInstance();
    
    await this.redis.hset(`session:${sessionId}`, {
      userId,
      instanceId,
      createdAt: Date.now(),
      status: 'active'
    });
    
    // Notify instance to create browser
    await this.pubClient.publish(`instance:${instanceId}`, JSON.stringify({
      action: 'create',
      sessionId
    }));
    
    return sessionId;
  }
  
  private async selectInstance(): Promise<string> {
    // Get all instances and their load
    const instances = await this.redis.keys('instance:*:metrics');
    
    let bestInstance = null;
    let lowestLoad = Infinity;
    
    for (const key of instances) {
      const metrics = await this.redis.hgetall(key);
      const load = parseInt(metrics.activeSessions) / parseInt(metrics.maxSessions);
      
      if (load < lowestLoad) {
        lowestLoad = load;
        bestInstance = key.split(':')[1];
      }
    }
    
    return bestInstance || 'default';
  }
}
```

### Monitoring and Observability

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
  
  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
  
  node-exporter:
    image: prom/node-exporter
    ports:
      - "9100:9100"
```

### Cost Optimization Tips

1. **Use Spot Instances** for non-critical workloads
2. **Implement session timeouts** to free resources
3. **Use smaller instance types** with container limits
4. **Cache browser instances** between sessions
5. **Compress and archive recordings** after processing

### Security Best Practices

1. **Network Isolation** - Keep browsers in private subnets
2. **Token Authentication** - Secure all endpoints
3. **Session Isolation** - Use incognito/separate contexts
4. **Resource Limits** - Prevent DoS attacks
5. **Audit Logging** - Track all automation activities

## Recommended Architecture for Your Use Case

For scalable browser automation with viewing capabilities:

1. **API Layer**: Use Browserless without VNC for automation
2. **Recording**: Capture videos of important sessions
3. **Live Preview**: Implement periodic screenshot streaming
4. **Full Streaming**: Use WebRTC for selected high-priority sessions

This gives you the best balance of scalability, cost, and functionality. 