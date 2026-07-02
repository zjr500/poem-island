# Topic Consistency Evaluation：主题一致性评估方案

## 1. 设计目标

在七言绝句生成任务中，模型不仅需要满足格式要求，还需要围绕用户输入主题持续展开。仅使用 PPL 无法判断生成结果是否跑题，因此本项目设计 Topic Consistency Evaluation 模块，用于评估生成诗与输入内容之间的主题一致性。

该指标主要用于判断：

1. 首句续写模式中，后三句是否围绕首句主题展开；
2. 藏头诗模式中，整首诗是否围绕用户输入主题或场景展开；
3. 候选重排序阶段，是否优先选择主题更连贯的候选结果。

---

## 2. 总体思路

Topic Consistency 由两个部分组成：

```text
Topic Consistency
=
Embedding Score
+
LLM Judge
```

其中：

- Embedding Score 用于自动计算输入与生成诗之间的语义相似度；
- LLM Judge 用于判断古诗语境下的意境延续、主题连贯和是否突然跑题。

最终得分采用加权平均：

```text
Topic Consistency Score
=
0.5 * Embedding Score
+
0.5 * LLM Judge Score
```

得分范围为 0 到 1，分数越高表示主题一致性越强。

---

## 3. Embedding Score

### 3.1 计算对象

在首句续写任务中：

```text
Input Text = 用户输入首句
Generated Text = 模型生成的完整七言绝句
```

例如：

```text
Input Text:
空山新雨晚风微

Generated Text:
空山新雨晚风微
竹影轻摇入翠扉
一盏清茶人不语
半庭明月照僧衣
```

### 3.2 计算方法

使用中文语义向量模型分别编码输入文本和生成文本。

```text
v_input = Encoder(Input Text)
v_generated = Encoder(Generated Text)
```

然后计算二者的余弦相似度：

```text
Embedding Score = cosine(v_input, v_generated)
```

为了便于和 LLM Judge 分数融合，将相似度归一化到 0 到 1 区间。

### 3.3 指标作用

Embedding Score 主要判断生成诗是否在语义空间上接近输入主题。

如果输入为：

```text
空山新雨晚风微
```

生成内容继续围绕：

```text
空山、竹影、清茶、明月
```

展开，则 Embedding Score 较高。

如果生成内容突然转向：

```text
黄河、长风、饮酒、天涯
```

则 Embedding Score 较低。

### 3.4 优点与不足

优点：

- 自动化程度高；
- 计算速度快；
- 适合大规模候选排序。

不足：

- 对古诗中的隐含意境、风格转折判断能力有限；
- 有时无法准确识别“意象相关但字面不相似”的情况。

因此需要引入 LLM Judge 作为补充。

---

## 4. LLM Judge Score

### 4.1 设计目的

LLM Judge 用于判断生成诗是否在主题、意象和情绪上延续输入内容，弥补 Embedding Score 对古诗语境理解不足的问题。

### 4.2 评分维度

LLM Judge 主要评估三个方面：

1. 主题是否延续；
2. 意象是否自然衔接；
3. 是否出现明显跑题或突兀转向。

### 4.3 评分标准

采用 1 到 5 分制：

| 分数 | 含义 |
|---:|---|
| 5 | 主题高度一致，意象自然延续，无跑题 |
| 4 | 基本一致，有轻微跳跃，但整体连贯 |
| 3 | 部分相关，但主题延续不够稳定 |
| 2 | 只有少量相关，存在明显偏移 |
| 1 | 基本跑题，生成内容与输入主题关系很弱 |

将评分归一化为 0 到 1：

```text
LLM Judge Score = score / 5
```

### 4.4 Prompt 设计

```text
你是一个中文古诗评审专家。请判断下面这首七言绝句是否围绕输入内容展开。

输入内容：
{input_text}

生成诗：
{generated_poem}

请从以下三个方面判断：
1. 主题是否延续；
2. 意象是否自然衔接；
3. 是否出现明显跑题或突兀转向。

请只输出一个 1 到 5 的整数分数，不要输出解释。
```

### 4.5 示例

输入内容：

```text
空山新雨晚风微
```

生成诗 A：

```text
空山新雨晚风微
竹影轻摇入翠扉
一盏清茶人不语
半庭明月照僧衣
```

LLM Judge Score：

```text
5 / 5 = 1.0
```

生成诗 B：

```text
空山新雨晚风微
长风吹月过天涯
黄河万里入云外
醉里高歌入酒旗
```

LLM Judge Score：

```text
2 / 5 = 0.4
```

---

## 5. Final Topic Consistency Score

最终主题一致性分数为：

```text
Topic Consistency Score
=
0.5 * Embedding Score
+
0.5 * LLM Judge Score
```

例如：

| 候选 | Embedding Score | LLM Judge Score | Final Score |
|---|---:|---:|---:|
| Candidate A | 0.86 | 1.00 | 0.93 |
| Candidate B | 0.42 | 0.40 | 0.41 |

因此 Candidate A 在主题一致性上明显优于 Candidate B。

---

## 6. 在候选重排序中的使用

在 Candidate Reranking 阶段，Topic Consistency Score 作为重要质量指标参与总分计算。

候选总分可定义为：

```text
Final Candidate Score
=
alpha * Format Score
+
beta * Condition Score
+
gamma * Topic Consistency Score
+
delta * Fluency Score
-
lambda * Repetition Penalty
```

其中：

- Format Score：是否满足七言绝句格式；
- Condition Score：是否满足首句续写或藏头约束；
- Topic Consistency Score：是否围绕输入主题展开；
- Fluency Score：可由 PPL 转换得到；
- Repetition Penalty：重复惩罚。

建议权重设置为：

```text
alpha = 0.25
beta = 0.25
gamma = 0.30
delta = 0.10
lambda = 0.10
```

其中 Topic Consistency 权重较高，因为跑题问题会直接影响生成结果质量。

---


## 8. 前端展示方式

在前端“诗人手稿”模块中，每个候选手稿显示：

```text
格式：通过
PPL：19.6
主题一致性：93%
重复：无明显重复
简评：紧扣“空山、新雨”主题，后三句意象延续自然。
```

其中“主题一致性”即 Topic Consistency Score。

---

## 9. 方案优势

该方案同时结合了自动语义相似度与大模型评审：

1. Embedding Score 保证指标可自动批量计算；
2. LLM Judge 能更好理解古诗中的意境延续；
3. 二者结合可以降低单一指标误判风险；
4. 该指标可直接用于候选重排序和前端分析展示。

因此，Topic Consistency Evaluation 能够有效补充 PPL、Format Accuracy 和 Repetition Rate 等指标，更准确地判断生成诗是否围绕输入主题展开。

