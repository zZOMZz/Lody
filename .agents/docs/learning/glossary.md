# 术语、先修与进一步阅读

[课程首页](README.md) · [参考答案](answers.md)

术语先按项目中的职责理解，再查具体类型；同一英文词在不同库里可能指不同对象。此表帮助定位，不取代所属模块的契约。

| 术语                    | 在学习主线中的含义                          | 容易混淆的点                             |
| ----------------------- | ------------------------------------------- | ---------------------------------------- |
| Workspace               | 项目中的工作空间和身份/目录范围             | 不是每个 Git 工作目录                    |
| Machine / daemon        | 执行宿主及本机常驻 CLI 服务                 | Electron main 不是 daemon 的同义词       |
| Provider / Agent config | 如何启动和配置具体 Agent                    | 不等于模型 ID 或一次执行                 |
| Session / Turn          | 持续对话 / 一次输入及其执行单位             | Lody ID 不等于上游原生会话 ID            |
| ACP                     | 宿主客户端与编码 Agent 的协议               | 不负责代替宿主所有权限与持久化           |
| MCP                     | AI 应用与工具、资源服务的协议               | 不等于 ACP，也不等于 Lody Role           |
| Capability              | 某平台/协议支持的能力                       | 支持不代表某个用户获授权                 |
| Port / adapter          | 业务依赖的接口 / 接口的具体实现             | 同样接口可有不同运行环境实现             |
| IPC / RPC               | 进程间通信 / 远程过程调用抽象               | 类型声明不会自动验证外部输入             |
| Schema / Zod            | 数据结构与运行时解析规则                    | `as Type` 不做解析                       |
| CRDT / Loro Doc         | 可并发合并的数据结构 / 本项目使用的文档实现 | 收敛不等于事务、落盘或命令恰好执行一次   |
| Flock                   | 项目用于目录等状态的记录集合及其同步机制    | 当前本地协议有增量，不能沿用旧的全量假设 |
| Version vector          | 按写入者记录的已观察进度                    | 不是一个全局递增时间戳                   |
| HistoryWriter           | 统一历史写入边界                            | 不代表全系统只允许一个副本写             |
| SessionData             | 面向业务命令/读取的数据端口                 | UI 不应绕过它写原始 history              |
| ConversationView        | 浅索引、按需正文和事件订阅的显示读取接口    | 不是全历史导出与 fork 的写基线           |
| Lease / epoch           | 持有资源的范围 / 用于判别响应版本的代数     | 释放与失效解决不同问题                   |
| Presence                | 临时在线/活动事实                           | 不能用持久状态替代实时观测               |
| Effect / scope          | 管理错误、依赖和生命周期的工具 / 资源范围   | fiber 取消不证明外部进程已退出           |
| Steer                   | 执行进行中向 Agent 引导输入                 | 不确定投递不能当作未执行                 |
| Worktree                | 一份 Git checkout 及其索引                  | 不是容器、进程沙箱或独立对象数据库       |
| Reconciliation          | 比较持久意图与实际状态，再逐步收敛          | unknown 不等于 deleted                   |
| Saga                    | 跨资源多步操作及其补偿组织方式              | 不是自动具备回滚能力的数据库事务         |

## 先修补给：按问题读

| 你卡住的问题                     | 官方资料与阅读范围                                                                                                                                                     | 回到项目做什么                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 为什么要判断 `status` 才能读字段 | [TypeScript Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)：type guards、discriminated unions                                               | 给第 1 天的状态分支画表                 |
| Promise 怎样表达先后             | [MDN Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)：description                                                   | 解释第 3 天 Deferred 为什么不用 sleep   |
| 状态变化怎样通知 React           | [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)：subscribe、getSnapshot、troubleshooting                                                | 对照 `packages/platform/src/react.ts`   |
| preload 可以做什么               | [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)：三个运行角色                                                                  | 重画第 2 天快照调用链                   |
| JSON 为什么仍需要校验            | [Zod basics](https://zod.dev/basics)：parsing、handling errors                                                                                                         | 比较 unknown 输入与解析后结果           |
| ACP 初始化后会怎样               | [ACP overview](https://agentclientprotocol.com/protocol/v1/overview)                                                                                                   | 区分请求返回与 session update           |
| MCP 服务放在哪端                 | [MCP architecture](https://modelcontextprotocol.io/docs/learn/architecture)：host/client/server                                                                        | 标出 Lody 与 Agent 的角色               |
| 资源遇到失败怎样释放             | [Effect 3.18.4 API 注释](https://github.com/Effect-TS/effect/blob/ede2ea11c2abe7038bac3c83fb7b5eef101858d2/packages/effect/src/Effect.ts)：搜索 acquireRelease、scoped | 运行 effect 实验，解释 finally 与 scope |
| 副本怎样合并                     | [Loro getting started](https://loro.dev/docs/tutorial/get_started)：容器、import/export                                                                                | 改第 4 天副本交换顺序                   |
| 分支删了和目录删了有什么区别     | [git-worktree](https://git-scm.com/docs/git-worktree)：description、add、remove                                                                                        | 对照第 6 天恢复断言                     |
| 测试怎样控制超时                 | [Vitest timers](https://vitest.dev/guide/mocking/timers)                                                                                                               | 把真实等待换成显式推进                  |

资料服务于概念，不要求安装其最新版本；实验使用仓库锁定依赖，尤其 Effect 按 v3 阅读。外部官方网页会演进，示例是否适用仍需以项目的类型和实际运行验证。

## 首周后的三条方向

- **前端与交互**：从 [`@lody/ui`](../../../packages/ui/README.md) 选一个 Field，跟进 StyleX 语义 token、可访问交互、Storybook 状态；再回到业务组件检查订阅范围。目标是能解释 UI 原语与工作流的分界。
- **Agent 与可靠性**：沿 [Session 模块说明](../../../apps/cli/src/session/README.md) 学习 fork、恢复、冻结请求身份、Operation；以失败补偿表为练习。不要把源码中的 cloud 分支当成本地默认能力。
- **数据与性能**：沿 [session-data 规则](../../../packages/shared/src/session-data/AGENTS.md) 和 [ConversationView 规则](../../../packages/components/src/lib/conversation-view/AGENTS.md) 研究读取成本、lease、schema 演进；用具体反例验证兼容策略。
