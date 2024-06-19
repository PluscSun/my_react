import { scheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import {
  commitHookEffectListCreate,
  commitHookEffectListDestroy,
  commitHookEffectListUnmount,
  commitMutationEffects
} from './commitWork';
import { completeWork } from './completeWork';
import {
  FiberNode,
  FiberRootNode,
  PendingPassiveEffects,
  createWorkInProgress
} from './fiber';
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags';
import {
  Lane,
  NoLane,
  SyncLane,
  getHighestPriorityLane,
  lanesToSchedulerPriority,
  markRootFinished,
  mergeLanes
} from './fiberLanes';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTags';
import {
  unstable_scheduleCallback as scheduleCallback,
  unstable_NormalPriority as NormalPriority,
  unstable_shouldYield,
  unstable_cancelCallback,
  CallbackNode
} from 'scheduler';
import { HookHasEffect, Passive } from './hookEffectTags';

// 工作中的树指针
let workInProgress: FiberNode | null = null;

// 当前工作时的优先级
let wipRootRenderLane: Lane = NoLane;

// 控制commit调度的全局变量
let rootDoesHasPassiveEffects: boolean = false;

// 全局标记，当前workloop是执行中断了还是执行完了的状态
type RootExitStatus = number;
const RootInComplete: RootExitStatus = 1;
const RootCompleted: RootExitStatus = 2;
// TODO 执行出错

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  root.finishedLane = NoLane;
  root.finishedWork = null;
  workInProgress = createWorkInProgress(root.current, {});
  wipRootRenderLane = lane;
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  // todo调度功能
  // 遍历到根节点
  const root = markUpdateFromFiberToRoot(fiber);
  markRootUpdate(root, lane);
  ensureRootIsScheduled(root);
}

// schedule阶段入口
function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getHighestPriorityLane(root.pendingLanes);
  const existingCallback = root.callbackNode;

  //当前没有需要调度的优先级，即没有更新
  if (updateLane === NoLane) {
    if (existingCallback !== null) {
      unstable_cancelCallback(existingCallback);
    }
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return;
  }

  const curPriority = updateLane;
  const prevPriority = root.callbackPriority;

  // 当前优先级和之前的优先级一致
  // 不需要重新schedule，已经通过返回本身重新调度了
  if (curPriority === prevPriority) {
    return;
  }

  // 更高优先级更新
  if (existingCallback !== null) {
    // 先取消当前的更新
    unstable_cancelCallback(existingCallback);
  }

  // 记录新的callback
  let newCallbackNode: CallbackNode | null = null;

  if (updateLane === SyncLane) {
    // 同步优先级 微任务调度
    if (__DEV__) {
      console.log('在微任务中调度，优先级', updateLane);
    }
    // 把render阶段的入口放入调度队列中
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
    // 在微任务中执行调度队列
    scheduleMicroTask(flushSyncCallbacks);
  } else {
    // 其他优先级 宏任务调度
    const schedulerPriority = lanesToSchedulerPriority(updateLane);
    newCallbackNode = scheduleCallback(
      schedulerPriority,
      performConcurrentWorkOnRoot.bind(null, root)
    );
  }
  // 如果是同步更新callbackNode就是null
  root.callbackNode = newCallbackNode;
  root.callbackPriority = curPriority;
}

/**
 * @description: 把一个lane并入当前fiberRootNode记录的未消费Lanes中
 * @param {FiberRootNode} root
 * @param {Lane} lane
 * @return {*}
 * @use: schedule阶段记录lane
 */
function markRootUpdate(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

function markUpdateFromFiberToRoot(fiber: FiberNode) {
  let node = fiber;
  let parent = node.return;
  while (parent !== null) {
    node = parent;
    parent = node.return;
  }
  // 遍历到hostRootFiber了
  if (node.tag === HostRoot) {
    return node.stateNode;
  }
  return null;
}

function performConcurrentWorkOnRoot(
  root: FiberRootNode,
  didTimeOut: boolean
): any {
  // 保证useEffect回调执行
  const curCallback = root.callbackNode;
  const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);
  // 如果useEffect执行了，且调度的某一个回调函数优先级比当前的优先级还要高，直接return
  if (didFlushPassiveEffect) {
    if (root.callbackNode !== curCallback) {
      return null;
    }
  }

  const lane = getHighestPriorityLane(root.pendingLanes);
  const curCallbackNode = root.callbackNode;
  if (lane === NoLane) {
    return null;
  }
  const needSync = lane === SyncLane || didTimeOut;
  // render阶段
  const exitStatus = renderRoot(root, lane, !needSync);
  // render阶段因为中断或者结束退出后，再调度一次
  ensureRootIsScheduled(root);

  if (exitStatus === RootInComplete) {
    // 中断
    if (root.callbackNode !== curCallbackNode) {
      // 代表有一个更高优先级的的更新替换了root.callbackNode
      return null;
    }
    // 如果被调度的函数返回了一个函数，那么这个函数会以同优先级继续调度
    return performConcurrentWorkOnRoot.bind(null, root);
  }
  if (exitStatus === RootCompleted) {
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = lane;
    wipRootRenderLane = NoLane;

    // commit阶段
    // wip fiberNode树，flags，执行操作
    commitRoot(root);
  } else if (__DEV__) {
    console.error('还未实现并发更新结束状态');
  }
}

