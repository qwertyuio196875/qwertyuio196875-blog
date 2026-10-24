# qwertyuio196875 的博客

基于 Astro 的纯静态个人博客，部署在 Vercel。内容全部来自仓库内的 Markdown/JSON 文件，「项目」页在构建时自动拉取 GitHub 公开仓库。UI 采用 endfield-ui 风格（纸墨 + 酸黄强调，浅色默认、右上角切换深浅并记住选择）。

## 本地开发

```bash
npm install
npm run dev        # http://localhost:4321（predev 会先拉一次 GitHub 仓库）
npm run build      # prebuild 拉仓库 + 静态构建，产物在 dist/
npm run preview    # 本地预览构建产物
```

## 内容维护

| 内容 | 位置 | 说明 |
| --- | --- | --- |
| 随笔 | `src/content/essays/<名称>.md` | frontmatter：`title`、`date` 必填，`tags` 可选。编号按发布时间自动生成（No.001 起），不用手写 |
| 说说 | `src/content/moments/<日期>-<名称>.md` | frontmatter：`date` 必填，`image` 可选（图片放 `public/moments/`，写 `/moments/文件名`）。无标题，正文即内容 |
| 友链 | `src/data/friends.json` | 数组：`name` / `url` / `desc` |
| 关于 | `src/content/about/about.md` | 直接写 Markdown |
| 站点名、简介、首页前言 | `src/consts.ts` | |

> 当前仓库里的 2 篇随笔、3 条说说和关于页文字是示例内容，替换成自己的即可。

## 项目页数据

`scripts/fetch-projects.mjs` 在每次构建前调用 GitHub API 拉取 `qwertyuio196875` 的公开仓库，写入 `src/generated/projects.json`。排除清单：fork、归档、私有、名字在脚本 `EXCLUDE_NAMES` 里的仓库（当前含名为 `-` 的仓库）。API 失败（限流/断网）时保留上一份数据，构建不中断。

## 部署

主站部署在 Cloudflare Pages，Vercel 作为备份镜像。

### Cloudflare Pages（主站，国内可直连）

本项目采用「直接上传」方式，不走 Git 集成，发布需要手动执行：

```bash
npm run build
npx wrangler login      # 仅首次需要
npm run deploy:pages    # 上传 dist 到 qwertyuio196875-blog.pages.dev
```

站点地址：https://qwertyuio196875-blog.pages.dev

`astro.config.mjs` 里的 `site` 必须与实际主域名一致（RSS 需要绝对地址）。换域名后改这里并重新发布。

### Vercel（备份镜像）

仓库已关联 Vercel，push 到 `main` 会自动构建部署。注意 `*.vercel.app` 在中国大陆无法直连，仅作备份。

### 其他

- 有新仓库要展示时，重新构建发布一次即可刷新项目页。
- 若以后启用 Cloudflare Pages 的 Git 集成（安装 Cloudflare GitHub App），推送即可自动发布，可跳过手动上传。

## 目录结构

```
src/
  components/   Nav / Footer
  content/      essays / moments / about（Markdown 内容）
  data/         friends.json
  generated/    projects.json（构建时生成）
  layouts/      Layout.astro（主题、导航、页脚）
  lib/          content.ts（数据辅助：编号、字数、日期）
  pages/        index / essays / moments / projects / links / about / rss.xml
  styles/       endfield.css（endfield-ui 套件）+ global.css（站点布局）
scripts/        fetch-projects.mjs（构建时 GitHub API）
```