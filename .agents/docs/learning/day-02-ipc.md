# 第 2 天：Electron 与类型化 IPC

[上一章](day-01-map.md) · [课程首页](README.md) · [下一章](day-03-agent.md)

目标：追踪一个真实的本地身份查询，解释类型检查和运行时校验各自保护什么。先修：Promise、对象和第 1 天的平台边界；用时约 150 分钟。

## 为什么需要三种职责

Electron 的 main 管理窗口和本机资源，renderer 绘制界面，preload 在 renderer 环境与受限桥接之间提供入口。preload 不是另一个独立进程。跨进程调用不会把 JS 对象引用直接共享过去，必须定义消息与生命周期。参考 [Electron 进程模型](https://www.electronjs.org/docs/latest/tutorial/process-model) 的 main、renderer、preload 三节。

普通 React 组件不应因为想读一份本地目录就取得任意文件系统权限。窄接口把意图限制为“读取本地平台快照”；main 在自己的边界做解析、读取和错误分类。这样既能减少暴露面，也能让业务组件保持平台中立。

## 真实调用链：本地身份快照

```text
renderer：startLocalPlatformSnapshotPolling
  getIpcServices().localPlatform.getSnapshot()
  preload：ipcBridge.invoke（检查 channel）
  main：LocalPlatformIpc.getSnapshot
    readLocalPlatformSnapshot
      读取 CLI 已发布的本地 catalog，解析完整快照
  renderer：设置 identity / workspace stores，结束 bootstrap polling
```

这里的 polling 是启动时等待 catalog 就绪；第 4 天的本地 Loro 同步通道是推送式，两者不能混为一谈。文件不存在代表还在 provisioning；文件存在但 JSON 或身份结构损坏是错误，不能创造一个新身份悄悄继续。分别生成 user 和 workspace 的回退值，会制造互不匹配的身份。

| 阅读顺序 | 入口与函数                                                                                                                               | 需要记录的证据                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1        | [local-platform-provider.ts](../../../packages/components/src/providers/local-platform-provider.ts)：`startLocalPlatformSnapshotPolling` | 哪个结果继续等待？哪个结果结束轮询？  |
| 2        | [ipc-bridge.ts](../../../apps/electron/src/preload/ipc-bridge.ts)：`invoke`、`on`                                                        | 通道检查与 listener 释放如何表达？    |
| 3        | [local-platform-ipc.ts](../../../apps/electron/src/main/ipc/services/local-platform-ipc.ts)：`getSnapshot`                               | 平台不匹配时返回什么？                |
| 4        | [platform.ts](../../../apps/electron/src/main/platform.ts)：`readLocalPlatformSnapshot`                                                  | `ENOENT` 与解析异常为什么有不同结果？ |

进一步看 [register-services.ts](../../../apps/electron/src/main/ipc/register-services.ts)：`IPC_SERVICE_CONSTRUCTORS` 是服务构造器入口，`MergeIpcService` 推导接口类型。服务方法用装饰器声明 renderer-facing API，避免维护另一套手写 invoke 签名。具体约束见 [Electron 源码约定](../../../apps/electron/src/AGENTS.md)。

## 类型可靠，不等于输入可信

TypeScript 类型在编译后不负责验证陌生 JSON。`payload as Request` 是对编译器作承诺，不是检查。输入边界应先接收 `unknown`，解析成功后再进入业务逻辑。Zod 的 `safeParse` 把成功与失败显式分开；阅读 [Zod basics](https://zod.dev/basics) 的 parsing 和 handling errors 即可。

把三个问题分开：channel 是否允许调用、payload 是否符合结构、sender 是否有权限执行。任意一项通过都不代表另外两项成立。课程的最小模型只验证前两项，不实现 Electron sender 身份验证。

```sh
node --experimental-strip-types .agents/docs/learning/examples/labs.mjs 2
```

打开 [labBoundary](examples/labs.mjs)：它允许合成的 `counter.add` 请求，并要求 delta 是安全整数。预期 `day 2: ok`。尝试传字符串、数组和未知 channel，确认它们不能改变计数。合法请求最后仍可使用，说明失败没有污染业务状态。这里手写校验为了让实验无需依赖；产品应继续使用它既有的 schema。

## 从通信回到 React

快照进入 store 后，React 组件需要订阅变化，而非在 render 中反复查询 IPC。订阅必须可清理，快照没有变化时应保持稳定，否则容易制造无效更新。阅读 [React useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore) 的 `subscribe`、`getSnapshot` 及快照缓存说明，再对照 [platform/react.ts](../../../packages/platform/src/react.ts) 的 store 适配；Jotai 是项目其他状态消费的组成部分，不等于持久化数据库。

异步订阅还有一个通用顺序问题：若先发送、后监听，快速返回可能被漏掉。哪些 API 是一次 invoke，哪些还会推送中间响应，必须看各自契约，不能统一套一个模板。

## 章末练习

- **2.1（2 分）** preload 是否独立进程？为什么有 TS 返回类型仍需要对 JSON 做运行时校验？
- **2.2（3 分）** catalog 先不存在，后来存在但损坏。分别应如何表现？为什么不能都用“空 workspace”兜底？
- **2.3（5 分）** 在实验里增加“结果不能超过 100”的规则，并测试越界拒绝后原状态仍可读取、后续合法请求可成功。再指出真实快照链路中负责磁盘读取的函数。

对照[第 2 天评分](answers.md#day-2)。本章实验通过不证明 Electron IPC 的 sender 授权安全，也不证明桌面启动成功。
