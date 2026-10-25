# 后台（/admin/）配置指引

后台已实现：`/admin/` 页面 + `functions/api/admin/*` 接口（GitHub OAuth 登录、发说说、配图压缩入库）。
代码就绪后还差**两处一次性网页设置**（GitHub 与 Cloudflare 的设置页），都只能由站主本人操作。

## 1. 注册 GitHub OAuth 应用（约 3 分钟）

1. 打开 <https://github.com/settings/developers> → **New OAuth App**；
2. 按下面填写：
   - Application name：`blog-admin`（随意）
   - Homepage URL：`https://qwertyuio196875-blog.pages.dev`
   - Authorization callback URL：`https://qwertyuio196875-blog.pages.dev/admin/`
3. 注册后记下 **Client ID**；
4. 点 **Generate a new client secret**，立刻复制 **Client Secret**（只显示这一次）。

## 2. Cloudflare Pages 切换为 git 自动构建（约 5 分钟）

后台发布依赖「推送 → 自动构建」。目前站点是本地 `npm run deploy:pages` 手动上传，
Direct Upload 项目不能直接改成连 git，需要在 Cloudflare 上**新建**一个连 git 的项目（替换旧的）：

1. Cloudflare Dashboard → Workers & Pages：先删掉旧的 `qwertyuio196875-blog` 项目（同名重建才能保住
   `qwertyuio196875-blog.pages.dev` 域名；旧项目的部署历史会丢，仓库才是唯一数据源，无实际损失）；
2. Create application → Pages → **Connect to Git**：选中 `qwertyuio196875/qwertyuio196875-blog`；
3. 项目名填 `qwertyuio196875-blog`（和旧的一致）；生产分支 `main`；
4. 构建设置：Build command `npm run build`，Build output directory `dist`；
5. 展开 Environment variables，添加三个变量后保存部署：

   | 变量名 | 值 |
   | --- | --- |
   | `GH_OAUTH_CLIENT_ID` | 第 1 步的 Client ID |
   | `GH_OAUTH_CLIENT_SECRET` | 第 1 步的 Client Secret |
   | `ADMIN_SESSION_SECRET` | 自拟随机长串（≥32 字符，密码管理器生成即可） |

6. 部署完成后访问 `https://qwertyuio196875-blog.pages.dev/admin/` 试登录发一条。

本地 `npm run deploy:pages` 手动上传流程保留作后备（注意：手动上传会覆盖自动构建的产物，
非紧急情况不再使用）。

## 使用

- 打开 `/admin/` → 点「用 GitHub 登录」→ 授权 → 写说说（可选配图）→ 发布；
- 发布后 Cloudflare 自动构建，**约 1~2 分钟**后说说页可见；
- 登录态保持 7 天，过期后重新点一次登录即可。

## 本地调试（可选）

```bash
cd blog
cp .dev.vars.example .dev.vars   # 填入与线上一致的三个值
npm run preview:cf               # 构建并用 wrangler 起 http://127.0.0.1:8788
```

注意：GitHub OAuth 应用只登记一个回调地址。本地要完整走登录流程时，需临时把 OAuth App 的
callback 改成 `http://127.0.0.1:8788/admin/`，测完改回线上地址。

## 故障排查

| 现象 | 原因与处理 |
| --- | --- |
| 「后台尚未配置：缺少环境变量 …」 | Cloudflare 变量没设或设完没重新部署 |
| GitHub 报 redirect_uri 不匹配 | OAuth App 的 callback 与实际访问域名不一致 |
| 发布失败 GitHub 401 | 登录已过期（7 天），回后台重新登录 |
| 发布成功但页面没更新 | 看 Cloudflare 该次构建的日志；`GITHUB_TOKEN` 限额问题见 ADR-0003 |
