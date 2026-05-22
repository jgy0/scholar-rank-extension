# Scholar Rank Extension 中文文档

一个用于 Google Scholar 的本地 Chrome 扩展，可以在搜索结果页自动标注、筛选和排序 CCF 推荐期刊/会议等级。

这个插件适合在做文献检索时快速判断一篇文章所在期刊或会议是否属于 CCF A/B/C 类，减少手动查目录的时间。

## 主要功能

- 内置 CCF 2026 第七版推荐国际学术会议和期刊目录，共 678 条记录。
- 在 Google Scholar 搜索结果标题旁显示等级徽标：
  - `CCF-A`：红色，最高优先级。
  - `CCF-B`：橙色，中等优先级。
  - `CCF-C`：蓝色，低一级优先级。
- 支持按等级筛选结果：全部、CCF C+、CCF B+、CCF A。
- 支持只查看期刊或会议。
- 支持把当前页结果按 CCF 等级排序。
- 支持额外导入 JCR、中科院分区或课题组自定义等级表。

## 效果说明

安装并启用插件后，打开 Google Scholar 正常搜索即可。插件会在搜索结果标题右侧添加类似 `CCF-A`、`CCF-B`、`CCF-C` 的标签，并在结果列表上方插入一个筛选工具栏。

注意：插件只会重排和筛选当前 Google Scholar 结果页，不会自动抓取后续页面。

## 安装方法

### 1. 下载项目

可以直接克隆本仓库：

```bash
git clone https://github.com/jgy0/scholar-rank-extension.git
```

也可以在 GitHub 页面点击 `Code` -> `Download ZIP`，下载后解压。

### 2. 在 Chrome 中加载扩展

1. 打开 Chrome 浏览器。
2. 地址栏输入：

```text
chrome://extensions/
```

3. 打开右上角的“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择本项目文件夹：

```text
scholar-rank-extension
```

6. 打开或刷新 Google Scholar 页面。

## 使用方法

打开 Google Scholar 并搜索关键词，例如：

```text
underwater image polarization
```

插件会在搜索结果上方显示工具栏：

| 控件 | 作用 |
| --- | --- |
| `Min rank` | 设置最低等级，例如只看 CCF B+ 或 CCF A |
| `Exact` | 只显示某一个等级，例如只显示 CCF A |
| `Type` | 选择全部、期刊或会议 |
| `Sort by rank` | 将当前页中等级更高的结果排到前面 |
| `Import extras` | 导入额外的本地等级表 |

## 自定义导入数据

插件已经内置 CCF 2026 数据。如果你还想加入 JCR、中科院分区或自己课题组的等级规则，可以点击工具栏中的 `Import extras`，然后粘贴 JSON 或 CSV。

CSV 格式如下：

```csv
venue,abbreviation,aliases,system,rank,score,type,field,note
Ocean Engineering,,Ocean Engineering,CAS,Large category 2 / small category 1,7,journal,engineering,Verify target-year CAS data
IEEE Transactions on Cybernetics,,T Cybernetics|IEEE T Cybernetics,JCR,Q1,10,journal,AI,Verify target-year JCR data
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `venue` | 期刊或会议全称 |
| `abbreviation` | 简称，例如 CVPR、AAAI、TOCS |
| `aliases` | 其他别名，多个别名用 `|` 分隔 |
| `system` | 等级体系，例如 CCF、JCR、CAS、LOCAL |
| `rank` | 等级，例如 A、B、C、Q1 |
| `score` | 排序分数，越高越靠前 |
| `type` | `journal` 或 `conference` |
| `field` | 所属领域 |
| `note` | 备注 |

## 内置分数规则

| 等级 | 分数 |
| --- | --- |
| CCF A | 10 |
| CCF B | 8 |
| CCF C | 5 |

## 项目结构

```text
scholar-rank-extension/
  manifest.json          Chrome 扩展配置文件
  content.js             Google Scholar 页面匹配、筛选、排序逻辑
  content.css            工具栏和等级徽标样式
  options.html           选项页
  options.js             自定义等级表导入逻辑
  data/ccf-2026.js       内置 CCF 2026 数据
  tools/extract_ccf.py   从 PDF 抽取 CCF 数据的一次性脚本
```

## 工作原理

Google Scholar 本身不提供 CCF、JCR 或中科院分区字段，也没有官方的按等级排序接口。

本插件的做法是：

1. 读取当前 Google Scholar 搜索结果页中的标题和元信息。
2. 用内置的 CCF 目录数据进行文本匹配。
3. 给匹配到的结果添加等级徽标。
4. 根据用户选择，对当前页结果进行隐藏或重新排序。

因此，匹配结果是基于页面文本的近似匹配。如果 Google Scholar 页面没有显示完整期刊名或会议名，可能会出现未匹配或误匹配。

## 数据说明

内置 CCF 数据来自 CCF 2026 第七版推荐国际学术会议和期刊目录，并由脚本抽取整理为本地 JSON 数据。

如果你要公开分发或二次发布本项目，请自行确认 CCF 目录数据的使用方式符合原发布方要求。

如果希望降低数据再分发风险，可以删除：

```text
data/ccf-2026.js
```

然后只使用 `Import extras` 功能导入自己的本地数据。

## 许可证

本项目代码使用 MIT License。内置目录数据的权利归原发布方所有。
