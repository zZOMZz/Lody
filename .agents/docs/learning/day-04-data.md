# 第 4 天：本地数据、历史写入与同步

[上一章](day-03-agent.md) · [课程首页](README.md) · [下一章](day-05-performance.md)

目标：区分数据表示、写入约束、磁盘持久化和副本同步。先修：第 2 天边界校验、第 3 天 Session/Turn；用时约 160 分钟。

## 不要把几个“成功”合并成一个

| 观察                      | 能证明                         | 不能单独证明             |
| ------------------------- | ------------------------------ | ------------------------ |
| 输入框清空、消息出现      | 界面接受/投影了输入            | 已落盘、Agent 已执行     |
| HistoryWriter 接受命令    | 本地 CRDT 写入符合该命令的规则 | 磁盘 flush、远端收到     |
| repository 完成本地持久化 | 对应状态已通过本地保存边界     | 另一副本已收到           |
| 同步完成某轮交换          | 双方交换了该轮差异             | 未来不再断线、业务已成功 |

因此调试“消息丢了”要先指出丢在哪个边界。把一个 UI loading 改成 false，不会完成尚未发生的磁盘或协议操作。

## Loro、Flock 与版本向量

CRDT 是允许副本独立修改并按规则合并的数据结构；它解决的是并发状态合并，不替你处理权限、磁盘写入失败和业务副作用。版本向量可以粗略理解为“每个写入者已观察到哪个位置”，接收端提供自己的进度，发送端导出缺少的操作；它不是一枚可以简单比较大小的全局时间戳。

项目的会话历史使用 Loro Doc，目录等状态还使用 Flock。当前本地协议中，两种 room 都做版本向量增量同步；Doc 传二进制更新，Flock 通过 `exportJson(from)` 传增量记录。Flock 的独立记录与 Doc 更新 blob 的分块语义不同，不能把 Doc blob 切开后逐块 import。

概念数据通路如下（持久化不由 IPC 本身提供）：

```text
renderer 的 Doc / Flock 副本
  LocalLoroTransportAdapter
    Electron relay（IPC ↔ 本地 socket）
      CLI LocalLoroDataPlaneServer
        CLI 文档与 repository 存储
```

多个窗口可以共享 relay socket，却不能共享一个同步进度。`workspaceId` 区分工作空间，`peerId` 区分 adapter 实例，room 区分具体文档。重连时用服务端版本重新核对本地差异，才能补回断线时的写入；内存里的 dirty 标记会随重启消失，不能作为唯一证据。presence 是短暂在线状态，不应拿历史持久记录冒充它。

## 源码导读

| 顺序 | 落点                                                                                                          | 阅读问题                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1    | [协议定义](../../../packages/shared/src/local-loro-data-plane.ts) 的开头与 payload schema                     | 当前协议版本是多少？Doc 与 Flock 的版本和 payload 怎样编码？ |
| 2    | [local-loro-transport.ts](../../../packages/shared/src/local-loro-transport.ts)：`handleJoined`               | 为什么每次 join 都要重新核对服务端进度？                     |
| 3    | [history-writer.ts](../../../packages/shared/src/history-writer.ts)：`createHistoryWriter`、`preserveUnknown` | 新输入和既有数据有什么不同待遇？                             |
| 4    | [session-data/loro.ts](../../../packages/shared/src/session-data/loro.ts)：`createLoroSessionData`            | 业务命令如何使用统一 writer，而不是直接操作容器？            |

阅读[本地数据通道说明](../cli-lib-local-loro-data-plane.md)和[历史写入草案](../../../specs/session-history-writes.zh.md)。存储与 reader 的接口边界见 [session-data 约束](../../../packages/shared/src/session-data/AGENTS.md)。

## 为什么保留旧的未知内容

假设新客户端写入了旧客户端不认识的消息类型。旧客户端若在每次追加时“清洗全部历史”，就可能删除新内容。项目的策略是验证新 Turn 与本次修改的已知字段，保留未触碰的未知存储内容；非法修改在写入前失败，旧值应保持。

这里的“唯一 writer”是统一的本地写入契约/入口，不是全系统只有一台机器可以写。UI 通过 `sessionData` 提交命令，不能持有第二套绕过校验的 history 写法。读取投影也不是可信导出或 fork 的写入基线；复制历史要经过 writer 捕获的快照来源。

## 实验：真实 Loro，合成副本

先读 [Loro 入门](https://loro.dev/docs/tutorial/get_started) 的数据容器及导入/导出示例，再执行：

```sh
node .agents/docs/learning/examples/dependency-labs.mjs loro
pnpm --filter @lody/shared exec vitest run tests/history-writer.test.ts tests/local-loro-transport-bug-repro.test.ts
```

第一个程序给两个副本不同 peer ID，断开时分别向同一列表追加内容，再双向导入差异；还重复导入同一更新并从 snapshot 重建副本。预期 `loro: converged, replay-idempotent, snapshot-restored`。只检查最终收敛和成员，不把并发项的某种具体排序写成业务承诺。

库实验不经过真实磁盘和 Electron relay。后面的项目回归覆盖 HistoryWriter 与多 peer 重连等真实边界；也不等于断电持久化或完整桌面验收。阅读其中一个测试的 setup、事件控制、最终状态，写出它可以发现哪一种回归。

## 章末练习

- **4.1（2 分）** CRDT 收敛能否保证一个 Agent 命令只执行一次？HistoryWriter 接受是否等于落盘？
- **4.2（3 分）** 两个窗口共用 socket，其中一个上传更新。如果服务器只按 socket 保存同步进度，另一个窗口可能遇到什么问题？重启后只看 dirty 标记有什么漏洞？
- **4.3（5 分）** 在 Loro 实验中增加第三个副本，安排 A→B→C→A 的交换，并补足后续交换直至三者收敛。重复投递一次更新，证明没有重复列表项。给出操作顺序和断言。

对照[第 4 天评分](answers.md#day-4)。扩展：查找 `SessionDocument.appendUserTurn`，解释历史写入与 `latestUserMsgId` 激活信息为什么需要配合，但它不是一个跨文档分布式事务。
