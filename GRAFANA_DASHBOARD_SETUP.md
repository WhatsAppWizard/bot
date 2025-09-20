# WhatsApp Bot - Grafana Loki Dashboard Setup Guide

## Overview

This dashboard provides comprehensive monitoring and analysis of your WhatsApp bot's logging system using Grafana and Loki. It includes real-time metrics, error tracking, search functionality, and detailed analytics.

## Dashboard Features

### 📊 Key Metrics Panels
- **Error Rate by Context and Type**: Tracks error frequency across different system contexts
- **WhatsApp Events Rate**: Monitors WhatsApp-specific events (authentication, disconnection, etc.)
- **Download Events Rate**: Tracks download completion and failure rates
- **Info Logs by Context**: Shows information-level logging across different contexts
- **Message Processing Rate by User**: Analyzes message processing performance per user

### 📈 Statistics Cards
- **Total Errors (1h)**: Real-time error count
- **Downloads Completed (1h)**: Successfully completed downloads
- **WhatsApp Authentications (1h)**: Authentication events
- **Total Info Logs (1h)**: Information-level log count

### 🔍 Search & Analysis
- **Logs Explorer**: Full-text search through all logs with filtering
- **Log Level Distribution**: Pie chart showing log level breakdown
- **Error Types Distribution**: Categorization of different error types

### 🏷️ Dynamic Filters
- **Log Level**: Filter by error, warn, info, debug
- **Context**: Filter by whatsapp, download, message, system, etc.
- **Event Type**: Filter by specific events (authenticated, completed, failed, etc.)
- **User ID**: Filter logs by specific users
- **Error Type**: Filter by error categories

## Prerequisites

1. **Grafana** (v8.0+)
2. **Loki** data source configured
3. **WhatsApp Bot** running with Loki transport enabled

## Installation Steps

### 1. Configure Loki Data Source

In Grafana, add a new Loki data source:

```yaml
# grafana-datasources.yml
apiVersion: 1
datasources:
  - name: loki
    type: loki
    access: proxy
    url: http://localhost:3100  # Adjust to your Loki URL
    uid: loki
    isDefault: true
    jsonData:
      maxLines: 1000
      derivedFields:
        - datasourceUid: loki
          matcherRegex: "traceID=(\\w+)"
          name: TraceID
          url: "$${__value.raw}"
```

### 2. Import Dashboard

1. Open Grafana
2. Go to **Dashboards** → **Import**
3. Copy the contents of `grafana-dashboard.json`
4. Paste into the import dialog
5. Click **Load**
6. Select your Loki data source
7. Click **Import**

### 3. Verify Data Source Connection

Ensure your Loki data source is properly configured and receiving logs from your WhatsApp bot.

## Dashboard Configuration

### Environment Variables

Make sure your WhatsApp bot has these environment variables set:

```bash
# Loki Configuration
LOKI_HOST=http://localhost:3100
LOKI_USERNAME=your_username  # Optional
LOKI_PASSWORD=your_password  # Optional

# Log Level
LOG_LEVEL=info  # or debug, warn, error
```

### Log Labels Structure

The dashboard expects these labels in your logs:

```json
{
  "level": "error|warn|info|debug",
  "context": "whatsapp|download|message|system|analytics",
  "event": "authenticated|auth_failure|disconnected|ready|completed|failed|processed",
  "userId": "user_identifier",
  "errorType": "Error|TypeError|ReferenceError|etc",
  "downloadId": "download_identifier",
  "messageId": "message_identifier"
}
```

## Usage Guide

### 🔍 Searching Logs

1. **Use the Logs Explorer panel** for full-text search
2. **Apply filters** using the template variables at the top
3. **Combine filters** for precise log analysis
4. **Use LogQL queries** for advanced filtering

### 📊 Monitoring Key Metrics

- **Error Rate**: Watch for spikes in error rates
- **Authentication Events**: Monitor WhatsApp connection status
- **Download Performance**: Track success/failure rates
- **User Activity**: Analyze message processing by user

### 🚨 Setting Up Alerts

Create alerts for critical metrics:

```yaml
# Example alert rules
groups:
  - name: whatsapp-bot-alerts
    rules:
      - alert: HighErrorRate
        expr: sum(rate({job="whatsapp-bot"} |= "" | json | level="error" [5m])) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          
      - alert: WhatsAppDisconnected
        expr: sum(count_over_time({job="whatsapp-bot"} |= "" | json | context="whatsapp" | event="disconnected" [5m])) > 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "WhatsApp disconnected"
```

### 📈 Custom Queries

Use these LogQL patterns for custom analysis:

```logql
# All errors in the last hour
{job="whatsapp-bot"} |= "" | json | level="error"

# Download failures by user
{job="whatsapp-bot"} |= "" | json | context="download" | event="failed" | json userId

# Message processing time analysis
{job="whatsapp-bot"} |= "" | json | context="message" | json processingTime

# Authentication events
{job="whatsapp-bot"} |= "" | json | context="whatsapp" | event=~"authenticated|auth_failure|disconnected|ready"
```

## Troubleshooting

### Common Issues

1. **No data showing**:
   - Verify Loki data source connection
   - Check if logs are being sent to Loki
   - Ensure job label matches "whatsapp-bot"

2. **Filters not working**:
   - Verify label names in your logs match the dashboard expectations
   - Check if labels are properly extracted by Loki

3. **Performance issues**:
   - Reduce time range for large datasets
   - Use more specific LogQL queries
   - Consider log retention policies

### LogQL Query Examples

```logql
# Basic log search
{job="whatsapp-bot"}

# Filter by level
{job="whatsapp-bot"} |= "" | json | level="error"

# Filter by context
{job="whatsapp-bot"} |= "" | json | context="whatsapp"

# Multiple filters
{job="whatsapp-bot"} |= "" | json | level="error" | context="download"

# Rate queries
sum(rate({job="whatsapp-bot"} |= "" | json | level="error" [5m]))

# Count over time
sum(count_over_time({job="whatsapp-bot"} |= "" | json [1h]))
```

## Customization

### Adding New Panels

1. Click **Add Panel** in the dashboard
2. Choose visualization type
3. Write LogQL query
4. Configure panel settings
5. Save dashboard

### Modifying Existing Panels

1. Click panel title → **Edit**
2. Modify LogQL query in Query tab
3. Adjust visualization settings
4. Save changes

### Adding New Variables

1. Go to Dashboard Settings → Variables
2. Add new variable with appropriate query
3. Update panel queries to use new variable

## Best Practices

1. **Regular Monitoring**: Check dashboard daily for anomalies
2. **Alert Setup**: Configure alerts for critical metrics
3. **Log Retention**: Set appropriate retention policies
4. **Performance**: Use efficient LogQL queries
5. **Documentation**: Document custom queries and alerts

## Support

For issues or questions:
1. Check Grafana and Loki documentation
2. Verify log format and labels
3. Test LogQL queries in Explore mode
4. Check Loki data source configuration

---

**Dashboard Version**: 1.0  
**Compatible with**: Grafana 8.0+, Loki 2.0+  
**Last Updated**: 2024
