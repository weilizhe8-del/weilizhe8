// Snapshot of the autumn course catalog and tool links seeded by the existing site.
const catalog = {
  "courses": [
    {
      "id": "2026-autumn-01",
      "name": "数字逻辑",
      "credits": 3,
      "components": [
        {
          "name": "考勤",
          "weight": 10
        },
        {
          "name": "作业",
          "weight": 30
        },
        {
          "name": "期末考试",
          "weight": 60
        }
      ],
      "projectName": "",
      "projectDeadline": "",
      "finalExamDeadline": "",
      "finalExamLocation": ""
    },
    {
      "id": "2026-autumn-02",
      "name": "数字逻辑实验",
      "credits": 1,
      "components": [
        {
          "name": "考勤",
          "weight": 10
        },
        {
          "name": "平时实验",
          "weight": 50
        },
        {
          "name": "综合实验",
          "weight": 40
        }
      ],
      "projectName": "",
      "projectDeadline": "",
      "finalExamDeadline": "",
      "finalExamLocation": ""
    },
    {
      "id": "2026-autumn-03",
      "name": "数据结构",
      "credits": 4,
      "components": [
        {
          "name": "考勤",
          "weight": 5
        },
        {
          "name": "作业",
          "weight": 30
        },
        {
          "name": "研讨",
          "weight": 10
        },
        {
          "name": "提问",
          "weight": 5
        },
        {
          "name": "期末考试",
          "weight": 50
        }
      ],
      "projectName": "",
      "projectDeadline": "",
      "finalExamDeadline": "",
      "finalExamLocation": ""
    },
    {
      "id": "2026-autumn-04",
      "name": "离散数学",
      "credits": 3,
      "components": [
        {
          "name": "考勤",
          "weight": 15
        },
        {
          "name": "作业",
          "weight": 15
        },
        {
          "name": "4次月考/期中考试",
          "weight": 20
        },
        {
          "name": "期末考试",
          "weight": 50
        }
      ],
      "projectName": "",
      "projectDeadline": "",
      "finalExamDeadline": "",
      "finalExamLocation": ""
    },
    {
      "id": "2026-autumn-05",
      "name": "马克思主义原理",
      "credits": 3,
      "components": [
        {
          "name": "考勤",
          "weight": 10
        },
        {
          "name": "实践报告",
          "weight": 20
        },
        {
          "name": "平时成绩（pre）",
          "weight": 30
        },
        {
          "name": "期末考试",
          "weight": 40
        }
      ],
      "projectName": "",
      "projectDeadline": "",
      "finalExamDeadline": "",
      "finalExamLocation": ""
    },
    {
      "id": "2026-autumn-06",
      "name": "形势与政策（3）",
      "credits": 0.5,
      "components": [],
      "projectName": "",
      "projectDeadline": "",
      "finalExamDeadline": "",
      "finalExamLocation": ""
    },
    {
      "id": "2026-autumn-07",
      "name": "中国玉石及玉文化鉴赏",
      "credits": 1.5,
      "components": [
        {
          "name": "考勤",
          "weight": 10
        },
        {
          "name": "智慧树",
          "weight": 30
        },
        {
          "name": "课堂任务报告",
          "weight": 60
        }
      ],
      "projectName": "",
      "projectDeadline": "",
      "finalExamDeadline": "",
      "finalExamLocation": ""
    },
    {
      "id": "2026-autumn-08",
      "name": "概率论与数理统计",
      "credits": 3,
      "components": [
        {
          "name": "作业、考勤",
          "weight": 10
        },
        {
          "name": "平时测验",
          "weight": 30
        },
        {
          "name": "期末考试",
          "weight": 60
        }
      ],
      "projectName": "",
      "projectDeadline": "",
      "finalExamDeadline": "",
      "finalExamLocation": ""
    },
    {
      "id": "2026-autumn-09",
      "name": "计算机科学导论",
      "credits": 2,
      "components": [
        {
          "name": "大作业网站",
          "weight": 20
        },
        {
          "name": "大作业前沿报告",
          "weight": 15
        },
        {
          "name": "作业、考勤",
          "weight": 10
        },
        {
          "name": "平时测验",
          "weight": 10
        },
        {
          "name": "期末考试",
          "weight": 45
        }
      ],
      "projectName": "",
      "projectDeadline": "",
      "finalExamDeadline": "",
      "finalExamLocation": ""
    },
    {
      "id": "2026-autumn-10",
      "name": "学术英语写作1",
      "credits": 2,
      "components": [
        {
          "name": "考勤",
          "weight": 10
        },
        {
          "name": "课堂表现",
          "weight": 10
        },
        {
          "name": "论文计划书",
          "weight": 10
        },
        {
          "name": "论文提纲",
          "weight": 10
        },
        {
          "name": "议论文写作",
          "weight": 10
        },
        {
          "name": "文献综述",
          "weight": 10
        },
        {
          "name": "终稿",
          "weight": 20
        },
        {
          "name": "演讲",
          "weight": 20
        }
      ],
      "projectName": "",
      "projectDeadline": "",
      "finalExamDeadline": "",
      "finalExamLocation": ""
    },
    {
      "id": "2026-autumn-11",
      "name": "面向对象程序设计",
      "credits": 2,
      "components": [
        {
          "name": "考勤",
          "weight": 5
        },
        {
          "name": "文档作业、基本习题",
          "weight": 35
        },
        {
          "name": "综合习题",
          "weight": 30
        },
        {
          "name": "期末考试",
          "weight": 30
        }
      ],
      "projectName": "",
      "projectDeadline": "",
      "finalExamDeadline": "",
      "finalExamLocation": ""
    },
    {
      "id": "2026-autumn-12",
      "name": "体育三",
      "credits": 1,
      "components": [
        {
          "name": "理论考试",
          "weight": 5
        },
        {
          "name": "体质健康测试",
          "weight": 40
        },
        {
          "name": "专项",
          "weight": 30
        },
        {
          "name": "刷段",
          "weight": 15
        },
        {
          "name": "考勤",
          "weight": 10
        }
      ],
      "projectName": "",
      "projectDeadline": "",
      "finalExamDeadline": "",
      "finalExamLocation": ""
    }
  ],
  "tools": [
    {
      "name": "arXiv",
      "url": "https://arxiv.org",
      "category": "学习资源"
    },
    {
      "name": "BiliBili",
      "url": "https://www.bilibili.com",
      "category": "学习资源"
    },
    {
      "name": "Google Scholar",
      "url": "https://scholar.google.com",
      "category": "学习资源"
    },
    {
      "name": "Papers With Code",
      "url": "https://paperswithcode.com",
      "category": "学习资源"
    },
    {
      "name": "知乎",
      "url": "https://www.zhihu.com",
      "category": "学习资源"
    },
    {
      "name": "阿里云",
      "url": "https://www.aliyun.com",
      "category": "实用工具"
    },
    {
      "name": "ChatGPT",
      "url": "https://chatgpt.com",
      "category": "AI 与实验"
    },
    {
      "name": "Cloudflare",
      "url": "https://dash.cloudflare.com",
      "category": "实用工具"
    },
    {
      "name": "DeepL",
      "url": "https://www.deepl.com/translator",
      "category": "实用工具"
    },
    {
      "name": "Deepseek",
      "url": "https://chat.deepseek.com",
      "category": "AI 与实验"
    },
    {
      "name": "Gemini",
      "url": "https://gemini.google.com",
      "category": "AI 与实验"
    },
    {
      "name": "Google AI Studio",
      "url": "https://aistudio.google.com",
      "category": "AI 与实验"
    },
    {
      "name": "Kimi",
      "url": "https://kimi.moonshot.cn",
      "category": "AI 与实验"
    },
    {
      "name": "Overleaf",
      "url": "https://overleaf.com",
      "category": "实用工具"
    },
    {
      "name": "硅基流动",
      "url": "https://siliconflow.cn",
      "category": "实用工具"
    },
    {
      "name": "GitHub",
      "url": "https://github.com",
      "category": "其他资源"
    }
  ]
};