// 遍历fiberTree的入口
export function performSyncWorkOnRoot(root: FiberRootNode) {
  const nextLane = getHighestPriorityLane(root.pendingLanes);
  if (nextLane !== SyncLane) {
    // 其他比SyncLane低的优先级
    // NoLane
    ensureRootIsScheduled(root);
    return;
  }

  const exitStatus = renderRoot(root, nextLane, false);
  if (exitStatus === RootCompleted) {
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = nextLane;
    wipRootRenderLane = NoLane;

    // commit阶段
    // wip fiberNode树，flags，执行操作
    commitRoot(root);
  } else if (__DEV__) {
    console.error('还未实现同步更新结束状态');
  }
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
  if (__DEV__) {
    console.log(`开始${shouldTimeSlice ? '并发' : '同步'}更新`, root);
  }
  // render阶段
  if (wipRootRenderLane !== lane) {
    // 只有优先级发生变化才初始化，否则可能是优先级中断，又回到此函数
    prepareFreshStack(root, lane);
  }

  do {
    try {
      shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
      break;
    } catch (e) {
      if (__DEV__) {
        console.log('workloop error', e);
      }
      workInProgress = null;
    }
    // eslint-disable-next-line no-constant-condition
  } while (true);

  //两种情况：中断了workloop或者执行完了
  //中断执行
  if (shouldTimeSlice && workInProgress !== null) {
    return RootInComplete;
  }

  // render阶段执行完毕
  if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
    console.error(`render阶段结束时不应该不是null`);
  }

  //TODO 报错

  return RootCompleted;
}

function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork;
  if (finishedWork === null) {
    return;
  }
  if (__DEV__) {
    console.warn('commit阶段开始', finishedWork);
  }
  const lane = root.finishedLane;

  if (lane === NoLane && __DEV__) {
    console.error('commit阶段finishedLane不应该是NoLane');
  }

  // 重置
  root.finishedWork = null;
  root.finishedLane = NoLane;

  markRootFinished(root, lane);

  if (
    (finishedWork.flags & PassiveMask) !== NoFlags ||
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags
  ) {
    // 需要执行effect
    if (!rootDoesHasPassiveEffects) {
      rootDoesHasPassiveEffects = true;
      // 调度副作用
      scheduleCallback(NormalPriority, () => {
        // 执行副作用
        flushPassiveEffects(root.pendingPassiveEffects);
        return;
      });
    }
  }

  // 判断三个子阶段是否需要执行操作
  const subtreeHasEffect =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

  if (subtreeHasEffect || rootHasEffect) {
    // beforeMutation
    // mutation
    commitMutationEffects(finishedWork, root);
    // Placement

    // 切换fiber树
    root.current = finishedWork;

    // layout
  } else {
    root.current = finishedWork;
  }

  rootDoesHasPassiveEffects = false;
  ensureRootIsScheduled(root);
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
  let didFlushPassiveEffect = false;
  // 遍历effect，本次更新的所有create回调都必须在所有上一次更新的destroy回调执行完成后再执行
  // 先遍历所有的unmount
  // 首先触发所有unmount effect
  pendingPassiveEffects.unmount.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListUnmount(Passive, effect);
  });
  pendingPassiveEffects.unmount = [];

  // 触发所有上次更新destroy的effect
  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListDestroy(Passive | HookHasEffect, effect);
  });

  // 触发所有本次更新create的effect
  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListCreate(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffects.update = [];
  // effect更新完毕，如果引起渲染，还要再触发
  flushSyncCallbacks();
  return didFlushPassiveEffect;
}

// 工作循环
function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function workLoopConcurrent() {
  while (workInProgress !== null && !unstable_shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(fiber: FiberNode) {
  const next = beginWork(fiber, wipRootRenderLane);
  fiber.memorizedProps = fiber.pendingProps;

  if (next === null) {
    completeUnitOfWork(fiber);
  } else {
    workInProgress = next;
  }
}

function completeUnitOfWork(fiber: FiberNode) {
  let node: FiberNode | null = fiber;
  // todo
  do {
    const next = completeWork(node);
    if (next !== null) {
      workInProgress = next;
      return;
    }
    const sibling = node.sibling;

    if (sibling !== null) {
      workInProgress = sibling;
      return;
    }
    node = node.return;
    workInProgress = node;
  } while (node !== null);
}
