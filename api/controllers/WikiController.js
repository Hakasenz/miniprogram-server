const { MongoClient } = require('mongodb');
const Logger = require('../utils/Logger');
const crypto = require('crypto');

class WikiController {
  constructor() {
    this.logger = new Logger('WikiController');
    this.db = null;
    this.MONGODB_URI = process.env.MONGODB_URI || 'your_mongodb_connection_string';
    this.DATABASE_NAME = process.env.DATABASE_NAME || 'miniprogram';
  }

  /**
   * 初始化数据库连接
   */
  async initDatabase() {
    if (this.db) return;
    
    try {
      const mongoClient = new MongoClient(this.MONGODB_URI);
      await mongoClient.connect();
      this.db = mongoClient.db(this.DATABASE_NAME);
      this.logger.success('MongoDB 连接成功');
    } catch (error) {
      this.logger.error('MongoDB 连接失败:', error.message);
    }
  }

  /**
   * ⭐ 获取Wiki列表
   */
  async getWikiList(req, res) {
    const logger = new Logger('WikiController.getWikiList');
    
    logger.separator('收到获取Wiki列表请求');
    logger.info('开始处理...');

    try {
      const { company_id } = req.body;

      if (!company_id) {
        logger.error('缺少公司ID参数');
        return res.status(400).json({
          status: 'error',
          message: '缺少 company_id 参数'
        });
      }

      logger.info(`查询组织Wiki: ${company_id}`);
      
      await this.initDatabase();

      if (!this.db) {
        return res.status(500).json({
          status: 'error',
          message: '数据库连接失败'
        });
      }

      // 查询该组织的所有Wiki
      const wikis = await this.db.collection('wiki')
        .find({ company_id: company_id })
        .sort({ created_at: -1 })
        .toArray();

      // 获取组织名称
      const company = await this.db.collection('companies').findOne(
        { _id: this._convertToObjectId(company_id) },
        { projection: { name: 1 } }
      );

      logger.success(`获取到 ${wikis.length} 个Wiki文档`);

      res.json({
        status: 'success',
        data: {
          wikis: wikis,
          company_name: company ? company.name : '未知组织'
        }
      });

    } catch (err) {
      logger.error('服务器异常:', err.message);
      logger.error('错误堆栈:', err.stack);
      res.status(500).json({
        status: 'error',
        message: '获取Wiki列表时发生异常',
        details: err.message
      });
    }
  }

  /**
   * ⭐ 上传附件
   */
  async uploadAttachment(req, res) {
    const logger = new Logger('WikiController.uploadAttachment');
    
    logger.separator('收到上传附件请求');
    logger.info('开始处理...');

    try {
      const { file_name, file_type, file_size, file_data, company_id } = req.body;

      if (!file_name || !file_data || !company_id) {
        logger.error('缺少必需参数');
        return res.status(400).json({
          status: 'error',
          message: '缺少必需参数',
          required: ['file_name', 'file_data', 'company_id']
        });
      }

      logger.info(`上传文件: ${file_name}, 大小: ${file_size} bytes`);
      
      await this.initDatabase();

      if (!this.db) {
        return res.status(500).json({
          status: 'error',
          message: '数据库连接失败'
        });
      }

      // 计算文件哈希（用于去重和唯一标识）
      const fileHash = crypto.createHash('sha256').update(file_data).digest('hex');
      
      logger.info(`文件哈希: ${fileHash}`);

      // 生成唯一文件名（防止冲突）
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const uniqueFileName = `${randomStr}${timestamp}_${file_name}`;

      // 保存到 appendix 集合
      const attachmentDoc = {
        file_hash: fileHash,
        file_name: uniqueFileName,
        original_name: file_name,
        file_type: file_type || 'application/octet-stream',
        file_data: file_data,  // Base64编码的文件数据
        file_size: parseInt(file_size),
        company_id: company_id,  // ⭐ 关键：关联到组织，避免与其他项目混淆
        project_id: null,  // Wiki附件不属于任何项目
        step_id: null,
        uploader_uuid: null,  // 后续可从token中获取
        upload_time: new Date().toISOString(),
        download_count: 0
      };

      logger.database('INSERT', 'db.appendix.insertOne - 保存附件');

      const result = await this.db.collection('appendix').insertOne(attachmentDoc);

      if (!result.insertedId) {
        logger.error('附件保存失败');
        return res.status(500).json({
          status: 'error',
          message: '附件保存失败'
        });
      }

      logger.success('附件上传成功');

      res.json({
        status: 'success',
        message: '上传成功',
        data: {
          file_hash: fileHash,
          file_name: uniqueFileName,
          file_size: parseInt(file_size),
          file_type: file_type
        }
      });

    } catch (err) {
      logger.error('服务器异常:', err.message);
      logger.error('错误堆栈:', err.stack);
      res.status(500).json({
        status: 'error',
        message: '上传附件时发生异常',
        details: err.message
      });
    }
  }

  /**
   * ⭐ 创建Wiki
   */
  async createWiki(req, res) {
    const logger = new Logger('WikiController.createWiki');
    
    logger.separator('收到创建Wiki请求');
    logger.info('开始处理...');

    try {
      const { title, content, company_id, creator_uuid, attachments } = req.body;

      if (!title || !content || !company_id || !creator_uuid) {
        logger.error('缺少必需参数');
        return res.status(400).json({
          status: 'error',
          message: '缺少必需参数',
          required: ['title', 'content', 'company_id', 'creator_uuid']
        });
      }

      logger.info(`创建Wiki: ${title}`);
      
      await this.initDatabase();

      if (!this.db) {
        return res.status(500).json({
          status: 'error',
          message: '数据库连接失败'
        });
      }

      // 构建Wiki文档
      const wikiDoc = {
        title: title.trim(),
        content: content.trim(),
        company_id: company_id,
        creator_uuid: creator_uuid,
        attachments: attachments || [],  // 附件哈希列表
        has_attachment: attachments && attachments.length > 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        view_count: 0
      };

      logger.database('INSERT', 'db.wiki.insertOne - 创建Wiki');

      const result = await this.db.collection('wiki').insertOne(wikiDoc);

      if (!result.insertedId) {
        logger.error('Wiki创建失败');
        return res.status(500).json({
          status: 'error',
          message: 'Wiki创建失败'
        });
      }

      logger.success('Wiki创建成功');

      res.json({
        status: 'success',
        message: '创建成功',
        data: {
          _id: result.insertedId.toString(),
          title: title,
          created_at: wikiDoc.created_at
        }
      });

    } catch (err) {
      logger.error('服务器异常:', err.message);
      logger.error('错误堆栈:', err.stack);
      res.status(500).json({
        status: 'error',
        message: '创建Wiki时发生异常',
        details: err.message
      });
    }
  }

  /**
   * 转换字符串ID为ObjectId
   */
  _convertToObjectId(id) {
    const { ObjectId } = require('mongodb');
    try {
      return new ObjectId(id);
    } catch (e) {
      return id;
    }
  }
}

module.exports = WikiController;
