---
title: 用 Spring AI 自动分类工单
date: 2026-10-09
tags: [Java, AI]
---

AI-Ticket-Management 里最早跑通的一条链路，是工单自动分类：用户提交工单后，先用 Spring AI 的 ChatClient 做一次意图识别，再路由到对应的处理模板。

踩过的坑主要在两个地方：

- Prompt 别写太长。工单分类的输入本来就短，Prompt 占了大半，模型反而抓不住重点。
- 别一上来就上向量检索。几十种工单类型用 few-shot 就够，embedding 和检索链路留到类型多起来再上。

（示例文章，上线前替换成自己的内容。）
