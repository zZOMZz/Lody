# 第 6 天：Worktree 与可恢复操作

[上一章](day-05-performance.md) · [课程首页](README.md) · [下一章](day-07-verification.md)

目标：解释工作区隔离与归档恢复的状态归属，学会为多步操作设计失败路径。先修：Git commit/branch、第 3 天生命周期；用时约 150 分钟。

## branch、worktree、Session 是三件事

branch 是指向提交的引用；worktree 是某个提交/分支对应的工作目录与索引；Session 是产品中的对话与执行身份。一个仓库可以有多个 worktree，各自保留未提交修改，并共享仓库对象。Child tab 可以共享父会话工作区，所以会话数量不等于 worktree 数量。

Git worktree 隔离文件修改，不隔离端口、外部数据库、系统环境或凭据。两个 Agent 在不同目录仍可能竞争同一个监听端口。学习时应明确“隔离了什么”，而不是把 worktree 当作完整安全沙箱。参考 [Git worktree](https://git-scm.com/docs/git-worktree) 的 description、add、remove、list。

## 从命令队列转向状态协调

设想“归档后删除工作目录”命令只执行一次，删除时磁盘暂时不可用，命令却被确认消费。后续没有东西提醒系统重试。状态协调的输入是持久意图：会话已归档，但受管理目录仍存在，所以工作仍未完成，下次继续尝试。

这种设计的核心是幂等：多观察一次同样状态不会破坏已完成结果。它也有成本——必须维护归属证据，防止把“还没有同步到”误判为“已删除”。Lody 的 GC 只处理自己管理的工作区树，并等待完整元数据；不知道是谁的目录要保留。

| 当前证据                                     | 教材要你预测的动作                 |
| -------------------------------------------- | ---------------------------------- |
| 元数据还不完整                               | 不开始清理                         |
| owner 是 unknown 或 active                   | 保留目录                           |
| owner 已 archived/deleted，但 runtime 仍活动 | 等待运行资源释放                   |
| owner 已 archived/deleted，可以安全清理      | 备份非忽略修改，移除目录，保留分支 |
| 无法解析 repository，不能保存备份            | 保留目录并重试                     |

归档释放 runtime 与磁盘清理是两个生命周期，不能为了等待清理而让 Agent 一直运行，也不能在进程未释放时直接销毁它的 cwd。Ignored 文件不包含在备份保证内。

## 源码导读

1. [Worktree 生命周期草案](../../../specs/session-worktree-lifecycle.md)：先读 scenario、operations 和 unresolved。把意图与已知限制一起记下。
2. [worktree-gc.ts](../../../apps/cli/src/session/worktree/worktree-gc.ts)：读 `WorktreeOwnerState`、`WorktreeGcDeps`、`schedule` 与 sweep 中的保护条件。
3. [worktree-manager.ts](../../../apps/cli/src/session/worktree/worktree-manager.ts)：定位 `archiveWorktree`，检查备份提交与保留分支的顺序。
4. [worktree-gc.test.ts](../../../apps/cli/tests/worktree-gc.test.ts)：选择 unknown、dirty、retry 中的一个场景，观察文件系统结果。

约束见 [worktree/AGENTS.md](../../../apps/cli/src/session/worktree/AGENTS.md)。某个 helper 支持删除 branch，不代表归档路径可以使用它；阅读调用时传入的策略比只看函数名字重要。

## 实验：用真实 Git 验证保留了什么

```sh
node .agents/docs/learning/examples/worktree.mjs
```

程序只在 `mkdtemp` 创建的临时仓库里操作：创建一个分支/worktree，写入 tracked、untracked、ignored 三类文件，提交备份，移除目录，再从保留分支恢复。它显式指定合成 Git 身份和空 hooks 目录，不使用你的项目文件作为输入；完成后清理自己的临时目录。

预期输出 `worktree: isolation, backup, restore verified`。tracked 与 untracked 内容恢复，ignored 内容消失，原仓库工作目录不受分支 worktree 修改影响。这个程序说明 Git 机制，不调用 Lody 的 GC；真正产品行为另外运行：

```sh
pnpm --filter lody exec vitest run tests/worktree-gc.test.ts
```

先手工写下每一步失败时保留下来的目录、分支、数据，再阅读断言。不要在当前学习分支上试 `reset --hard` 或 force remove。

## 多步恢复的进一步理解

fork 还涉及创建文档、准备 ACP 会话和工作区，无法靠一个数据库事务包住所有外部动作。可以按“准备 → 提交点 → 提交前补偿/提交后继续修复”阅读，即 saga 思路。补偿必须仅处理本操作拥有的资源；显示投影失败不应回滚已经持久提交的新会话。

选读 [session 约束中的 Sagas](../../../apps/cli/src/session/AGENTS.md#sagas) 与 [Operation 协调说明](../../../apps/cli/src/orchestration/README.md)。另区分 child tab 的包含关系与跨会话委派因果链；后者不会自动变成多层共享工作区树。

## 章末练习

- **6.1（2 分）** worktree 与 branch 有什么区别？它能否隔离两个 Agent 使用同一端口？
- **6.2（3 分）** 归档后清理失败、元数据尚不完整、目录 owner 未知，这三种情况分别怎样处理？为什么不应该统一为“重试删除”？
- **6.3（5 分）** 运行 Git 实验，记录三类文件恢复结果；为“备份提交失败”和“目录删除失败”分别写失败后状态及下一次动作，并指出生产 GC 的对应保护条件。

对照[第 6 天评分](answers.md#day-6)。本章不要求修改用户实际会话，也不需要推送临时分支。
