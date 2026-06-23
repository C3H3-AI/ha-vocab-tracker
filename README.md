# HA Vocab Tracker

高考英语词汇学习系统，基于 Vue3 + TypeScript，集成 Home Assistant 实现打卡追踪和一键打印。

## 项目结构

```
ha-vocab-tracker/
├── src/                    # Vue3 前端源码
│   ├── components/         # 组件 (DailyStudy, ReviewSession, VocabBrowser, PrintPanel, StatsDashboard)
│   ├── utils/              # 工具 (wordbank, ebbinghaus, storage, printer)
│   ├── types/              # 类型定义
│   ├── App.vue             # 主应用
│   └── main.ts             # 入口
├── config/                 # HA packages 配置
│   └── packages.yaml       # 实体 + 自动化 + 记忆曲线
├── scripts/                # 部署脚本
│   ├── deploy.py           # 构建+部署到HA
│   └── ipp_print.py        # IPP 直连打印
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 开发

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 构建生产版本
```

## 部署

```bash
python scripts/deploy.py
```

构建产物在 `dist/` 目录，部署到 HA 的 `/config/www/vocab/`。

## 词库

通过 git submodule 引入 [KyleBing/english-vocabulary](https://github.com/KyleBing/english-vocabulary)：
- 初中 3223 词
- 高中 6008 词
- 四级 7508 词
- 六级 5651 词
- 考研 9602 词
- 托福 13477 词
- SAT 8887 词
