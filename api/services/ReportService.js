const { MongoClient, ObjectId } = require('mongodb');

class ReportService {
  constructor() {
    this.db = null;
    this.client = null;
  }

  // 初始化数据库连接
  async initDatabase() {
    if (this.db) return;
    
    try {
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
      const dbName = process.env.DATABASE_NAME || 'miniprogram';
      
      this.client = new MongoClient(uri);
      await this.client.connect();
      this.db = this.client.db(dbName);
      
      console.log('✅ 报表服务数据库连接成功');
    } catch (error) {
      console.error('❌ 数据库连接失败:', error);
      throw error;
    }
  }

  // 获取团队报表
  async getTeamReport(userUuid) {
    await this.initDatabase();
    
    try {
      // 获取用户信息
      const user = await this.db.collection('users').findOne({ uuid: userUuid });
      
      if (!user) {
        throw new Error('用户不存在');
      }
      
      // 确定查询范围（根据角色）
      let teamFilter = {};
      
      if (user.system_roles?.includes('admin')) {
        // 管理员：所有团队
        teamFilter = {};
      } else if (user.rank >= 7) {
        // 管理层：管理的团队
        teamFilter = {
          $or: [
            { leader: userUuid },
            { _id: { $in: (user.managed_team_ids || []).map(id => new ObjectId(id)) } }
          ]
        };
      } else {
        // 普通员工：加入的团队
        teamFilter = {
          members: userUuid
        };
      }
      
      // 并行查询多个数据源
      const [teams, applications, messages] = await Promise.all([
        // 团队信息
        this.db.collection('teams').find(teamFilter).toArray(),
        
        // 审批申请统计
        this.db.collection('applications').aggregate([
          { $match: teamFilter },
          {
            $group: {
              _id: null,
              totalApplications: { $sum: 1 },
              approvedCount: {
                $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
              },
              pendingCount: {
                $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
              },
              avgApprovalTime: {
                $avg: {
                  $cond: [
                    { $and: [
                      { $eq: ['$status', 'approved'] },
                      { $ne: ['$approved_at', null] },
                      { $ne: ['$created_at', null] }
                    ]},
                    { $divide: [
                      { $subtract: ['$approved_at', '$created_at'] },
                      3600000  // 转换为小时
                    ]},
                    null
                  ]
                }
              }
            }
          }
        ]).toArray(),
        
        // 今日消息数
        this.db.collection('team_chats').countDocuments({
          project_id: { $in: (await this.db.collection('teams').find(teamFilter).project('_id').toArray()).map(t => t._id.toString()) },
          created_at: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        })
      ]);
      
      // 计算统计数据
      const approvalStats = applications[0] || {
        totalApplications: 0,
        approvedCount: 0,
        pendingCount: 0,
        avgApprovalTime: 0
      };
      
      const approvalRate = approvalStats.totalApplications > 0
        ? ((approvalStats.approvedCount / approvalStats.totalApplications) * 100).toFixed(1)
        : 0;
      
      const onTimeRate = 85; // TODO: 实现按时处理率计算
      
      // 生成预警信息
      const alerts = [];
      
      if (approvalStats.pendingCount > 10) {
        alerts.push(`待审批申请较多（${approvalStats.pendingCount}个），建议加快处理速度`);
      }
      
      if (approvalStats.avgApprovalTime > 8) {
        alerts.push(`平均审批时长${approvalStats.avgApprovalTime.toFixed(1)}小时，超过标准值（4小时）`);
      }
      
      // 组装返回数据
      const result = {
        // 基本信息
        totalMembers: teams.reduce((sum, team) => sum + (team.members?.length || 0), 0),
        activeMembers: Math.floor(teams.reduce((sum, team) => sum + (team.members?.length || 0), 0) * 0.78), // TODO: 实现真实活跃度计算
        
        // 审批统计
        pendingApprovals: approvalStats.pendingCount,
        avgApprovalTime: approvalStats.avgApprovalTime 
          ? `${approvalStats.avgApprovalTime.toFixed(1)}h`
          : 'N/A',
        
        approvalStats: {
          totalApplications: approvalStats.totalApplications,
          approvalRate: parseFloat(approvalRate),
          onTimeRate
        },
        
        // 团队活跃度
        engagement: {
          todayMessages: messages,
          participationRate: 78, // TODO: 实现真实参与率计算
          avgResponseTime: '35分钟' // TODO: 实现真实响应时间计算
        },
        
        // 预警信息
        alerts
      };
      
      console.log('✅ 团队报表生成成功');
      return result;
      
    } catch (error) {
      console.error('❌ 生成团队报表失败:', error);
      throw error;
    }
  }

