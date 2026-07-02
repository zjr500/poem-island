# 七言绝句生成与诗人风格控制实验设计

## 整体研究目标

本项目构建一个七言绝句生成系统，并进一步研究诗人风格控制。整体路线为：通用模型构建 → 风格中立性验证 → 诗人风格控制。

## 第一阶段：通用七言绝句生成底座构建

### Experiment 01: Backbone Selection

目标：比较 Char-LSTM、Char-GRU、Transformer-2L、Transformer-4L、Transformer-6L、Transformer-8L，选择后续实验统一使用的通用骨干。

评价指标：Validation PPL、Format Accuracy、Condition Accuracy、Topic Consistency Score、Repetition Rate、Distinct-1、Distinct-2、Training Time。

### Experiment 02: General Quality Optimization

目标：验证 Rule Quality Constraint 是否提升通用七绝生成的稳定性。

对比版本：

- Base Transformer
- Base Transformer + Rule Quality Constraint

Rule Quality Constraint 包括七言格式约束、长度约束、首句续写/藏头条件约束和重复控制。

评价指标：Validation PPL、Format Accuracy、Condition Accuracy、Topic Consistency Score、Repetition Rate、Distinct-1、Distinct-2、Human Quality Score。

### Experiment 03: Candidate Generation and Reranking

目标：验证多候选生成与重排序是否提升最终输出质量。

对比版本：Single Sample、Rerank@3、Rerank@5、Rerank@10。

排序依据：Format Score、Condition Score、Topic Consistency Score、Fluency Score、Repetition Penalty。

评价指标：Best Candidate Quality、Format Accuracy、Condition Accuracy、Topic Consistency Score、Repetition Rate、Distinct-1、Distinct-2、Human Preference Score。

### Experiment 04: Final General System Combination Ablation

目标：只把前置实验证明有效的模块放入最终组合消融，寻找最佳通用模型组合。

模块定义：

- A：Best Backbone，即 Transformer-6L
- B：Rule Quality Constraint
- C：Candidate Reranking

消融组合：A、A+B、A+C、A+B+C。

评价指标：Validation PPL、Format Accuracy、Condition Accuracy、Topic Consistency Score、Repetition Rate、Distinct-1、Distinct-2、Human Quality Score。

## 第二阶段：风格中立性验证

阶段目标：验证第一阶段得到的通用模型是否存在明显诗人偏置。第二阶段只评估风格中立性，不使用 Topic Consistency Score。

### Experiment 05: Poet Classifier Neutrality Evaluation

目标：使用诗人分类器评估通用模型生成结果是否偏向李白、王维、白居易或其他类别。

评价指标：Poet Distribution、Style Bias Rate、Maximum Poet Bias、Style Entropy。

### Experiment 06: Style Keyword Distribution Evaluation

目标：统计李白、王维、白居易典型风格关键词在通用模型生成结果中的分布，观察是否存在意象层面的风格偏置。

评价指标：Li Bai Keyword Ratio、Wang Wei Keyword Ratio、Bai Juyi Keyword Ratio、Style Entropy、Keyword Balance Score。

## 第三阶段：诗人风格控制

阶段目标：在风格中立通用模型基础上，实现对李白、王维、白居易三位诗人的可控风格生成。

第三阶段统一评价指标：Style Accuracy、Human Style Score、Human Quality Score、Format Accuracy、Condition Accuracy、Repetition Rate、Distinct-1、Distinct-2、Copy Rate。

### Experiment 08: RAG Style Control

目标：使用诗人作品检索增强风格表达。检索到的同诗人参考诗会拼接为上下文并输入模型，而不是只做 Retrieve-and-Rerank。

对比版本：No RAG、RAG@1、RAG@3、RAG@5。

### Experiment 09: Poet Adapter Control

目标：训练独立诗人 Adapter，比较不同诗人轻量风格参数的控制效果。

对比版本：General Model、Li Bai Adapter、Wang Wei Adapter、Bai Juyi Adapter。

### Experiment 10: Style Embedding Control

目标：使用连续风格向量控制诗人风格。

对比版本：Discrete Style、Style Embedding、Mixed Style Embedding、Style Embedding Frozen。

### Experiment 11: Style Control Combination Ablation

目标：对阶段三已证明有价值的模块进行组合消融，寻找最佳风格控制系统。

模块定义：

- A：General Foundation Model
- B：RAG Style Context
- C：Poet Adapter
- D：Style Embedding

消融组合：A、A+B、A+C、A+D、A+B+C、A+B+D、A+C+D、A+B+C+D。

评价指标：Style Accuracy、Human Style Score、Human Quality Score、Format Accuracy、Condition Accuracy、Repetition Rate、Distinct-1、Distinct-2、Copy Rate。
