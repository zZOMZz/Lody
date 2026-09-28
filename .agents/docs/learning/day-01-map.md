# 第 1 天：项目地图与平台边界

[课程首页](README.md) · [下一章](day-02-ipc.md)

目标：遇到一个需求时，先判断所属进程、包和状态，再找函数。用时约 150 分钟；环境安装不计入阅读时间。

## 从用户动作建立地图

设想你在桌面输入“解释这个函数”。界面负责采集文本、选择项目和展示状态；CLI 负责执行生命周期；Agent 适配器把统一协议转成具体供应商行为；共享层定义双方都懂的消息和数据。一个目录不是一个进程：`packages/shared` 的代码可以分别装进 renderer 与 CLI，各自在自己的内存里运行。

下面是职责视图，不表示所有箭头都经过同一条传输通道：

```text
桌面窗口：React UI（packages/components）
  Electron 外壳（apps/electron）：main / preload / renderer
  本机 CLI（apps/cli）：调度、进程、Git、文档生命周期
    ACP 适配器 / Agent 进程：执行具体模型与工具工作

共享契约：packages/shared       平台接口：packages/platform
基础控件：packages/ui           可选云协议 DTO：packages/cloud-api
```

`packages/ui` 解决按钮、输入框、颜色和交互语义；`packages/components` 把它们组合成会话、设置等业务。拆开后，控件样式变化不应承担“是否允许远程机器”的判断。后者来自平台能力接口。

## 三个可迁移的设计知识

**Monorepo 与运行边界。** pnpm workspace 让包之间共享源码和统一依赖版本，但不会消除进程边界。TypeScript 的 `import type` 在运行时擦除；普通 import 可能把依赖真正拉入 bundle。因此“能导入某个类型”不等于“应该在这个运行时加载对应实现”。

**端口与依赖注入。** 可以把平台端口理解为“业务想做什么”的接口，由应用入口提供“在本环境怎样完成”的实现。业务依赖接口，测试可以提供受控实现。本地 `PlatformProvider` 的 `cloudApi` 是 `null`，并通过能力集合说明哪些可选产品功能可用；CLI 则使用自己的 `CloudPort` 接口。不要把这两个消费端当作同一对象。

**能力与权限。** 能力回答“这种运行环境支持吗”，权限回答“这个请求者能做吗”。支持远程机器不能证明某个人能访问某台机器。能力集合也不是攻击者面前的授权边界，服务端/执行边界仍要验证请求。

本地能力集合为空，含义是列举的云端产品能力不可用；它不代表应用没有本地聊天、文件、终端能力。公开桌面不发起已认证的产品云请求，但可以下载公开托管的 Agent runtime；“本地模式”也不保证配置的模型供应商不访问网络。

## 源码导读：只读这四个落点

| 顺序 | 入口                                                                                       | 阅读任务                                                                         |
| ---- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 1    | [根 package.json](../../../package.json) 与 [workspace 配置](../../../pnpm-workspace.yaml) | 找 `start:local`、`check`、`packageManager`，辨认哪些子模块不在根依赖图中        |
| 2    | [capabilities.ts](../../../packages/platform/src/capabilities.ts)                          | 读 `createCapabilitySet`、`LOCAL_PLATFORM_CAPABILITIES`，解释空集合含义          |
| 3    | [local.ts](../../../packages/platform/src/local.ts)                                        | 读 `createLocalPlatformProvider`，找 identity、workspaces、cloudApi、sync 的归属 |
| 4    | [platform-kind.ts](../../../packages/shared/src/platform-kind.ts)                          | 读 `resolvePlatformKind`，区分缺省值和非法值                                     |

平台边界的约束以 [platform/AGENTS.md](../../../packages/platform/AGENTS.md) 为准。此章没有要求改变任何能力开关。

## 预备知识检查与实验

先解释下面两者的区别：`Promise<T>` 表示将来的结果，`T | null` 表示结果也可能不存在；不要把它们都处理成“失败”。再阅读 [TypeScript Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) 的 type guard 和 discriminated union 两节，认识 `{ status: 'loading' } | { status: 'ready', value: T }` 如何避免访问不存在的值。

```sh
node --experimental-strip-types .agents/docs/learning/examples/labs.mjs 1
```

实验直接调用项目的能力集合和平台选择函数。预期输出 `day 1: ok`：空配置选 local、拼错平台名抛错、本地无 `remoteMachines`，重复能力不会生成重复条目。先预测每条断言再运行；把实验中的空配置改成 `cluod`，观察错误，而不是给它增加静默回退。

完成环境准备后，可选择实际启动：

```sh
pnpm start:local
```

记录“界面可见”和“Agent 能执行”分别由什么证据证明。前者不证明模型登录、runtime 下载和 ACP 初始化已成功。实验结束正常退出应用；学习无需真实模型调用。

## 章末练习

- **1.1（2 分）** 解释 `packages/shared` 为什么不等于一个独立服务；分别举一个应该放在平台层与 UI 层的需求。
- **1.2（3 分）** 本地没有 `remoteMachines`。只隐藏机器选择器，但后台仍初始化远程发现，哪里出了问题？能力检查能否替代授权？
- **1.3（5 分）** 画出上面各层的职责图，运行实验并记录一个成功和一个非法输入的结果。用源码说明“缺省 local”与“拼错配置也 local”为什么是不同设计。

完成后对照[第 1 天评分](answers.md#day-1)。选读：[`@lody/ui` README](../../../packages/ui/README.md)，挑一个 Field 组合，区分控件有效性与业务权限。
