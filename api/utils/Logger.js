class Logger {
  constructor(service = 'SYSTEM') {
    this.service = service;
    this.colors = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m'
    };
  }

  /**
   * 获取格式化的时间戳
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * 格式化日志前缀
   */
  formatPrefix(level) {
    return `[${this.getTimestamp()}] [${this.service}] [${level}]`;
  }

  /**
   * 信息日志 - 一般信息
   */
  info(message, ...args) {
    console.log(`${this.formatPrefix('INFO')} ${message}`, ...args);
  }

  /**
   * 成功日志 - 操作成功
   */
  success(message, ...args) {
    console.log(`${this.formatPrefix('SUCCESS')} ✅ ${message}`, ...args);
  }

  /**
   * 错误日志 - 操作失败
   */
  error(message, ...args) {
    console.error(`${this.formatPrefix('ERROR')} ❌ ${message}`, ...args);
  }

  /**
   * 警告日志 - 需要注意的情况
   */
  warn(message, ...args) {
    console.warn(`${this.formatPrefix('WARN')} ⚠️ ${message}`, ...args);
  }

  /**
   * 调试日志 - 调试信息
   */
  debug(message, ...args) {
    console.log(`${this.formatPrefix('DEBUG')} 🔍 ${message}`, ...args);
  }

  /**
   * 步骤日志 - 流程步骤
   */
  step(stepNumber, message, ...args) {
    console.log(`${this.formatPrefix('STEP')} 📋 步骤${stepNumber}: ${message}`, ...args);
  }

  /**
   * 数据库操作日志
   */
  database(operation, message, ...args) {
    console.log(`${this.formatPrefix('DATABASE')} 🗄️ [${operation}] ${message}`, ...args);
  }

  /**
   * API 调用日志
   */
  api(method, endpoint, message, ...args) {
    console.log(`${this.formatPrefix('API')} 🌐 [${method}] ${endpoint} - ${message}`, ...args);
  }

  /**
   * 认证相关日志
   */
  auth(message, ...args) {
    console.log(`${this.formatPrefix('AUTH')} 🔐 ${message}`, ...args);
  }

  /**
   * 分隔线 - 用于分隔不同的操作流程
   */
  separator(title = '') {
    const line = '='.repeat(50);
    if (title) {
      console.log(`\n${line}`);
      console.log(`🚀 ${title}`);
      console.log(`${line}\n`);
    } else {
      console.log(`\n${line}\n`);
    }
  }

  /**
   * 结束标记
   */
  complete(message = '操作完成') {
    console.log(`${this.formatPrefix('COMPLETE')} 🎉 ${message}\n`);
  }

  /**
   * 检查项日志 - 用于环境变量检查等
   */
  check(item, status, value = '') {
    const statusIcon = status ? '✅' : '❌';
    const statusText = status ? '已设置' : '未设置';
    const displayValue = value ? ` (${value})` : '';
    console.log(`${this.formatPrefix('CHECK')} ${statusIcon} ${item}: ${statusText}${displayValue}`);
  }

  /**
   * 数据展示 - 格式化显示对象数据
   */
  data(label, data, hideDetails = false) {
    if (hideDetails) {
      console.log(`${this.formatPrefix('DATA')} 📊 ${label}: [数据已隐藏]`);
    } else {
      console.log(`${this.formatPrefix('DATA')} 📊 ${label}:`, data);
    }
  }

  /**
   * 流程开始
   */
  startFlow(flowName) {
    this.separator(`开始 ${flowName} 流程`);
  }

  /**
   * 流程结束
   */
  endFlow(flowName, success = true) {
    const status = success ? '成功完成' : '执行失败';
    const icon = success ? '🎉' : '💥';
    this.separator(`${flowName} 流程${status} ${icon}`);
  }

  /**
   * 创建子日志器 - 用于不同模块
   */
  createChild(childService) {
    return new Logger(`${this.service}:${childService}`);
  }
}

module.exports = Logger;