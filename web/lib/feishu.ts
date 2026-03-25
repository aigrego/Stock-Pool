import { query } from '@/lib/db';
import { AlertCheckResult } from '@/lib/alerts';

interface FeishuConfig {
  webhookUrl?: string;
  userId?: string;
}

// 获取飞书配置
async function getFeishuConfig(): Promise<FeishuConfig> {
  // 从环境变量获取
  return {
    webhookUrl: process.env.FEISHU_WEBHOOK_URL,
    userId: process.env.FEISHU_USER_ID
  };
}

// 发送飞书文本消息
async function sendFeishuText(content: string, config: FeishuConfig): Promise<boolean> {
  if (!config.webhookUrl) {
    console.warn('Feishu webhook URL not configured');
    return false;
  }
  
  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        msg_type: 'text',
        content: {
          text: content
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.code !== 0) {
      throw new Error(result.msg || 'Unknown error');
    }
    
    console.log('✅ Feishu message sent successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to send Feishu message:', error);
    return false;
  }
}

// 发送飞书卡片消息（更美观）
async function sendFeishuCard(
  alerts: AlertCheckResult[],
  config: FeishuConfig
): Promise<boolean> {
  if (!config.webhookUrl) {
    console.warn('Feishu webhook URL not configured');
    return false;
  }
  
  // 按严重程度分组
  const critical = alerts.filter(a => a.severity === 'critical');
  const warning = alerts.filter(a => a.severity === 'warning');
  const info = alerts.filter(a => a.severity === 'info');
  
  const elements: any[] = [];
  
  // 添加严重预警
  if (critical.length > 0) {
    elements.push({
      tag: 'div',
      text: {
        tag: 'plain_text',
        content: `🔴 严重预警 (${critical.length})`
      }
    });
    critical.forEach(alert => {
      elements.push({
        tag: 'div',
        text: {
          tag: 'plain_text',
          content: `• ${alert.title}: ${alert.message}`
        }
      });
    });
  }
  
  // 添加警告预警
  if (warning.length > 0) {
    if (elements.length > 0) {
      elements.push({ tag: 'hr' });
    }
    elements.push({
      tag: 'div',
      text: {
        tag: 'plain_text',
        content: `🟠 警告预警 (${warning.length})`
      }
    });
    warning.forEach(alert => {
      elements.push({
        tag: 'div',
        text: {
          tag: 'plain_text',
          content: `• ${alert.title}: ${alert.message}`
        }
      });
    });
  }
  
  // 添加信息预警
  if (info.length > 0) {
    if (elements.length > 0) {
      elements.push({ tag: 'hr' });
    }
    elements.push({
      tag: 'div',
      text: {
        tag: 'plain_text',
        content: `🟢 信息提示 (${info.length})`
      }
    });
    info.forEach(alert => {
      elements.push({
        tag: 'div',
        text: {
          tag: 'plain_text',
          content: `• ${alert.title}: ${alert.message}`
        }
      });
    });
  }
  
  const card = {
    config: {
      wide_screen_mode: true
    },
    header: {
      title: {
        tag: 'plain_text',
        content: '📊 股票池预警通知'
      },
      template: critical.length > 0 ? 'red' : warning.length > 0 ? 'orange' : 'green'
    },
    elements
  };
  
  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        msg_type: 'interactive',
        card
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.code !== 0) {
      throw new Error(result.msg || 'Unknown error');
    }
    
    console.log('✅ Feishu card sent successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to send Feishu card:', error);
    return false;
  }
}

// 记录已发送的预警（防重复）
async function isAlertRecentlySent(
  code: string,
  alertType: string,
  minutes: number = 30
): Promise<boolean> {
  const result = await query<{ count: number }>(`
    SELECT COUNT(*) as count FROM alert_history 
    WHERE code = ? 
    AND alert_type = ? 
    AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
  `, [code, alertType, minutes]);
  
  return result[0]?.count > 0;
}

// 记录预警历史
async function recordAlertHistory(
  code: string,
  alertType: string,
  severity: string,
  message: string,
  currentValue: number,
  thresholdValue: number
): Promise<void> {
  await query(`
    INSERT INTO alert_history 
    (code, alert_type, severity, message, current_value, threshold_value, created_at)
    VALUES (?, ?, ?, ?, ?, ?, NOW())
  `, [code, alertType, severity, message, currentValue, thresholdValue]);
}

// 推送预警到飞书（带防重复）
export async function pushAlertsToFeishu(
  alerts: AlertCheckResult[],
  options: { skipDuplicate?: boolean; duplicateMinutes?: number } = {}
): Promise<{ sent: boolean; count: number }> {
  const { skipDuplicate = true, duplicateMinutes = 30 } = options;
  
  if (alerts.length === 0) {
    return { sent: false, count: 0 };
  }
  
  const config = await getFeishuConfig();
  
  if (!config.webhookUrl) {
    console.warn('⚠️ Feishu not configured, skipping push');
    return { sent: false, count: 0 };
  }
  
  // 过滤重复预警
  let filteredAlerts = alerts;
  if (skipDuplicate) {
    filteredAlerts = [];
    for (const alert of alerts) {
      const recentlySent = await isAlertRecentlySent(
        alert.code,
        alert.type,
        duplicateMinutes
      );
      
      if (!recentlySent) {
        filteredAlerts.push(alert);
        // 记录到历史
        await recordAlertHistory(
          alert.code,
          alert.type,
          alert.severity,
          alert.message,
          alert.currentValue,
          alert.thresholdValue
        );
      } else {
        console.log(`⏭️ Skipping duplicate alert: ${alert.code} - ${alert.type}`);
      }
    }
  }
  
  if (filteredAlerts.length === 0) {
    console.log('⏭️ All alerts are duplicates, skipping push');
    return { sent: false, count: 0 };
  }
  
  // 发送飞书通知
  const sent = await sendFeishuCard(filteredAlerts, config);
  
  return { sent, count: filteredAlerts.length };
}

// 初始化预警历史表
export async function initAlertHistoryTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS alert_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(20) NOT NULL,
      alert_type VARCHAR(50) NOT NULL,
      severity VARCHAR(20) NOT NULL,
      message TEXT,
      current_value DECIMAL(10, 4),
      threshold_value DECIMAL(10, 4),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_code_time (code, created_at),
      INDEX idx_created_at (created_at)
    )
  `);
  console.log('✅ Alert history table initialized');
}