  // 获取项目报表
  async getProjectReport(userUuid) {
    await this.initDatabase();
    
    try {
      // 获取用户信息
      const user = await this.db.collection('users').findOne({ uuid: userUuid });
      
      if (!user) {
        throw new Error('用户不存在');
      }
      
      // 确定查询范围
      let projectFilter = {};
      
      if (user.system_roles?.includes('admin')) {
        projectFilter = {};
      } else if (user.rank >= 7) {
        // 管理层：所属团队的项目
        const managedTeams = await this.db.collection('teams').find({
          $or: [
            { leader: userUuid },
            { _id: { $in: (user.managed_team_ids || []).map(id => new ObjectId(id)) } }
          ]
        }).toArray();
        
        const teamIds = managedTeams.map(t => t._id.toString());
        projectFilter = { team_id: { $in: teamIds } };
      } else {
        // 普通员工：参与的项目
        projectFilter = {
          members: userUuid
        };
      }
      
      // 获取所有项目
      const projects = await this.db.collection('projects').find(projectFilter).toArray();
      
      // 统计项目状态
      const statusCounts = {
        planning: 0,
        active: 0,
        delayed: 0,
        completed: 0
      };
      
      projects.forEach(project => {
        const status = project.status || 'planning';
        if (statusCounts.hasOwnProperty(status)) {
          statusCounts[status]++;
        }
      });
      
      const totalProjects = projects.length;
      
      // 状态分布
      const statusDistribution = [
        {
          name: '规划中',
          status: 'planning',
          count: statusCounts.planning,
          percentage: totalProjects > 0 ? ((statusCounts.planning / totalProjects) * 100).toFixed(0) : 0,
          color: '#1890ff'
        },
        {
          name: '进行中',
          status: 'active',
          count: statusCounts.active,
          percentage: totalProjects > 0 ? ((statusCounts.active / totalProjects) * 100).toFixed(0) : 0,
          color: '#52c41a'
        },
        {
          name: '延期风险',
          status: 'delayed',
          count: statusCounts.delayed,
          percentage: totalProjects > 0 ? ((statusCounts.delayed / totalProjects) * 100).toFixed(0) : 0,
          color: '#faad14'
        },
        {
          name: '已完成',
          status: 'completed',
          count: statusCounts.completed,
          percentage: totalProjects > 0 ? ((statusCounts.completed / totalProjects) * 100).toFixed(0) : 0,
          color: '#bfbfbf'
        }
      ];
      
      // 重点项目（进度<80%或已延期）
      const keyProjects = projects
        .filter(p => p.progress < 80 || p.status === 'delayed')
        .slice(0, 5)
        .map(project => {
          const deadline = new Date(project.end_date || project.deadline);
          const now = new Date();
          const daysRemaining = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
          
          let riskLevel = '低';
          if (daysRemaining < 3 || project.status === 'delayed') {
            riskLevel = '高';
          } else if (daysRemaining < 7) {
            riskLevel = '中';
          }
          
          return {
            _id: project._id,
            name: project.name,
            progress: project.progress || 0,
            status: project.status === 'delayed' ? '延期风险' : '正常',
            deadline: project.end_date || project.deadline,
            daysRemaining: Math.max(0, daysRemaining),
            riskLevel
          };
        });
      
      // 生成预警信息
      const alerts = [];
      
      if (statusCounts.delayed > 0) {
        alerts.push(`${statusCounts.delayed}个项目存在延期风险，需重点关注`);
      }
      
      const lowProgressProjects = projects.filter(p => (p.progress || 0) < 30 && (p.status === 'active'));
      if (lowProgressProjects.length > 0) {
        alerts.push(`${lowProgressProjects.length}个项目进度低于30%，建议跟进`);
      }
      
      // 组装返回数据
      const result = {
        totalProjects,
        activeProjects: statusCounts.active,
        delayedProjects: statusCounts.delayed,
        completedProjects: statusCounts.completed,
        
        statusDistribution,
        keyProjects,
        alerts
      };
      
      console.log('✅ 项目报表生成成功');
      return result;
      
    } catch (error) {
      console.error('❌ 生成项目报表失败:', error);
      throw error;
    }
  }
}

module.exports = ReportService;
