# 《诗岛》前端原型

入口文件：

```text
src/frontend/index.html
```

静态资源：

```text
assets/poem-island-v2
```

## 已实现

- 诗岛地图入口；
- 四个区域：竹林茶座、月夜庭院、江边诗市、诗会雅集；
- 三位诗人场景；
- 日常创作；
- 首句续写；
- 藏头诗；
- 诗人手稿 5 候选展示；
- Rerank/TC/PPL 等指标展示；
- 诗会雅集同题创作对比；
- 创作偏好面板；
- 角色呼吸浮动；
- 角色眨眼动画；
- 卷轴展开动画；
- 生成过程文案：翻阅旧稿、推敲字句、誊写成诗。

## 运行方式

可以直接打开：

```text
D:\poem-island-project\src\frontend\index.html
```

也可以在项目根目录启动静态服务器：

```text
python -m http.server 4173
```

然后访问：

```text
http://127.0.0.1:4173/src/frontend/index.html
```

## 说明

当前版本是前端展示原型，生成结果使用静态模拟数据。后续接入模型服务时，可将 `app.js` 中的模拟生成函数替换为后端 API 调用。
