# TransInvoice MVP — Free Word Counter for Translators

纯前端网页字数统计器。本地解析 `.docx` / `.pdf`，不向任何服务器上传文件。

## 技术
- 纯 HTML + 原生 JS，无后端、无数据库、无登录、无支付。
- `.docx` → mammoth.js；`.pdf` → pdf.js（均通过 CDN 加载，浏览器本地解析）。
- 针对译者设计：Words（拉丁分词）、Characters（不计空格）、Chinese Characters（汉字），并对混排内容分 Latin / CJK 显示。

## 部署到 Vercel
见对话框指引（创建 GitHub 仓库 → push → 导入 Vercel）。

## 验证
`validate/` 内含样例文档与端到端验证脚本。在 `validate/` 下运行：
```
npm install
node gen-docs.js   # 重新生成样例（可选）
node validate.js   # 端到端验证
```
