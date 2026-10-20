# fyk's blog

一个人记一些东西的地方。

独立博客源码，采用新版 B 风格，支持文章索引、搜索、分类、独立文章页、文章目录和上一篇／下一篇，并适配手机。

## 使用

需要 Node.js 20 或更新版本。

```sh
npm install
npm run build
npm run preview
```

构建结果位于 `dist/`，本地预览地址见终端输出。同时生成相同内容的 `docs/`，供 GitHub Pages 发布。

## 网页发布

将源码和生成的 `docs/` 一起提交到 GitHub。在仓库 **Settings → Pages** 中设置：

- Source：**Deploy from a branch**
- Branch：**main**
- Folder：**/docs**

点击 **Save**，等待部署成功后访问 <https://fyk2007.github.io/blog/>。

修改文章或样式后，运行 `npm run build` 和 `npm run check`，再将源码与 `docs/` 一起提交、推送。`docs/` 是构建产物，请修改 `content/` 或 `src/` 中的源文件后重新构建。

## 文章

六篇文章的 Markdown 源文件保存在 `content/posts/`。修改或新增文章后重新构建即可；文章序号按日期从早到晚生成，首页按从新到旧排列。

已保留六篇文章原有的访问路径。项目使用全新的构建脚本、模板和新版样式，不依赖原 `fyk2007.github.io` 仓库的代码、Jekyll 配置或 Git 历史。
