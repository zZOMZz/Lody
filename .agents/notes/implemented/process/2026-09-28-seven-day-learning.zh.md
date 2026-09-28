# 七天源码学习课程

Status: implemented
Translation: current

[English](2026-09-28-seven-day-learning.md)

## 摘要

Lody 的源码和现有说明跨越多个运行时，新读者需要一条范围明确的路径来理解职责和失败行为。课程用七天沿一条消息学习本地桌面、执行、持久化、显示及工作区恢复。每章组合指定源码阅读、可运行的合成实验、练习和独立评分答案。实验区分概念模型与真实库、项目测试，通过它们不代表完成桌面或跨平台正确性验证。

## 决定与范围

[课程](../../../docs/learning/README.md)使用中文，假定具备 JavaScript/Git 基础，每天 2–3 小时。课程提供预备检查与扩展阅读，不要求所有学习者通读每种 Provider 或完整执行服务。主线解释公开本地构建，将草案意图与已检查实现分开；不改变产品保证、协议或运行时代码。

逐目录罗列会掩盖跨模块消息生命周期，完整框架教程又会超出一周。采用的顺序只补充理解下一个边界所需的概念，再通过失败场景复习。答案独立放置，让学习者先预测结果再核对。

第 1 天直接导入项目中无需依赖的真实平台 helper。第 2、3、5 天使用边界、取消与 epoch 的小模型，明确不替代生产测试。独立程序使用已安装的 Effect、Loro 和临时 Git 仓库。现有套件覆盖历史写入、本地传输、窗口读取、调度决策与 worktree GC。综合作业扩展所属行为套件，不编造缺陷或重复覆盖。

## 证据与相关决定

- 源码基线为 `4f515900`。[平台能力](../../../../packages/platform/src/capabilities.ts)、[调度](../../../../apps/cli/src/session/session-dispatch-logic.ts)及 [ConversationView](../../../../packages/components/src/lib/conversation-view/create-conversation-view-from-reader.ts)提供导读落点。
- [唯一 HistoryWriter](../architecture/2026-09-07-single-history-writer.zh.md)、[窗口读取](../architecture/2026-09-10-windowed-reader-integration.zh.md)和[调度检查合并](../bug-fix/2026-09-13-dispatch-check-coalescing.zh.md)仍拥有原决定；课程增加教学路径，不替代它们。
- 现有[本地数据通道说明](../../../docs/cli-lib-local-loro-data-plane.md)写成 Flock 全量 bundle，但[协议](../../../../packages/shared/src/local-loro-data-plane.ts)与传输两端使用基于版本向量的 `exportJson(from)` 增量。说明已按检查到的实现修正，包括每 peer 的 Flock 版本。这是过时文档修正，不是协议意图变更。

## 验证与限制

七次示例运行均在 Node 24.14.0 下通过。五个现有测试文件共 113 项通过，涵盖 HistoryWriter、本地传输回归、ConversationView reader、调度逻辑与 worktree GC。实验采用合成输入、显式 Promise 屏障和私有临时 Git fixture，不调用模型。

初始化固定版本的子模块后，`pnpm run docs check` 以零错误通过，保留 63 项已有警告。格式、类型、lint、i18n、代码与平台/公开边界检查通过。公开边界扫描器会匹配 Effect 文档域名中的一段子串，因此课程改用固定到已安装版本的官方 API 源码链接，没有改动检查器。

`pnpm check` 首次遇到沙箱数据目录权限错误；指定临时 `LODY_DATA_DIR` 重跑后，剩下 [speculative-worktree.test.ts](../../../../apps/cli/src/session/worktree/speculative-worktree.test.ts) 的一项已有失败：活动会话恢复测试要求不调用 `isDurableSession`。单独运行该套件也复现（6 项通过、1 项失败），测试与实现相对基线均未改动。没有执行真实 Agent 对话、桌面 E2E、冷开性能或非 macOS 验收；引用记录中的历史性能数据仅适用于原始测量条件。
