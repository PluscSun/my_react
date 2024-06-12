import { scheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import { commitMutationEffects } from './commitWork';
import { completeWork } from './completeWork';
import { FiberNode, FiberRootNode, createWorkInProgress } from './fiber';
import { MutationMask, NoFlags } from './fiberFlags';
import {
  Lane,
  NoLane,
  SyncLane,
  getHighestPriorityLane,
  markRootFinished,
  mergeLanes
} from './fiberLanes';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTags';

// 工作中的树指针
let workInProgress: FiberNode | null = null;

// 当前工作时的优先级
let wipRootRenderLane: Lane = NoLane;

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
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
  if (updateLane === NoLane) {
    // 当前没有更新
    return;
  }
  if (updateLane === SyncLane) {
    // 同步优先级 微任务调度
    if (__DEV__) {
      console.log('在微任务中调度，优先级', updateLane);
    }
    // 把render阶段的入口放入调度队列中
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
    // 在微任务中执行调度队列
    scheduleMicroTask(flushSyncCallbacks);
  } else {
    // 其他优先级 宏任务调度
  }
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

// 遍历fiberTree的入口
export function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
  const nextLane = getHighestPriorityLane(root.pendingLanes);
  if (nextLane !== SyncLane) {
    // 其他比SyncLane低的优先级
    // NoLane
    ensureRootIsScheduled(root);
    return;
  }
  // render阶段
  if (__DEV__) {
    console.warn('render阶段开始');
  }
  // 初始化
  prepareFreshStack(root, lane);
  do {
    try {
      workLoop();
      break;
    } catch (e) {
      if (__DEV__) {
        console.log('workloop error', e);
      }
      workInProgress = null;
    }
    // eslint-disable-next-line no-constant-condition
  } while (true);

  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;
  root.finishedLane = lane;
  wipRootRenderLane = NoLane;

  // commit阶段
  // wip fiberNode树，flags，执行操作
  commitRoot(root);
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

  // 判断三个子阶段是否需要执行操作
  const subtreeHasEffect =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

  if (subtreeHasEffect || rootHasEffect) {
    // beforeMutation
    // mutation
    commitMutationEffects(finishedWork);
    // Placement

    // 切换fiber树
    root.current = finishedWork;

    // layout
  } else {
    root.current = finishedWork;
  }
}

// 工作循环
function workLoop() {
  while (workInProgress !== null) {
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
