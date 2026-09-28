# 第 5 天：长会话与性能

[上一章](day-04-data.md) · [课程首页](README.md) · [下一章](day-06-worktree.md)

目标：把“卡顿”分成可测量的问题，理解窗口读取、订阅范围、异步缓存失效和事件循环。先修：React 状态、Promise、第 4 天的数据层；用时约 150 分钟。

## 一条新 token 到来，究竟做了多少工作

假设对话已有 3,000 轮，新 token 只属于末尾一个 Turn。如果每次变化都把完整历史转成 JS 数组、重算所有摘要、通知整个页面，再生成 React 树，显示内容很少也可能卡。

虚拟列表主要控制挂载的 DOM 数量；窗口读取控制物化多少正文；细粒度订阅控制谁收到变化；worker 把某些计算移离 UI 线程。这四件事解决不同的成本。把工作移到 worker 仍然消耗 CPU 和内存，把列表虚拟化也不会自动让数据加载变成 O(1)。

项目当前路径先读取浅目录，再按窗口与尾部保留正文。初始文档导入、浅目录建立仍随总历史增长；不能把“窗口化”宣传成完全常数时间打开。反过来，丢弃所有正文缓存也会使反复打开产生重复读取，需要在保留范围与内存预算之间取舍。

## 读一个窗口缓存，而不是先猜 memo

| 顺序 | 落点                                                                                                                                      | 阅读任务                                              |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1    | [ConversationView/types.ts](../../../packages/components/src/lib/conversation-view/types.ts)                                              | 分清 `index`、`turn`、`acquireRange` 和释放句柄       |
| 2    | [create-conversation-view-from-reader.ts](../../../packages/components/src/lib/conversation-view/create-conversation-view-from-reader.ts) | 跟踪 turn ID、membership/content epoch 与缓存接收条件 |
| 3    | [渲染成本说明](../sessions-render-cost.md)                                                                                                | 找两个应下沉到叶节点的订阅，解释为什么                |
| 4    | [调度检查合并记录](../../notes/implemented/bug-fix/2026-09-13-dispatch-check-coalescing.zh.md)                                            | 为什么每个 Promise 都 await 了，仍可能饿死其他工作？  |

缓存用 Turn ID 表示身份，位置只是当前排序。一次删除会让后续位置移动；如果按旧位置接收异步结果，就可能把 A 的正文放在 B 的行。即使 ID 不变，内容也可能已经更新，因此还需要版本/epoch 检查。租约释放后，不再需要的读取不能重新把旧正文固定在缓存中。

数据事件分为结构变化和明确 ID 的内容变化。只改第 100 轮与第 2,900 轮时，把两个 ID 合并成一个巨大区间会误读中间正文；已经逐出的 Turn 被修改，也应让其派生事实失效。规则见 [ConversationView/AGENTS.md](../../../packages/components/src/lib/conversation-view/AGENTS.md)。

## 实验：控制返回顺序

```sh
node --experimental-strip-types .agents/docs/learning/examples/labs.mjs 5
```

查看 [labEpoch](examples/labs.mjs)：先发起一次旧读取，再使内容版本变化并发起新读取。让新结果先返回、旧结果后返回；预期缓存最终仍是 `new`，输出 `day 5: ok`。用手动 Promise 控制顺序，完全不依赖机器快慢或真实计时器。

这是单项 epoch 的教学模型，没有模拟完整 membership、范围租约和 reader。项目级验证使用：

```sh
pnpm --filter @lody/components exec vitest run tests/conversation-view-from-reader.test.ts
```

先找到一个处理迟到读取或失效的测试，再画出时间线。最后才看实现怎么通过它，不要先记内部 Map 的名字。

## 怎样提出性能假设

一个合格的假设包含触发、成本位置、对照和正确性检查。例如：“追加一个 token 时，无关 Turn 的正文不应重新读取；把 30 轮换成 3,000 轮后，记录每轮被读取的 ID，而不是只看总耗时”。库级实验可以证明读取范围，不能证明真机首屏无空白。

| 问题             | 可观察证据                         | 不充分的证据             |
| ---------------- | ---------------------------------- | ------------------------ |
| 无关行是否更新   | profiler 中的 commit/组件更新范围  | 到处加了 `memo`          |
| 是否重复物化正文 | 读取过的 Turn ID、范围、内存保留   | 屏幕只看到 20 行         |
| 是否阻塞事件循环 | 受控调度下其他任务能前进           | 函数里有 `await`         |
| 首屏是否稳定     | 真实浏览器测量后的可见行与滚动位置 | range Promise 已 resolve |

项目中的 check 合并把一次正在执行后的多次触发收敛为有限后续工作；让出宏任务给其他事件执行机会。它适用于“重读最新状态”的触发，不适用于必须逐条保留的用户命令。合并前必须明确什么信息可以丢掉。

## 章末练习

- **5.1（2 分）** 虚拟列表、窗口读取分别限制什么？为什么打开会话仍可能有 O(total) 成本？
- **5.2（3 分）** A 的旧正文请求尚未返回，A 被删除，当前位置变成 B。仅比较数组下标是否安全？仅比较 ID 又漏掉哪种变化？
- **5.3（5 分）** 扩展 epoch 实验，加入“读取中释放，结果回来也不接受”的场景和正常命中场景；另写一个关于 3,000 轮会话的测量方案，明确输入、指标、对照和未证明项。

对照[第 5 天评分](answers.md#day-5)。选读[窗口读取集成记录](../../notes/implemented/architecture/2026-09-10-windowed-reader-integration.zh.md)，理解当时测量的条件；不要把历史实验数值当作你的机器的成绩。
