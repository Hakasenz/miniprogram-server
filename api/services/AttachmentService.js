const { MongoClient } = require('mongodb');
const Logger = require('../utils/Logger');

class AttachmentService {
  constructor() {
    this.db = null;
    this.mongoClient = null;
    this.MONGODB_URI = process.env.MONGODB_URI;
    this.DATABASE_NAME = process.env.DATABASE_NAME || 'miniprogram';
    
    // 创建日志器实例
    this.logger = new Logger('AttachmentService');
  }

  /**
   * 初始化数据库连接
   */
  async initDatabase() {
    this.logger.info('开始初始化数据库连接...');
    this.logger.debug(`数据库连接状态 - db: ${!!this.db}, URI: ${!!this.MONGODB_URI}`);
    
    if (!this.db && this.MONGODB_URI) {
      try {
        this.logger.database('CONNECT', '正在连接到 MongoDB Atlas...');
        this.mongoClient = new MongoClient(this.MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
          socketTimeoutMS: 10000
        });
        
        const connectPromise = this.mongoClient.connect();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('数据库连接超时（5秒）')), 5000);
        });
        
        await Promise.race([connectPromise, timeoutPromise]);
        
        this.db = this.mongoClient.db(this.DATABASE_NAME);
        this.logger.success(`MongoDB 连接成功！数据库: ${this.DATABASE_NAME}`);
        
        await this.db.admin().ping();
        this.logger.success('数据库 ping 测试成功');
      } catch (error) {
        this.logger.error('MongoDB 连接失败:', error.message);
        this.logger.error('错误详情:', error);
        throw error;
      }
    } else if (this.db) {
      this.logger.success('✅ 数据库连接已存在，跳过初始化');
    } else {
      this.logger.warn('⚠️ MONGODB_URI 未配置，将使用模拟模式');
    }
  }

  /**
   * ⭐ 上传附件（二进制存储到 MongoDB appendix 集合）
   */
  async uploadAttachment({ file_data, file_name, file_type, project_id, step_id, uploader_uuid }) {
    this.logger.info('开始上传附件...');
    this.logger.data('附件信息', { file_name, file_type, project_id, step_id });

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接，返回模拟数据');
        return {
          success: true,
          data: {
            file_hash: `mock-${Date.now()}`,
            file_name,
            file_type,
            file_size: Buffer.byteLength(file_data, 'base64')
          }
        };
      }

      // ⭐ 生成唯一文件哈希（使用 SHA256）
      const crypto = require('crypto');
      const fileHash = crypto.createHash('sha256')
        .update(file_data + Date.now() + Math.random())
        .digest('hex');

      this.logger.info(`生成文件哈希: ${fileHash}`);

      // ⭐ 检查是否已存在相同哈希的文件（避免重复上传）
      const existingFile = await this.db.collection('appendix').findOne({ file_hash: fileHash });
      
      if (existingFile) {
        this.logger.info('文件已存在，返回现有哈希');
        return {
          success: true,
          data: {
            file_hash: existingFile.file_hash,
            file_name: existingFile.file_name,
            file_type: existingFile.file_type,
            file_size: existingFile.file_size,
            is_duplicate: true
          }
        };
      }

      // ⭐ 构建附件文档
      const attachmentDoc = {
        file_hash: fileHash,
        file_name: file_name,
        file_type: file_type,
        file_data: file_data,  // Base64 编码的二进制数据
        file_size: Buffer.byteLength(file_data, 'base64'),
        project_id: project_id,
        step_id: step_id || null,
        uploader_uuid: uploader_uuid,
        upload_time: new Date().toISOString(),
        download_count: 0
      };

      this.logger.database('INSERT', 'db.appendix.insertOne - 存储附件二进制数据');

      // ⭐ 插入到 appendix 集合
      const result = await this.db.collection('appendix').insertOne(attachmentDoc);

      if (result.insertedId) {
        this.logger.success(`附件上传成功！文件哈希: ${fileHash}`);
        this.logger.info(`文件大小: ${attachmentDoc.file_size} bytes`);
        
        return {
          success: true,
          data: {
            file_hash: fileHash,
            file_name: file_name,
            file_type: file_type,
            file_size: attachmentDoc.file_size
          }
        };
      } else {
        this.logger.error('附件插入失败');
        return {
          success: false,
          error: '附件插入失败'
        };
      }

    } catch (error) {
      this.logger.error('上传附件失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '上传附件失败',
        details: error.message
      };
    }
  }

  /**
   * ⭐ 获取附件（通过哈希值从 appendix 集合查询）
   */
  async getAttachment(fileHash) {
    this.logger.info('开始获取附件...');
    this.logger.info(`文件哈希: ${fileHash}`);

    try {
      await this.initDatabase();

      if (!this.db) {
        this.logger.warn('数据库未连接');
        return {
          success: false,
          error: '数据库未连接'
        };
      }

      this.logger.database('QUERY', 'db.appendix.findOne - 通过哈希查询附件');

      // ⭐ 从 appendix 集合查询
      const attachment = await this.db.collection('appendix').findOne({ 
        file_hash: fileHash 
      });

      if (!attachment) {
        this.logger.warn(`未找到文件哈希为 ${fileHash} 的附件`);
        return {
          success: false,
          error: '附件不存在'
        };
      }

      this.logger.success('附件获取成功');
      this.logger.data('附件信息', {
        file_name: attachment.file_name,
        file_type: attachment.file_type,
        file_size: attachment.file_size
      });

      // ⭐ 更新下载次数
      await this.db.collection('appendix').updateOne(
        { file_hash: fileHash },
        { $inc: { download_count: 1 } }
      );

      return {
        success: true,
        data: {
          file_hash: attachment.file_hash,
          file_name: attachment.file_name,
          file_type: attachment.file_type,
          file_data: attachment.file_data,  // Base64 编码的二进制数据
          file_size: attachment.file_size,
          upload_time: attachment.upload_time,
          download_count: attachment.download_count + 1
        }
      };

    } catch (error) {
      this.logger.error('获取附件失败:', error.message);
      this.logger.error('错误详情:', error);
      return {
        success: false,
        error: '获取附件失败',
        details: error.message
      };
    }
  }

  /**
   * 关闭数据库连接
   */
  async closeConnection() {
    if (this.mongoClient) {
      await this.mongoClient.close();
      this.logger.info('数据库连接已关闭');
    }
  }
}

module.exports = AttachmentService;
