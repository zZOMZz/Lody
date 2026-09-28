# 第 3 天：Agent 协议与任务生命周期

[上一章](day-02-ipc.md) · [课程首页](README.md) · [下一章](day-04-data.md)

目标：区分协议、调度决策和执行资源，能推演 Stop 与迟到响应的竞争。先修：Promise、try/finally、前两章；用时约 160 分钟。

## ACP 和 MCP 分别连接谁

ACP 把宿主客户端和编码 Agent 连接起来，约定初始化、会话、prompt、流式更新和权限交互。MCP 把 AI 应用与工具/资源服务连接起来。Lody 可以通过 ACP 控制 Agent，也可以向 Agent 提供 MCP 工具；接入一个协议不意味着自动实现另一个。先读 [ACP overview](https://agentclientprotocol.com/protocol/v1/overview) 与 [MCP architecture](https://modelcontextprotocol.io/docs/learn/architecture) 的角色介绍。

Provider 负责如何启动/配置 Agent，Session 表示持续的对话，Turn 表示一次输入及执行。Lody 会话 ID 与上游 Agent 的原生会话 ID 有不同归属，不能因为都叫 session 就相互替换。运行能力由协议协商提供，不能单凭供应商名称推断支持某个操作。

## 先读决策，再读执行

| 顺序 | 源码落点                                                                                                                                                          | 要回答的问题                              |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1    | [session-dispatch-logic.ts](../../../apps/cli/src/session/session-dispatch-logic.ts)：`SessionDispatchSnapshot`、`DispatchAction`、`resolveSessionDispatchAction` | 怎样把外部状态变成纯决策？                |
| 2    | [session-dispatch-watcher.ts](../../../apps/cli/src/session/session-dispatch-watcher.ts)：`enqueueSessionCheck`                                                   | 多次触发怎样收敛为有限检查？              |
| 3    | [session-execution-service.ts](../../../apps/cli/src/session/session-execution-service.ts)：`runVisibleSessionTurn`、`drainCancelledPrompt`                       | 谁拥有正在执行的 Turn，什么时候才能释放？ |
| 4    | [agent-client.ts](../../../apps/cli/src/agent/agent-client.ts)：`requestPermission`、`sessionUpdate` 与 `connection.initialize` 的调用处                          | 哪些是调用返回，哪些是异步通知？          |

实际函数名可用 `rg -n` 搜索。阅读完整执行服务不是当天任务；每个落点记录输入、状态拥有者和结束条件即可。历史是执行输入的持久来源，RPC offer 帮助快速发现工作；不能在收到 RPC 的 handler 中另起一条绕过调度的执行路径。

纯决策层有一个重要优点：给定 snapshot，就能预测返回的 action。IO 外壳负责取状态和实施 action。代价是 snapshot 可能过时，因此执行边界仍需要检查资源归属和竞争条件，不能把纯函数通过当作执行已成功。

把入口接回界面时，查 [session-submission.ts](../../../packages/components/src/lib/session-submission.ts) 的 `createSessionSubmission`：`addSessionHistory` 汇合新建和后续发送，用户输入交给 `acceptSessionUserTurn`；`requestSessionDispatch` 处理 journal 路径或激活/RPC 路径。阅读时标出自己跟踪的是哪条分支，不能把所有 send 简化成“invoke 后直接 prompt”。

## 取消是一个过程

下面是省略恢复分支的概念时序；状态名是教学标签，不是存储 schema：

```text
输入被接受 → 调度认领 → 创建/复用 ACP 会话 → prompt 进行中
  正常：更新历史 → prompt 结束 → 最终化 → 释放执行归属
  Stop：记录取消 → 请求 provider cancel → 等待原请求结束
        超出 drain 期限：尝试终止旧 session
        确认原工作结束后：最终化 → 释放执行归属
```

本地 `AbortSignal` 只表达取消意图；它不能证明外部进程已停止。源码中取消 drain 有五秒期限，终止失败仍保留归属，避免旧工作还在运行时启动冲突的新任务。这个期限不是“睡五秒就当成功”。

对已提交的 steer，adapter 的结论是 `applied`、`not-applied` 或 `unknown`。只有明确未投递，且当前取消策略允许提升，才可能进入普通调度。网络错误或 Stop 不等于未投递；自动重试 unknown 可能重复执行。行为契约见[历史写入草案](../../../specs/session-history-writes.md)，约束见 [session/AGENTS.md](../../../apps/cli/src/session/AGENTS.md)。

## 两个可运行实验

```sh
node --experimental-strip-types .agents/docs/learning/examples/labs.mjs 3
node .agents/docs/learning/examples/dependency-labs.mjs effect
```

第一个无需依赖，以手动 Promise 屏障控制“第一步配置已开始 → Stop → 第一步迟到完成”，检查第二步和最终配置写入不会继续。预期 `day 3: ok`。这是配置 mutation fence 的教学模型，不能用来把 ACP 的迟到投递结论丢弃。

第二个需要完整安装，使用真实 Effect v3 的 `acquireRelease` 与 `scoped`，比较成功和失败时的资源释放顺序。预期 `effect: acquire/use/release on success and failure`。在 [Effect 3.18.4 官方源码](https://github.com/Effect-TS/effect/blob/ede2ea11c2abe7038bac3c83fb7b5eef101858d2/packages/effect/src/Effect.ts) 中搜索这两个 API，阅读它们的文档注释及示例，再解释：scope 把资源释放绑定到工作的生命周期，减少遗漏 finally；但外部 ACP 是否真正结束仍由协议和进程边界确认，不能只靠 fiber 被中断推断。

## 章末练习

- **3.1（2 分）** 分别画出 ACP 与 MCP 两端的角色，并解释 Session 与 Turn 的差别。
- **3.2（3 分）** Stop 后收到 steer 的 `unknown`，随后用户发送新消息。为什么不能自动把旧输入再执行一次？取消 ACK 是否足以释放执行归属？
- **3.3（5 分）** 修改配置屏障实验：增加第三步，证明第二步等待期间取消会阻止第三步及最终写入；另保留一条全部成功的路径。指出生产实现里对应的 signal 检查位置。

对照[第 3 天评分](answers.md#day-3)。扩展：阅读 [Agent 模块说明](../../../apps/cli/src/agent/README.md) 中 runtime 与 capability cache 的分工，区分缓存新鲜度和协议可用性。
